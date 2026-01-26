import OpenAI from "openai";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { extractPdfTextByPage } from "@/lib/pdf/extractPdfText";
import { getModel } from "./model";

type DecisionSource = {
  fileName: string;
  page: number;
};

type DecisionItem = {
  id: string;
  decision: string;
  evidence: string;
  source: DecisionSource;
  tags?: string[];
  qualityScore: number;
};

type SummaryDecision = {
  decision: string;
  why_it_matters?: string;
  source?: DecisionSource;
};

type SummaryPayload = {
  key_decisions: SummaryDecision[];
  themes?: string[];
  unknowns?: string[];
};

type MetaStage =
  | "start"
  | "extract_text"
  | "chunk"
  | "extract_candidates"
  | "merge"
  | "summarize"
  | "done"
  | "error";

type IntakeMeta = {
  stage: MetaStage;
  pages_processed: number;
  chunks_processed: number;
  candidates_extracted: number;
  decisions_final: number;
  truncated: boolean;
  warnings: string[];
  timing_ms: number;
};

type IntakeResponse = {
  summary: SummaryPayload | null;
  decisions: Array<{
    id: string;
    decision: string;
    evidence: string;
    source: DecisionSource;
    tags?: string[];
  }>;
  meta: IntakeMeta;
  errorId?: string;
  error?: { message: string; detail?: string };
};

type PageText = {
  fileName: string;
  pageNumber: number;
  text: string;
};

type PdfParseFn = (
  buffer: Buffer,
  options?: unknown,
) => Promise<{ text?: string } & Record<string, unknown>>;

const MAX_TOTAL_CHARS = 250_000;
const MAX_PAGES = 20;
const MAX_CHUNKS = 8;
const CHUNK_CHAR_LIMIT = 12_000;
const CHUNK_PAGE_LIMIT = 2;
const MAX_CANDIDATES_PER_CHUNK = 25;
const OPENAI_TIMEOUT_MS = 18_000;
const CHUNK_CONCURRENCY = 2;

export const runtime = "nodejs";

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const truncateSnippet = (value: string, limit = 220) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const sliced = normalized.slice(0, limit);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, lastSpace > 60 ? lastSpace : limit).trim()}…`;
};

const normalizeDecisionKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const ensureVerbFirst = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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

const buildChunks = (pages: PageText[]) => {
  const grouped = new Map<string, PageText[]>();
  for (const page of pages) {
    const entry = grouped.get(page.fileName) ?? [];
    entry.push(page);
    grouped.set(page.fileName, entry);
  }

  const chunks: { fileName: string; pages: PageText[]; text: string }[] = [];

  for (const [fileName, filePages] of grouped.entries()) {
    let current: PageText[] = [];
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

const getPdfParse = async (): Promise<PdfParseFn> => {
  const mod = (await import("pdf-parse")) as unknown as { default?: PdfParseFn; pdfParse?: PdfParseFn };
  const pdfParse = mod.default ?? mod.pdfParse;
  if (!pdfParse) {
    throw new Error("pdf-parse did not expose a callable parser (no default/pdfParse).");
  }
  return pdfParse;
};

const extractCandidatesFromChunk = async (
  client: OpenAI,
  model: string,
  chunk: { fileName: string; pages: PageText[]; text: string },
): Promise<{ candidates: DecisionItem[]; warning?: string }> => {
  const pageList = chunk.pages.map((page) => page.pageNumber).join(", ");
  const systemPrompt = [
    "You extract high-recall decision candidates from document text.",
    "Decision = committed intent under constraint.",
    "Decision statements must start with a verb.",
    "Evidence must be a short quote/snippet from the text (<= 220 chars).",
    "Include source fileName and page when possible.",
    `Return JSON ONLY: { \"candidates\": [{ \"decision\": \"string\", \"evidence\": \"string\", \"source\": { \"fileName\": \"string\", \"page\": number }, \"tags\"?: [\"string\"] }] }`,
    `Return up to ${MAX_CANDIDATES_PER_CHUNK} candidates. Prefer recall. No markdown.`,
  ].join(" ");

  const userPrompt = [
    `File: ${chunk.fileName}`,
    `Pages in this chunk: ${pageList}`,
    "Text:",
    chunk.text,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      signal: controller.signal,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    if (!content.trim()) return { candidates: [] };
    const parsed = parseJson(content) as { candidates?: Array<{
      decision?: string;
      evidence?: string;
      source?: { fileName?: string; page?: number | string };
      tags?: string[];
    }> } | null;
    const list = Array.isArray(parsed?.candidates) ? parsed?.candidates : [];

    const candidates: DecisionItem[] = [];
    for (const candidate of list) {
      const decisionRaw = typeof candidate.decision === "string" ? candidate.decision.trim() : "";
      const evidenceRaw = typeof candidate.evidence === "string" ? candidate.evidence.trim() : "";
      if (!decisionRaw || !evidenceRaw) continue;
      const decision = ensureVerbFirst(decisionRaw);
      const evidence = truncateSnippet(evidenceRaw, 220);
      const sourceFile =
        typeof candidate.source?.fileName === "string" && candidate.source.fileName.trim()
          ? candidate.source.fileName.trim()
          : chunk.fileName;
      const parsedPage =
        typeof candidate.source?.page === "string" ? Number.parseInt(candidate.source.page, 10) : undefined;
      const sourcePage =
        typeof candidate.source?.page === "number"
          ? candidate.source.page
          : Number.isFinite(parsedPage)
            ? parsedPage
            : chunk.pages[0]?.pageNumber ?? 1;
      const qualityScore = scoreCandidate(decision, evidence);
      const id = `decision-${hashString(`${decision}-${sourceFile}-${sourcePage}`)}`;
      candidates.push({
        id,
        decision,
        evidence,
        source: { fileName: sourceFile, page: sourcePage },
        tags: candidate.tags,
        qualityScore,
      });
    }
    return { candidates };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { candidates: [], warning: "Timed out while extracting decisions from one chunk." };
    }
    return { candidates: [], warning: "Failed to extract decisions from one chunk." };
  } finally {
    clearTimeout(timeout);
  }
};

const summarizeDecisions = async (
  client: OpenAI,
  model: string,
  decisions: DecisionItem[],
): Promise<{ summary: SummaryPayload | null; warning?: string }> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  const compact = decisions.map((decision) => ({
    decision: decision.decision,
    evidence: decision.evidence,
    source: decision.source,
  }));

  const systemPrompt = [
    "You summarize structured decision items.",
    "Return 8-20 key decisions as bullets with why_it_matters when possible.",
    "Include source citations when available.",
    "Return JSON ONLY: { \"key_decisions\": [{ \"decision\": \"string\", \"why_it_matters\": \"string\", \"source\"?: { \"fileName\": \"string\", \"page\": number } }], \"themes\"?: [\"string\"], \"unknowns\"?: [\"string\"] }",
  ].join(" ");

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ decisions: compact }) },
      ],
      signal: controller.signal,
    });
    const content = completion.choices[0]?.message?.content ?? "";
    if (!content.trim()) return { summary: null, warning: "Summary response was empty." };
    const parsed = parseJson(content) as SummaryPayload | null;
    if (!parsed || !Array.isArray(parsed.key_decisions)) {
      return { summary: null, warning: "Summary response was not valid JSON." };
    }
    return { summary: parsed };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { summary: null, warning: "Timed out while summarizing decisions." };
    }
    return { summary: null, warning: "Failed to summarize decisions." };
  } finally {
    clearTimeout(timeout);
  }
};

const buildErrorResponse = (
  status: number,
  errorId: string,
  message: string,
  detail: string | undefined,
  meta: IntakeMeta,
) =>
  NextResponse.json(
    {
      summary: null,
      decisions: [],
      meta: { ...meta, stage: "error" },
      errorId,
      error: { message, detail },
    } satisfies IntakeResponse,
    { status },
  );

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: getModel(),
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    runtime,
  });
}

export async function POST(request: Request) {
  const errorId = crypto.randomUUID();
  const startedAt = Date.now();
  let stage: MetaStage = "start";
  let pagesProcessed = 0;
  let chunksProcessed = 0;
  let candidatesExtracted = 0;
  let decisionsFinal = 0;
  let truncated = false;
  const warnings: string[] = [];

  try {
    if (!process.env.OPENAI_API_KEY) {
      const meta: IntakeMeta = {
        stage,
        pages_processed: pagesProcessed,
        chunks_processed: chunksProcessed,
        candidates_extracted: candidatesExtracted,
        decisions_final: decisionsFinal,
        truncated,
        warnings,
        timing_ms: Date.now() - startedAt,
      };
      return buildErrorResponse(
        500,
        errorId,
        "OPENAI_API_KEY missing in runtime environment.",
        "Set OPENAI_API_KEY in Netlify environment variables.",
        meta,
      );
    }

    stage = "extract_text";
    const formData = await request.formData();
    const memo = typeof formData.get("memo") === "string" ? String(formData.get("memo")) : "";
    const modeRaw = typeof formData.get("mode") === "string" ? String(formData.get("mode")) : "extract+summarize";
    const mode = ["extract", "summarize", "extract+summarize"].includes(modeRaw)
      ? (modeRaw as "extract" | "summarize" | "extract+summarize")
      : "extract+summarize";
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    const validFiles = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );
    if (validFiles.length !== files.length) {
      warnings.push("Non-PDF files were skipped.");
    }

    if (!memo.trim() && validFiles.length === 0) {
      const meta: IntakeMeta = {
        stage,
        pages_processed: pagesProcessed,
        chunks_processed: chunksProcessed,
        candidates_extracted: candidatesExtracted,
        decisions_final: decisionsFinal,
        truncated,
        warnings,
        timing_ms: Date.now() - startedAt,
      };
      return buildErrorResponse(400, errorId, "Add PDFs or paste text to extract decisions.", undefined, meta);
    }

    const pages: PageText[] = [];
    let totalChars = 0;

    if (memo.trim()) {
      const remaining = Math.max(0, MAX_TOTAL_CHARS - totalChars);
      const slice = memo.trim().slice(0, remaining);
      if (slice.length < memo.trim().length) truncated = true;
      pages.push({ fileName: "Pasted text", pageNumber: 1, text: slice });
      totalChars += slice.length;
    }

    for (const file of validFiles) {
      if (pages.length >= MAX_PAGES) {
        truncated = true;
        warnings.push(`Processed only the first ${MAX_PAGES} pages for speed.`);
        break;
      }
      if (totalChars >= MAX_TOTAL_CHARS) {
        truncated = true;
        warnings.push(`Processed only the first ${MAX_TOTAL_CHARS.toLocaleString()} characters for speed.`);
        break;
      }
      let buffer: ArrayBuffer | null = null;
      try {
        buffer = await file.arrayBuffer();
        const pageTexts = await extractPdfTextByPage(buffer);
        for (const page of pageTexts) {
          if (pages.length >= MAX_PAGES) {
            truncated = true;
            warnings.push(`Processed only the first ${MAX_PAGES} pages for speed.`);
            break;
          }
          if (totalChars >= MAX_TOTAL_CHARS) {
            truncated = true;
            warnings.push(`Processed only the first ${MAX_TOTAL_CHARS.toLocaleString()} characters for speed.`);
            break;
          }
          const text = page.text.trim();
          if (!text) continue;
          const remaining = Math.max(0, MAX_TOTAL_CHARS - totalChars);
          const slice = text.slice(0, remaining);
          if (slice.length < text.length) truncated = true;
          pages.push({ fileName: file.name, pageNumber: page.pageNumber, text: slice });
          totalChars += slice.length;
        }
      } catch (error) {
        warnings.push("Page-aware extraction failed; used fallback parser (page citations approximated).");
        if (buffer) {
          try {
            const pdfParse = await getPdfParse();
            const parsed = await pdfParse(Buffer.from(buffer));
            const parsedText = typeof parsed?.text === "string" ? parsed.text.trim() : "";
            if (parsedText) {
              const remaining = Math.max(0, MAX_TOTAL_CHARS - totalChars);
              const slice = parsedText.slice(0, remaining);
              if (slice.length < parsedText.length) truncated = true;
              pages.push({ fileName: file.name, pageNumber: 1, text: slice });
              totalChars += slice.length;
            } else {
              warnings.push(`Unable to extract readable text from ${file.name}.`);
            }
          } catch (fallbackError) {
            warnings.push(`Fallback PDF parsing failed for ${file.name}.`);
            console.error("[decision-intake] PDF parse fallback failed", fallbackError);
          }
        } else {
          warnings.push(`Unable to extract text from ${file.name}.`);
        }
        console.error("[decision-intake] PDF extraction failed", error);
      }
    }

    if (pages.length === 0) {
      const meta: IntakeMeta = {
        stage,
        pages_processed: pagesProcessed,
        chunks_processed: chunksProcessed,
        candidates_extracted: candidatesExtracted,
        decisions_final: decisionsFinal,
        truncated,
        warnings,
        timing_ms: Date.now() - startedAt,
      };
      return buildErrorResponse(400, errorId, "No readable text found in the uploads.", undefined, meta);
    }

    pagesProcessed = pages.length;

    stage = "chunk";
    const chunks = buildChunks(pages);
    if (chunks.length > MAX_CHUNKS) {
      truncated = true;
      warnings.push(`Processed only the first ${MAX_CHUNKS} chunks for speed.`);
    }

    stage = "extract_candidates";
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = getModel();
    const chunksToProcess = chunks.slice(0, MAX_CHUNKS);
    const chunkResults = await runWithConcurrency(chunksToProcess, CHUNK_CONCURRENCY, (chunk) =>
      extractCandidatesFromChunk(client, model, chunk),
    );

    chunksProcessed = chunksToProcess.length;
    const rawCandidates: DecisionItem[] = [];
    for (const result of chunkResults) {
      if (result.warning) warnings.push(result.warning);
      rawCandidates.push(...result.candidates);
    }

    candidatesExtracted = rawCandidates.length;

    stage = "merge";
    const deduped = new Map<string, DecisionItem>();
    for (const candidate of rawCandidates) {
      const key = normalizeDecisionKey(candidate.decision);
      const existing = deduped.get(key);
      if (!existing || candidate.qualityScore >= existing.qualityScore) {
        deduped.set(key, candidate);
      }
    }

    const merged = [...deduped.values()].sort((a, b) => b.qualityScore - a.qualityScore);
    const limited = merged.slice(0, 80);
    if (merged.length > 80) {
      warnings.push("Trimmed decision list to the top 80 items for speed.");
    }
    if (limited.length < 20) {
      warnings.push("Fewer than 20 decisions were extracted. Provide more explicit decision language for richer output.");
    }

    decisionsFinal = limited.length;

    let summary: SummaryPayload | null = null;
    if (mode !== "extract" && limited.length > 0) {
      stage = "summarize";
      const summaryResult = await summarizeDecisions(client, model, limited);
      if (summaryResult.warning) warnings.push(summaryResult.warning);
      summary = summaryResult.summary;
    }

    stage = "done";
    const meta: IntakeMeta = {
      stage,
      pages_processed: pagesProcessed,
      chunks_processed: chunksProcessed,
      candidates_extracted: candidatesExtracted,
      decisions_final: decisionsFinal,
      truncated,
      warnings,
      timing_ms: Date.now() - startedAt,
    };

    return NextResponse.json({
      summary,
      decisions: limited.map(({ qualityScore, ...decision }) => decision),
      meta,
    } satisfies IntakeResponse);
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown error");
    console.error("[decision-intake]", {
      errorId,
      stage,
      message: err.message,
      stack: err.stack,
    });
    const meta: IntakeMeta = {
      stage,
      pages_processed: pagesProcessed,
      chunks_processed: chunksProcessed,
      candidates_extracted: candidatesExtracted,
      decisions_final: decisionsFinal,
      truncated,
      warnings,
      timing_ms: Date.now() - startedAt,
    };
    return buildErrorResponse(
      500,
      errorId,
      "Internal error while processing the decision intake.",
      err.message?.slice(0, 200),
      meta,
    );
  }
}
