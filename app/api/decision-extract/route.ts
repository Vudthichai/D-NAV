import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createHash } from "crypto";

const MAX_PAGES = 30;
const MAX_TOTAL_CHARS = 250_000;
const CHUNK_CHAR_LIMIT = 12_000;
const MAX_CANDIDATES = 40;

interface PagePayload {
  pageNumber: number;
  text: string;
}

interface DecisionExtractRequest {
  fileName: string | null;
  pages: PagePayload[];
}

interface CandidateDraft {
  decision: string;
  evidence: string;
  pageNumber: number;
}

interface CandidateFinal extends CandidateDraft {
  strength: "high" | "medium" | "low";
}

const isPagePayload = (value: unknown): value is PagePayload => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PagePayload>;
  return typeof candidate.pageNumber === "number" && typeof candidate.text === "string";
};

const normalizeRequest = (body: unknown) => {
  const warnings: string[] = [];
  const payload = body as Partial<DecisionExtractRequest>;
  const fileName = typeof payload?.fileName === "string" ? payload.fileName : null;
  const rawPages = Array.isArray(payload?.pages) ? payload.pages.filter(isPagePayload) : [];

  if (rawPages.length > MAX_PAGES) {
    warnings.push(`Only the first ${MAX_PAGES} pages were processed.`);
  }

  const trimmedPages = rawPages.slice(0, MAX_PAGES);
  const limitedPages: PagePayload[] = [];
  let remainingChars = MAX_TOTAL_CHARS;

  for (const page of trimmedPages) {
    if (remainingChars <= 0) break;
    const text = page.text.slice(0, remainingChars);
    if (text.length < page.text.length) {
      warnings.push(`Page ${page.pageNumber} was truncated to fit the character budget.`);
    }
    remainingChars -= text.length;
    limitedPages.push({ pageNumber: page.pageNumber, text });
  }

  if (remainingChars <= 0) {
    warnings.push(`Total text exceeded ${MAX_TOTAL_CHARS.toLocaleString()} characters.`);
  }

  return { fileName, pages: limitedPages, warnings };
};

const chunkPages = (pages: PagePayload[]) => {
  const chunks: string[] = [];
  let current = "";

  pages.forEach((page) => {
    const header = `=== Page ${page.pageNumber} ===\n${page.text.trim()}\n`;
    if (current.length + header.length > CHUNK_CHAR_LIMIT && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += `${header}\n`;
  });

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
};

const parseJsonObject = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const slice = value.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      return null;
    }
  }
};

const toCandidateDrafts = (value: unknown): CandidateDraft[] => {
  if (!value || typeof value !== "object") return [];
  const payload = value as { candidates?: unknown };
  if (!Array.isArray(payload.candidates)) return [];
  return payload.candidates.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<CandidateDraft>;
    const decision = typeof candidate.decision === "string" ? candidate.decision.trim() : "";
    const evidence = typeof candidate.evidence === "string" ? candidate.evidence.trim() : "";
    const pageNumber = typeof candidate.pageNumber === "number" ? candidate.pageNumber : Number(candidate.pageNumber);
    if (!decision || !evidence || !Number.isFinite(pageNumber)) return [];
    return [{ decision, evidence, pageNumber }];
  });
};

const toCandidateFinals = (value: unknown): CandidateFinal[] => {
  if (!value || typeof value !== "object") return [];
  const payload = value as { candidates?: unknown };
  if (!Array.isArray(payload.candidates)) return [];
  return payload.candidates.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<CandidateFinal>;
    const decision = typeof candidate.decision === "string" ? candidate.decision.trim() : "";
    const evidence = typeof candidate.evidence === "string" ? candidate.evidence.trim() : "";
    const pageNumber = typeof candidate.pageNumber === "number" ? candidate.pageNumber : Number(candidate.pageNumber);
    const strength =
      candidate.strength === "high" || candidate.strength === "medium" || candidate.strength === "low"
        ? candidate.strength
        : null;
    if (!decision || !evidence || !Number.isFinite(pageNumber) || !strength) return [];
    return [{ decision, evidence, pageNumber, strength }];
  });
};

const createDecisionId = (candidate: CandidateFinal) => {
  const hash = createHash("sha256")
    .update(`${candidate.decision}|${candidate.pageNumber}|${candidate.evidence}`)
    .digest("hex")
    .slice(0, 12);
  return `dec_${hash}`;
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { fileName, pages, warnings } = normalizeRequest(body);
  if (pages.length === 0) {
    return Response.json({ error: "No pages provided.", warnings }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const passACandidates: CandidateDraft[] = [];
  const chunks = chunkPages(pages);

  const systemMessage = `You extract decision candidates from documents.
A decision candidate is an explicit commitment under constraint: an intended action + object + (timing/constraint when present). Prefer verb-first phrasing.
Return JSON only.`;

  for (const chunk of chunks) {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemMessage },
      {
        role: "user",
        content: `Extract decision candidates from the text below.
Respond with JSON only in this schema:
{
  "candidates": [
    { "decision": "string", "evidence": "string", "pageNumber": number }
  ]
}

Text:
${chunk}`,
      },
    ];

    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject(content);
    const candidates = toCandidateDrafts(parsed);
    if (candidates.length === 0) {
      warnings.push("A chunk returned no usable candidates.");
      continue;
    }
    passACandidates.push(...candidates);
  }

  if (passACandidates.length === 0) {
    return Response.json({ candidates: [], warnings: [...warnings, "No candidates were extracted."] }, { status: 200 });
  }

  const refinementMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemMessage },
    {
      role: "user",
      content: `Refine the decision candidates below.
Tasks:
- Dedupe near-duplicates.
- Rewrite decisions to be verb-first commitments.
- Drop fluff.
- Assign strength based on:
  - high: explicit commitment language (will/plan/approved/scheduled/committed) + a date/number/clear constraint
  - medium: explicit intent but constraint is vague
  - low: implied intent / strategic language / weak commitment

Return JSON only in this schema:
{
  "candidates": [
    { "decision": "string", "evidence": "string", "pageNumber": number, "strength": "high|medium|low" }
  ]
}

Candidates:
${JSON.stringify({ fileName, candidates: passACandidates })}`,
    },
  ];

  const refinementResponse = await openai.chat.completions.create({
    model,
    messages: refinementMessages,
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const refinementContent = refinementResponse.choices[0]?.message?.content ?? "";
  const refinementParsed = parseJsonObject(refinementContent);
  const refinedCandidates = toCandidateFinals(refinementParsed).slice(0, MAX_CANDIDATES);
  const responseCandidates = refinedCandidates.map((candidate) => ({
    ...candidate,
    id: createDecisionId(candidate),
  }));

  const responseBody = warnings.length > 0 ? { candidates: responseCandidates, warnings } : { candidates: responseCandidates };
  return Response.json(responseBody, { status: 200 });
}

export async function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}
