import OpenAI from "openai";
import pdfParse from "pdf-parse";
import { NextResponse } from "next/server";
import { extractPdfTextByPage } from "@/lib/pdf/extractPdfText";
import type { PdfPageText } from "@/lib/decisionExtract/cleanText";
import type { DecisionCandidate, DecisionSource } from "@/lib/types/decision";

export const runtime = "nodejs";

type DecisionPayload = {
  id: string;
  decision: string;
  evidence: string;
  source?: {
    fileName?: string;
    page?: number;
  };
};

type ExtractResponse = {
  candidates: DecisionCandidate[];
  warning?: string;
  debug?: {
    pagesExtracted: number;
    totalChars: number;
    chunks: number;
    candidatesExtracted: number;
    candidatesAfterQuality: number;
    notes?: string[];
  };
};

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const DEFAULT_SCORE = 5;
const CHUNK_CHAR_LIMIT = 12_000;
const CHUNK_PAGE_LIMIT = 2;
const MAX_CANDIDATES_PER_CHUNK = 30;
const MAX_TOTAL_CHARS = 500_000;
const MAX_CHUNKS = 6;
const MAX_PAGES = 20;
const OPENAI_TIMEOUT_MS = 18_000;
const CHUNK_CONCURRENCY = 2;

const ACTION_VERBS = [
  "begin",
  "launch",
  "expand",
  "commission",
  "prepare",
  "invest",
  "increase",
  "reduce",
  "continue",
  "ramp",
  "start",
  "build",
  "deploy",
  "deliver",
  "introduce",
  "scale",
  "approve",
  "open",
  "acquire",
  "transition",
  "resume",
  "accelerate",
];

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "in",
  "for",
  "of",
  "on",
  "and",
  "or",
  "with",
  "by",
  "at",
  "from",
  "this",
  "that",
  "these",
  "those",
  "both",
  "their",
  "our",
  "its",
  "as",
  "be",
  "is",
  "are",
  "was",
  "were",
  "will",
  "plan",
  "plans",
  "planned",
  "target",
  "targeted",
  "expected",
  "expect",
  "aim",
  "aimed",
]);

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const truncateSnippet = (value: string, limit = 200) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const sliced = normalized.slice(0, limit);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, lastSpace > 60 ? lastSpace : limit).trim()}…`;
};

const withTimeout = async <T,>(task: (signal?: AbortSignal) => Promise<T>, ms: number) => {
  let timeoutId: NodeJS.Timeout | undefined;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      const error = new Error(`Operation timed out after ${ms}ms`);
      error.name = "TimeoutError";
      reject(error);
    }, ms);
  });
  try {
    return await Promise.race([task(controller?.signal), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const runWithConcurrency = async <Item, Result>(
  items: Item[],
  concurrency: number,
  worker: (item: Item, index: number) => Promise<Result>,
) => {
  const results: Result[] = new Array(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      if (currentIndex >= items.length) break;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(runners);
  return results;
};

const normalizeDecisionKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const hasObjectNoun = (value: string) => {
  const tokens = value
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  return tokens.some((token) => !STOPWORDS.has(token) && !ACTION_VERBS.includes(token) && token.length > 2);
};

const ensureVerbFirst = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  const [first, ...rest] = normalized.split(" ");
  if (!first) return normalized;
  const lowerFirst = first.toLowerCase();
  if (ACTION_VERBS.includes(lowerFirst)) {
    return `${first.charAt(0).toUpperCase()}${first.slice(1)} ${rest.join(" ")}`.trim();
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const repairDecisionWithEvidence = (decision: string, evidence: string) => {
  const normalizedEvidence = evidence.replace(/\s+/g, " ").trim();
  const commitmentMatch = normalizedEvidence.match(
    /\b(?:will|plan to|plans to|expect to|aim to|target to|set to|scheduled to|committed to)\s+([^.;\n]+)/i,
  );
  if (commitmentMatch?.[1]) {
    return ensureVerbFirst(commitmentMatch[1]);
  }
  const verbMatch = normalizedEvidence.match(
    new RegExp(`\\b(${ACTION_VERBS.join("|")})\\b\\s+([^.;\n]{6,120})`, "i"),
  );
  if (verbMatch?.[1] && verbMatch?.[2]) {
    return ensureVerbFirst(`${verbMatch[1]} ${verbMatch[2]}`);
  }
  return ensureVerbFirst(decision);
};

const isTooVague = (decision: string, evidence: string) => {
  const words = decision.trim().split(/\s+/);
  if (words.length < 3) return true;
  if (!hasObjectNoun(decision) && !hasObjectNoun(evidence)) return true;
  return false;
};

const scoreCandidate = (decision: string, evidence: string) => {
  let score = 55;
  if (/\b(20\d{2}|q[1-4]|by end|this year|next year|next quarter|during|within)\b/i.test(evidence)) {
    score += 12;
  }
  if (/\d/.test(evidence)) score += 8;
  if (decision.length > 60) score += 5;
  return Math.min(100, score);
};

const mergeSources = (existing: DecisionSource[], incoming: DecisionSource[]) => {
  const merged = [...existing];
  for (const source of incoming) {
    const exists = merged.some(
      (entry) =>
        entry.fileName === source.fileName &&
        entry.pageNumber === source.pageNumber &&
        entry.excerpt === source.excerpt,
    );
    if (!exists) merged.push(source);
  }
  return merged;
};

const buildChunks = (pages: PdfPageText[]) => {
  const grouped = new Map<string, PdfPageText[]>();
  for (const page of pages) {
    const key = page.fileName ?? "Document";
    const entry = grouped.get(key) ?? [];
    entry.push(page);
    grouped.set(key, entry);
  }

  const chunks: { fileName: string; pages: PdfPageText[]; text: string }[] = [];

  for (const [fileName, filePages] of grouped.entries()) {
    let current: PdfPageText[] = [];
    let currentLength = 0;
    const pushChunk = () => {
      if (current.length === 0) return;
      const text = current
        .map((page) => `=== Page ${page.pageNumber} ===\n${page.text}`)
        .join("\n\n")
        .trim();
      if (text) {
        chunks.push({ fileName, pages: current, text });
      }
      current = [];
      currentLength = 0;
    };

    for (const page of filePages) {
      const trimmedText = page.text.replace(/\s+/g, " ").trim();
      if (!trimmedText) continue;
      if (trimmedText.length > CHUNK_CHAR_LIMIT) {
        for (let start = 0; start < trimmedText.length; start += CHUNK_CHAR_LIMIT) {
          const slice = trimmedText.slice(start, start + CHUNK_CHAR_LIMIT);
          if (current.length > 0) pushChunk();
          current = [{ ...page, text: slice }];
          currentLength = slice.length;
          pushChunk();
        }
        continue;
      }

      const nextLength = currentLength + trimmedText.length;
      if (current.length >= CHUNK_PAGE_LIMIT || nextLength > CHUNK_CHAR_LIMIT) {
        pushChunk();
      }
      current.push({ ...page, text: trimmedText });
      currentLength += trimmedText.length;
    }
    pushChunk();
  }

  return chunks;
};

const parseJson = (content: string) => {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const parsePdfFallback = async (arrayBuffer: ArrayBuffer) => {
  const data = await pdfParse(Buffer.from(arrayBuffer));
  const rawText = data.text?.trim() ?? "";
  if (!rawText) return [];
  const pages = rawText
    .split(/\f/g)
    .map((page) => page.trim())
    .filter(Boolean);
  const normalizedPages = pages.length > 0 ? pages : [rawText];
  return normalizedPages.map((text, index) => ({ pageNumber: index + 1, text }));
};

const extractCandidatesFromChunk = async (
  client: OpenAI,
  chunk: { fileName: string; pages: PdfPageText[]; text: string },
): Promise<{ candidates: DecisionPayload[]; warning?: string; debugNote?: string }> => {
  const pageList = chunk.pages.map((page) => page.pageNumber).join(", ");
  const systemPrompt = [
    "You extract high-recall decision candidates from document text.",
    "Each candidate must be a committed intent under constraint (action + object + timing/constraint when present).",
    "Decision statements must start with a verb (Begin/Launch/Expand/Commission/Prepare/Invest/Increase/Reduce/Continue/Ramp/Start/Build/Deploy).",
    "Evidence must be a short quote/snippet from the text (<= 200 chars).",
    "Include page number attribution in source.page when possible.",
    `Return JSON ONLY with schema: { "candidates": [{ "id": "string", "decision": "string", "evidence": "string", "source": { "fileName"?: "string", "page"?: number } }] }`,
    `Return up to ${MAX_CANDIDATES_PER_CHUNK} candidates. Prefer recall. No markdown.`,
  ].join(" ");

  const userPrompt = [
    `File: ${chunk.fileName}`,
    `Pages in this chunk: ${pageList}`,
    "Text:",
    chunk.text,
  ].join("\n");

  try {
    const completion = await withTimeout(
      (signal) =>
        client.chat.completions.create({
          model: MODEL,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          signal,
        }),
      OPENAI_TIMEOUT_MS,
    );

    const content = completion.choices[0]?.message?.content ?? "";
    if (!content.trim()) {
      return { candidates: [], debugNote: "Empty OpenAI response content." };
    }
    const parsed = parseJson(content) as { candidates?: DecisionPayload[] } | null;
    if (!Array.isArray(parsed?.candidates)) {
      return { candidates: [], debugNote: "Missing candidates array in OpenAI response." };
    }
    const candidates = parsed.candidates ?? [];
    return { candidates };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { candidates: [], warning: "Timed out while extracting decisions from one chunk." };
    }
    return { candidates: [], warning: "Failed to extract decisions from one chunk." };
  }
};

const buildDecisionCandidate = (
  candidate: DecisionPayload,
  chunk: { fileName: string; pages: PdfPageText[] },
): DecisionCandidate | null => {
  const decisionRaw = typeof candidate.decision === "string" ? candidate.decision.trim() : "";
  const evidenceRaw = typeof candidate.evidence === "string" ? candidate.evidence.trim() : "";
  if (!decisionRaw || !evidenceRaw) return null;

  const fallbackPage = chunk.pages.length === 1 ? chunk.pages[0]?.pageNumber : chunk.pages[0]?.pageNumber;
  const sourceFile = typeof candidate.source?.fileName === "string" ? candidate.source?.fileName : chunk.fileName;
  const parsedPage =
    typeof candidate.source?.page === "string" ? Number.parseInt(candidate.source.page, 10) : undefined;
  const sourcePage =
    typeof candidate.source?.page === "number"
      ? candidate.source?.page
      : Number.isFinite(parsedPage)
        ? parsedPage
        : fallbackPage ?? undefined;

  const evidence = truncateSnippet(evidenceRaw, 200);
  let decision = ensureVerbFirst(decisionRaw);
  if (isTooVague(decision, evidence)) {
    const repaired = repairDecisionWithEvidence(decisionRaw, evidence);
    if (isTooVague(repaired, evidence)) return null;
    decision = ensureVerbFirst(repaired);
  }

  const id = `decision-${hashString(`${decision}-${sourceFile ?? ""}-${sourcePage ?? ""}`)}`;
  const score = scoreCandidate(decision, evidence);
  return {
    id,
    decision,
    evidence,
    sources: [
      {
        fileName: sourceFile,
        pageNumber: sourcePage,
        excerpt: evidence,
      },
    ],
    extractConfidence: score / 100,
    qualityScore: score,
    impact: DEFAULT_SCORE,
    cost: DEFAULT_SCORE,
    risk: DEFAULT_SCORE,
    urgency: DEFAULT_SCORE,
    confidence: DEFAULT_SCORE,
  };
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
    }

    const formData = await request.formData();
    const memoKeys = ["memo", "text", "content"];
    const fileKeys = ["files", "file", "pdf", "pdfs", "documents"];
    const memo =
      memoKeys
        .map((key) => formData.get(key))
        .find((value) => typeof value === "string")?.toString() ?? "";
    const files = fileKeys.flatMap((key) =>
      formData.getAll(key).filter((item): item is File => item instanceof File),
    );
    const filesByKey = new Map<string, File>();
    for (const file of files) {
      const dedupeKey = `${file.name}-${file.size}-${file.lastModified}`;
      if (!filesByKey.has(dedupeKey)) filesByKey.set(dedupeKey, file);
    }
    const uniqueFiles = [...filesByKey.values()];

    if (!memo.trim() && uniqueFiles.length === 0) {
      return NextResponse.json(
        {
          error: "Add PDFs or paste text to extract decisions.",
          hint: "Expected multipart form-data with keys memo/text/content and files/file/pdf/pdfs/documents.",
        },
        { status: 400 },
      );
    }

    const pages: PdfPageText[] = [];
    const warnings: string[] = [];
    let totalChars = 0;
    let truncated = false;
    let pageLimitReached = false;

    if (memo.trim()) {
      const text = memo.trim();
      const remaining = Math.max(0, MAX_TOTAL_CHARS - totalChars);
      const slice = text.slice(0, remaining);
      if (slice.length < text.length) truncated = true;
      pages.push({ fileName: "Pasted text", pageNumber: 1, text: slice });
      totalChars += slice.length;
    }

    for (const file of uniqueFiles) {
      if (totalChars >= MAX_TOTAL_CHARS) {
        truncated = true;
        break;
      }
      const errorId = `pdf-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      try {
        const buffer = await file.arrayBuffer();
        let pageTexts: PdfPageText[];
        try {
          pageTexts = await extractPdfTextByPage(buffer);
        } catch (extractError) {
          console.error("PDF extraction failed", {
            errorId,
            fileName: file.name,
            message: extractError instanceof Error ? extractError.message : String(extractError),
            stack: extractError instanceof Error ? extractError.stack : undefined,
          });
          pageTexts = await parsePdfFallback(buffer);
          if (pageTexts.length > 0) {
            warnings.push(`Used fallback PDF parser for ${file.name}.`);
          }
        }

        if (pageTexts.length === 0) {
          return NextResponse.json(
            { error: "PDF extraction failed", fileName: file.name, errorId },
            { status: 400 },
          );
        }

        for (const page of pageTexts) {
          if (pages.length >= MAX_PAGES) {
            pageLimitReached = true;
            break;
          }
          if (totalChars >= MAX_TOTAL_CHARS) {
            truncated = true;
            break;
          }
          const text = page.text.trim();
          if (!text) continue;
          const remaining = Math.max(0, MAX_TOTAL_CHARS - totalChars);
          const slice = text.slice(0, remaining);
          if (slice.length < text.length) truncated = true;
          pages.push({ ...page, fileName: file.name, text: slice });
          totalChars += slice.length;
        }
      } catch (error) {
        console.error("PDF extraction failed", {
          errorId,
          fileName: file.name,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
          {
            error: "PDF extraction failed",
            fileName: file.name,
            errorId,
          },
          { status: 400 },
        );
      }
      if (pageLimitReached) break;
    }

    if (pages.length === 0) {
      return NextResponse.json({ error: "No readable text found in the uploads." }, { status: 400 });
    }

    const chunks = buildChunks(pages);
    if (chunks.length > MAX_CHUNKS) {
      warnings.push(
        `Processed first ${MAX_CHUNKS} chunks for speed. Upload a smaller excerpt or paste key sections for full coverage.`,
      );
    }
    if (pageLimitReached) {
      warnings.push(
        `Processed only the first ${MAX_PAGES} pages to keep extraction fast. Upload fewer pages for full coverage.`,
      );
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const rawCandidates: DecisionPayload[] = [];
    const collected: DecisionCandidate[] = [];
    const debugNotes: string[] = [];
    const chunksToProcess = chunks.slice(0, MAX_CHUNKS);
    const chunkResults = await runWithConcurrency(chunksToProcess, CHUNK_CONCURRENCY, async (chunk) =>
      extractCandidatesFromChunk(client, chunk),
    );
    chunkResults.forEach((result, index) => {
      if (result.warning) warnings.push(result.warning);
      if (result.debugNote) debugNotes.push(`Chunk ${index + 1}: ${result.debugNote}`);
      const chunk = chunksToProcess[index];
      const chunkCandidates = result.candidates ?? [];
      rawCandidates.push(...chunkCandidates.map((candidate) => ({ ...candidate, source: candidate.source ?? {} })));
      for (const candidate of chunkCandidates) {
        const built = buildDecisionCandidate(candidate, chunk);
        if (built) collected.push(built);
      }
    });

    const deduped = new Map<string, DecisionCandidate>();
    for (const candidate of collected) {
      const key = normalizeDecisionKey(candidate.decision);
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, candidate);
        continue;
      }
      const mergedSources = mergeSources(existing.sources, candidate.sources);
      const winner = candidate.qualityScore >= existing.qualityScore ? candidate : existing;
      deduped.set(key, { ...winner, sources: mergedSources });
    }

    const finalCandidates = [...deduped.values()];

    const response: ExtractResponse = {
      candidates: finalCandidates,
      warning: [
        truncated
          ? `We analyzed only the first ${MAX_TOTAL_CHARS.toLocaleString()} characters to keep extraction fast.`
          : null,
        ...warnings,
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || undefined,
      debug:
        process.env.NODE_ENV !== "production"
          ? {
              pagesExtracted: pages.length,
              totalChars,
              chunks: chunks.length,
              candidatesExtracted: rawCandidates.length,
              candidatesAfterQuality: finalCandidates.length,
              notes: debugNotes.length > 0 ? debugNotes : undefined,
            }
          : undefined,
    };

    if (process.env.NODE_ENV !== "production") {
      console.debug("Stress Test intake", {
        pagesExtracted: pages.length,
        totalChars,
        chunks: chunks.length,
        candidatesExtracted: rawCandidates.length,
        candidatesAfterQuality: finalCandidates.length,
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    const errorId = `intake-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    console.error("Stress test intake failed", {
      errorId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      cause: error instanceof Error ? error.cause : undefined,
    });
    return NextResponse.json(
      {
        error: "Internal Error",
        errorId,
        details:
          process.env.NODE_ENV !== "production"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 },
    );
  }
}
