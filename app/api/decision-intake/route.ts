import OpenAI from "openai";
import { NextResponse } from "next/server";
import { extractPdfTextByPage } from "@/lib/pdf/extractPdfText";

export const runtime = "nodejs";

type IntakeMode = "extract" | "summarize" | "extract+summarize";

type IntakeDecision = {
  id: string;
  decision: string;
  evidence: string;
  source: {
    fileName: string;
    page: number;
  };
};

type IntakeSummary = {
  key_decisions: Array<{
    decision: string;
    why_it_matters?: string;
    source?: {
      fileName: string;
      page: number;
    };
  }>;
  themes?: string[];
  unknowns?: string[];
};

type PageText = {
  fileName: string;
  page: number;
  text: string;
};

type Chunk = {
  fileName: string;
  pages: PageText[];
  text: string;
};

type Candidate = {
  decision: string;
  evidence: string;
  source: {
    fileName: string;
    page: number;
  };
  qualityScore: number;
};

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const MAX_PAGES = 20;
const MAX_CHUNKS = 8;
const MAX_TOTAL_CHARS = 250_000;
const TARGET_CHUNK_CHARS = 10_000;
const MAX_PAGES_PER_CHUNK = 2;
const MAX_CANDIDATES_PER_CHUNK = 25;
const CHUNK_CONCURRENCY = 2;
const OPENAI_TIMEOUT_MS = 18_000;

const createErrorId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `err_${Math.random().toString(36).slice(2, 10)}`;
};

const truncateSnippet = (value: string, limit = 220) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}…`;
};

const normalizeDecisionKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const scoreCandidate = (candidate: Candidate) => {
  let score = 0;
  if (/\d/.test(candidate.evidence)) score += 2;
  if (/(Q[1-4]|FY\d{2}|20\d{2}|\bnext\b|\bby\b|\bwithin\b|\bstarting\b)/i.test(candidate.evidence)) score += 2;
  if (candidate.decision.split(" ").length >= 4) score += 1;
  if (candidate.evidence.length >= 120) score += 1;
  return score;
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`Operation timed out after ${ms}ms`);
      error.name = "TimeoutError";
      reject(error);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
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

const parseJsonResponse = (content: string) => {
  try {
    return JSON.parse(content);
  } catch (error) {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (nestedError) {
      console.error("Failed to parse decision intake JSON.", nestedError);
      return null;
    }
  }
};

const buildChunks = (pages: PageText[]) => {
  const fileOrder: string[] = [];
  const grouped = new Map<string, PageText[]>();
  pages.forEach((page) => {
    if (!grouped.has(page.fileName)) {
      grouped.set(page.fileName, []);
      fileOrder.push(page.fileName);
    }
    grouped.get(page.fileName)?.push(page);
  });

  const chunks: Chunk[] = [];

  for (const fileName of fileOrder) {
    const filePages = grouped.get(fileName) ?? [];
    let current: PageText[] = [];
    let currentChars = 0;

    for (const page of filePages) {
      const pageChars = page.text.length;
      const shouldSplit =
        current.length >= MAX_PAGES_PER_CHUNK || (currentChars + pageChars > TARGET_CHUNK_CHARS && current.length > 0);
      if (shouldSplit) {
        const text = current.map((entry) => `Page ${entry.page}:\n${entry.text}`).join("\n\n");
        chunks.push({ fileName, pages: current, text });
        current = [];
        currentChars = 0;
      }
      current.push(page);
      currentChars += pageChars;
    }

    if (current.length > 0) {
      const text = current.map((entry) => `Page ${entry.page}:\n${entry.text}`).join("\n\n");
      chunks.push({ fileName, pages: current, text });
    }
  }

  return chunks;
};

const applyCaps = (pages: PageText[]) => {
  const capped: PageText[] = [];
  let totalChars = 0;
  let truncated = false;

  for (const page of pages) {
    if (capped.length >= MAX_PAGES) {
      truncated = true;
      break;
    }
    const remaining = MAX_TOTAL_CHARS - totalChars;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const text = page.text.slice(0, remaining);
    if (text.length < page.text.length) truncated = true;
    capped.push({ ...page, text });
    totalChars += text.length;
  }

  return { capped, truncated };
};

const extractPdfPages = async (file: File, warnings: string[]) => {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const pages = await extractPdfTextByPage(arrayBuffer);
    return pages.map((page) => ({ fileName: file.name, page: page.pageNumber, text: page.text }));
  } catch (error) {
    warnings.push("Primary PDF parser failed. Falling back to basic PDF extraction.");
    try {
      const mod = await import("pdf-parse");
      const parseFn =
        (mod as unknown as { default?: (buffer: Buffer) => Promise<{ text: string }> }).default ??
        (mod as unknown as { pdfParse?: (buffer: Buffer) => Promise<{ text: string }> }).pdfParse ??
        mod;
      const parsed = await parseFn(Buffer.from(arrayBuffer));
      const text = typeof parsed?.text === "string" ? parsed.text.trim() : "";
      if (!text) {
        warnings.push(`No text extracted from ${file.name}.`);
        return [];
      }
      warnings.push("Page citations approximated (fallback parser).");
      return [{ fileName: file.name, page: 1, text }];
    } catch (fallbackError) {
      console.error("Fallback PDF parser failed.", fallbackError);
      warnings.push(`Failed to extract text from ${file.name}.`);
      return [];
    }
  }
};

const extractCandidatesForChunk = async (client: OpenAI, chunk: Chunk) => {
  const systemPrompt =
    "You extract high-recall decision candidates from document text. A decision is committed intent under constraint (action + object + timing/constraint when present). Output verb-first decisions. Provide evidence snippet <= 220 chars. Include source page if known. Return JSON only: { candidates: [{ decision, evidence, source:{fileName,page}}] }.";

  const userPrompt = [`File: ${chunk.fileName}`, chunk.text, "Return JSON only."].join("\n\n");

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(content) as
    | {
        candidates?: Array<{ decision?: string; evidence?: string; source?: { fileName?: string; page?: number } }>;
      }
    | null;
  if (!parsed || !Array.isArray(parsed.candidates)) return [];

  return parsed.candidates
    .map((candidate) => {
      const decision = typeof candidate.decision === "string" ? candidate.decision.trim() : "";
      const evidence = typeof candidate.evidence === "string" ? truncateSnippet(candidate.evidence) : "";
      if (!decision || !evidence) return null;
      const page =
        typeof candidate.source?.page === "number" && Number.isFinite(candidate.source.page)
          ? Math.max(1, Math.round(candidate.source.page))
          : chunk.pages[0]?.page ?? 1;
      return {
        decision,
        evidence,
        source: {
          fileName:
            typeof candidate.source?.fileName === "string" && candidate.source.fileName.trim()
              ? candidate.source.fileName.trim()
              : chunk.fileName,
          page,
        },
        qualityScore: 0,
      } satisfies Candidate;
    })
    .filter(Boolean)
    .slice(0, MAX_CANDIDATES_PER_CHUNK) as Candidate[];
};

const mergeCandidates = (candidates: Candidate[]) => {
  const merged = new Map<string, Candidate>();
  candidates.forEach((candidate) => {
    const key = normalizeDecisionKey(candidate.decision);
    const scored = { ...candidate, qualityScore: scoreCandidate(candidate) };
    const existing = merged.get(key);
    if (!existing || scored.qualityScore > existing.qualityScore) {
      merged.set(key, scored);
    }
  });

  return Array.from(merged.values()).sort((a, b) => b.qualityScore - a.qualityScore);
};

const finalizeDecisions = (candidates: Candidate[]) => {
  const capped = candidates.slice(0, 80);
  return capped.map((candidate, index) => ({
    id: `decision_${index + 1}_${Math.random().toString(36).slice(2, 8)}`,
    decision: candidate.decision,
    evidence: candidate.evidence,
    source: candidate.source,
  })) satisfies IntakeDecision[];
};

const summarizeDecisions = async (client: OpenAI, decisions: IntakeDecision[]) => {
  if (decisions.length === 0) return null;

  const summaryPrompt = [
    "Input: JSON list of decisions with evidence + source.",
    "Output JSON:",
    "{ \"key_decisions\": [{ \"decision\": \"...\", \"why_it_matters\": \"...\", \"source\": { \"fileName\": \"...\", \"page\": 11 } }], \"themes\": [\"...\"], \"unknowns\": [\"...\"] }",
    "Limit key_decisions to 8–20.",
    "Return JSON only.",
  ].join("\n");

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: summaryPrompt },
      { role: "user", content: JSON.stringify(decisions, null, 2) },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(content) as IntakeSummary | null;
  if (!parsed || !Array.isArray(parsed.key_decisions)) return null;
  return parsed;
};

export async function POST(request: Request) {
  const timingStart = Date.now();
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ errorId: createErrorId() }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const memo = typeof formData.get("memo") === "string" ? (formData.get("memo") as string) : "";
    const mode = (formData.get("mode") as IntakeMode) ?? "extract+summarize";
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (!memo.trim() && files.length === 0) {
      return NextResponse.json({ errorId: createErrorId() }, { status: 400 });
    }

    const warnings: string[] = [];
    const pages: PageText[] = [];

    for (const file of files) {
      const extracted = await extractPdfPages(file, warnings);
      pages.push(...extracted);
    }

    if (memo.trim()) {
      pages.push({ fileName: "Memo", page: 1, text: memo.trim() });
    }

    const { capped, truncated } = applyCaps(pages);
    if (truncated) {
      warnings.push("Document truncated for serverless processing. Using excerpted pages only.");
    }

    const chunksAll = buildChunks(capped);
    let chunks = chunksAll;
    if (chunks.length > MAX_CHUNKS) {
      chunks = chunks.slice(0, MAX_CHUNKS);
      warnings.push("Too many chunks; processed the first excerpted chunks only.");
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const chunkResults = await runWithConcurrency(chunks, CHUNK_CONCURRENCY, async (chunk, index) => {
      try {
        return await withTimeout(extractCandidatesForChunk(client, chunk), OPENAI_TIMEOUT_MS);
      } catch (error) {
        warnings.push(`Chunk ${index + 1} timed out during extraction.`);
        return [] as Candidate[];
      }
    });

    const candidates = chunkResults.flat();
    const merged = mergeCandidates(candidates);
    const decisions = finalizeDecisions(merged);

    const shouldSummarize = mode === "summarize" || mode === "extract+summarize";
    const summary = shouldSummarize ? await summarizeDecisions(client, decisions) : null;

    const timingMs = Date.now() - timingStart;

    return NextResponse.json({
      summary,
      decisions,
      meta: {
        pages_processed: capped.length,
        chunks_processed: chunks.length,
        candidates_extracted: candidates.length,
        decisions_final: decisions.length,
        truncated,
        warnings,
        timing_ms: timingMs,
      },
    });
  } catch (error) {
    const errorId = createErrorId();
    console.error("Decision intake failed.", errorId, error);
    return NextResponse.json({ errorId }, { status: 500 });
  }
}
