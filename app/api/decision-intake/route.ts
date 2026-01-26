import OpenAI from "openai";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { extractPdfTextByPage } from "@/lib/pdf/extractPdfText";

export const runtime = "nodejs";

type IntakeMode = "extract" | "summarize" | "extract+summarize";

type DecisionSource = {
  fileName: string;
  page: number;
};

type DecisionCandidate = {
  id: string;
  decision: string;
  evidence: string;
  source: DecisionSource;
  tags?: string[];
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

type ApiResponse = {
  summary: SummaryPayload | null;
  decisions: DecisionCandidate[];
  meta: {
    stage: "start" | "extract_text" | "chunk" | "extract" | "merge" | "summarize" | "done" | "error";
    pages_processed: number;
    chunks_processed: number;
    candidates_extracted: number;
    decisions_final: number;
    truncated: boolean;
    warnings: string[];
    timing_ms: number;
  };
  errorId?: string;
  error?: string;
};

type PageText = {
  fileName: string;
  page: number;
  text: string;
};

type PdfParseFn = (
  buffer: Buffer,
  options?: unknown,
) => Promise<{ text?: string } & Record<string, unknown>>;

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const CHUNK_CHAR_TARGET_MIN = 8_000;
const CHUNK_CHAR_TARGET_MAX = 12_000;
const MAX_TOTAL_CHARS = 250_000;
const MAX_PAGES = 20;
const MAX_CHUNKS = 8;
const MAX_CANDIDATES_PER_CHUNK = 25;
const OPENAI_TIMEOUT_MS = 18_000;
const CHUNK_CONCURRENCY = 2;

const normalizeDecisionKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const scoreDecision = (candidate: DecisionCandidate) => {
  let score = 0;
  if (/\d/.test(candidate.evidence)) score += 3;
  if (/\d/.test(candidate.decision)) score += 2;
  if (candidate.decision.length > 40) score += 2;
  if (candidate.evidence.length > 120) score += 1;
  return score;
};

const clampEvidence = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 220) return normalized;
  return `${normalized.slice(0, 217).trim()}…`;
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

const buildDecisionId = (candidate: DecisionCandidate) => {
  const hash = crypto
    .createHash("sha256")
    .update(`${candidate.decision}|${candidate.source.fileName}|${candidate.source.page}`)
    .digest("hex");
  return `dec_${hash.slice(0, 12)}`;
};

const getMode = (value: FormDataEntryValue | null): IntakeMode => {
  if (typeof value !== "string") return "extract+summarize";
  const normalized = value.trim() as IntakeMode;
  if (normalized === "extract" || normalized === "summarize" || normalized === "extract+summarize") {
    return normalized;
  }
  return "extract+summarize";
};

const createMeta = (): ApiResponse["meta"] => ({
  stage: "start",
  pages_processed: 0,
  chunks_processed: 0,
  candidates_extracted: 0,
  decisions_final: 0,
  truncated: false,
  warnings: [],
  timing_ms: 0,
});

const formatChunkText = (pages: PageText[]) =>
  pages
    .map((page) => `FILE: ${page.fileName} | PAGE: ${page.page}\n${page.text}`)
    .join("\n\n");

const parseCandidates = (raw: string): DecisionCandidate[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { candidates?: DecisionCandidate[] };
    if (!parsed || !Array.isArray(parsed.candidates)) return [];
    return parsed.candidates
      .filter((item) => item && typeof item.decision === "string" && typeof item.evidence === "string")
      .map((item) => ({
        id: "",
        decision: item.decision.trim(),
        evidence: clampEvidence(item.evidence),
        source: {
          fileName: item.source?.fileName ?? "Unknown",
          page: Number.isFinite(item.source?.page) ? Number(item.source.page) : 1,
        },
        tags: Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string") : undefined,
      }))
      .filter((item) => item.decision && item.evidence);
  } catch {
    return [];
  }
};

const parseSummary = (raw: string): SummaryPayload | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SummaryPayload;
    if (!parsed || !Array.isArray(parsed.key_decisions)) return null;
    return {
      key_decisions: parsed.key_decisions
        .filter((item) => item && typeof item.decision === "string")
        .map((item) => ({
          decision: item.decision.trim(),
          why_it_matters: item.why_it_matters?.trim() || undefined,
          source:
            item.source?.fileName && Number.isFinite(item.source.page)
              ? { fileName: item.source.fileName, page: Number(item.source.page) }
              : undefined,
        })),
      themes: Array.isArray(parsed.themes) ? parsed.themes.filter((item) => typeof item === "string") : undefined,
      unknowns: Array.isArray(parsed.unknowns)
        ? parsed.unknowns.filter((item) => typeof item === "string")
        : undefined,
    };
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  const meta = createMeta();
  const startedAt = Date.now();
  let summary: SummaryPayload | null = null;
  let decisions: DecisionCandidate[] = [];

  try {
    meta.stage = "extract_text";
    const formData = await request.formData();
    const memoValue = formData.get("memo");
    const mode = getMode(formData.get("mode"));
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    const pages: PageText[] = [];
    if (typeof memoValue === "string" && memoValue.trim()) {
      pages.push({ fileName: "Pasted text", page: 1, text: memoValue.trim() });
    }

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      try {
        const extracted = await extractPdfTextByPage(arrayBuffer);
        extracted.forEach((page) => {
          if (page.text?.trim()) {
            pages.push({ fileName: file.name, page: page.pageNumber, text: page.text.trim() });
          }
        });
      } catch (error) {
        const mod = (await import("pdf-parse")) as unknown as {
          default?: PdfParseFn;
          pdfParse?: PdfParseFn;
        };
        const pdfParse = mod.default ?? mod.pdfParse;
        if (!pdfParse) {
          throw new Error("pdf-parse did not expose a callable parser.");
        }
        const parsed = await pdfParse(Buffer.from(arrayBuffer));
        const text = typeof parsed?.text === "string" ? parsed.text : "";
        if (text.trim()) {
          pages.push({ fileName: file.name, page: 1, text: text.trim() });
        }
        meta.warnings.push(`Fallback pdf-parse used for ${file.name}; page citations are approximate.`);
      }
    }

    const limitedPages: PageText[] = [];
    let totalChars = 0;
    for (const page of pages) {
      if (limitedPages.length >= MAX_PAGES) {
        meta.warnings.push("Reached maximum page limit; remaining pages were skipped.");
        meta.truncated = true;
        break;
      }
      if (totalChars >= MAX_TOTAL_CHARS) {
        meta.warnings.push("Reached maximum character limit; remaining text was skipped.");
        meta.truncated = true;
        break;
      }
      const remaining = MAX_TOTAL_CHARS - totalChars;
      const text = page.text.length > remaining ? page.text.slice(0, remaining) : page.text;
      if (page.text.length > remaining) {
        meta.warnings.push("Input text was truncated to fit processing limits.");
        meta.truncated = true;
      }
      if (!text.trim()) continue;
      totalChars += text.length;
      limitedPages.push({ ...page, text });
    }

    meta.pages_processed = limitedPages.length;

    meta.stage = "chunk";
    const chunks: PageText[][] = [];
    let current: PageText[] = [];
    let currentChars = 0;

    const pushCurrent = () => {
      if (current.length) {
        chunks.push(current);
        current = [];
        currentChars = 0;
      }
    };

    for (const page of limitedPages) {
      const pageText = `FILE: ${page.fileName} | PAGE: ${page.page}\n${page.text}`;
      const incomingLength = pageText.length;
      if (current.length >= 2 || (currentChars + incomingLength > CHUNK_CHAR_TARGET_MAX && currentChars >= CHUNK_CHAR_TARGET_MIN)) {
        pushCurrent();
      }
      if (incomingLength > CHUNK_CHAR_TARGET_MAX && current.length === 0) {
        meta.warnings.push("A page exceeded the chunk limit and was truncated.");
        meta.truncated = true;
        current.push({ ...page, text: page.text.slice(0, CHUNK_CHAR_TARGET_MAX) });
        pushCurrent();
        continue;
      }
      current.push(page);
      currentChars += incomingLength;
    }
    pushCurrent();

    if (chunks.length > MAX_CHUNKS) {
      meta.warnings.push("Reached maximum chunk limit; remaining text was skipped.");
      meta.truncated = true;
      chunks.splice(MAX_CHUNKS);
    }

    meta.chunks_processed = chunks.length;

    if (chunks.length === 0) {
      meta.stage = "done";
      meta.timing_ms = Date.now() - startedAt;
      return NextResponse.json({ summary: null, decisions: [], meta } satisfies ApiResponse, { status: 200 });
    }

    meta.stage = "extract";
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const chunkResults = await runWithConcurrency(chunks, CHUNK_CONCURRENCY, async (chunk, index) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
      try {
        const body = {
          model: MODEL,
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You extract decision candidates with high recall. A decision is a committed intent under constraint. Write decision as verb-first, concise. Evidence must be <=220 chars. Include source fileName and page when possible. JSON only.",
            },
            {
              role: "user",
              content: [
                "Extract decision candidates from this chunk.",
                `Return JSON as { "candidates": [{ "decision": "", "evidence": "", "source": { "fileName": "", "page": 1 }, "tags": [] }] }`,
                `Limit to ${MAX_CANDIDATES_PER_CHUNK} candidates.`,
                "Chunk:",
                formatChunkText(chunk),
              ].join("\n\n"),
            },
          ],
        };

        const completion = await openai.chat.completions.create(body, { signal: controller.signal });
        const content = completion.choices[0]?.message?.content ?? "";
        return parseCandidates(content);
      } catch (error) {
        meta.warnings.push(`Chunk ${index + 1} extraction failed.`);
        return [];
      } finally {
        clearTimeout(timeout);
      }
    });

    const extractedCandidates = chunkResults.flat();
    meta.candidates_extracted = extractedCandidates.length;

    meta.stage = "merge";
    const deduped = new Map<string, DecisionCandidate>();
    for (const candidate of extractedCandidates) {
      const normalized = normalizeDecisionKey(candidate.decision);
      if (!normalized) continue;
      const existing = deduped.get(normalized);
      const enriched: DecisionCandidate = {
        ...candidate,
        evidence: clampEvidence(candidate.evidence),
        source: candidate.source ?? { fileName: "Unknown", page: 1 },
        id: "",
      };
      const scored = scoreDecision(enriched);
      if (!existing || scored > scoreDecision(existing)) {
        deduped.set(normalized, enriched);
      }
    }

    decisions = Array.from(deduped.values()).map((candidate) => ({
      ...candidate,
      id: buildDecisionId(candidate),
    }));

    decisions.sort((a, b) => scoreDecision(b) - scoreDecision(a));
    if (decisions.length > 80) {
      decisions = decisions.slice(0, 80);
    }

    meta.decisions_final = decisions.length;

    if (mode === "extract+summarize" || mode === "summarize") {
      meta.stage = "summarize";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
      try {
        const body = {
          model: MODEL,
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "Summarize decisions into 8-20 key bullets. Return JSON { key_decisions: [{ decision, why_it_matters, source }], themes: [], unknowns: [] }. JSON only.",
            },
            {
              role: "user",
              content: `Decisions:\n${JSON.stringify(decisions, null, 2)}`,
            },
          ],
        };

        const completion = await openai.chat.completions.create(body, { signal: controller.signal });
        const content = completion.choices[0]?.message?.content ?? "";
        summary = parseSummary(content);
        if (!summary) {
          meta.warnings.push("Summary response could not be parsed.");
        }
      } catch (error) {
        meta.warnings.push("Summary extraction failed.");
      } finally {
        clearTimeout(timeout);
      }
    }

    meta.stage = "done";
    meta.timing_ms = Date.now() - startedAt;

    return NextResponse.json({
      summary,
      decisions,
      meta,
    } satisfies ApiResponse);
  } catch (error) {
    const errorId = crypto.randomUUID();
    const message = error instanceof Error ? error.message : "Unknown error.";
    meta.stage = "error";
    meta.timing_ms = Date.now() - startedAt;
    console.error("Decision intake error", { errorId, message });
    return NextResponse.json(
      {
        summary: null,
        decisions: [],
        meta,
        errorId,
        error: message,
      } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
