import OpenAI from "openai";
import {
  decisionCandidateSchema,
  decisionExtractRequestSchema,
  decisionExtractResponseSchema,
  type DecisionCandidate,
  type DecisionExtractRequest,
} from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOTAL_CHARS = 250_000;
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_CANDIDATES_PER_PAGE = 6;

const HARD_SYSTEM_PROMPT =
  "You extract ONLY explicit commitments with commitment verbs (will, launch, begin, approved, signed, committed, decided, execute). Output JSON array of DecisionCandidate.";
const SOFT_SYSTEM_PROMPT =
  "You extract implicit strategic decisions (intent, priorities, posture, sequencing, investment focus, deprioritization). Output JSON array of DecisionCandidate with strength='soft'. No hallucinations: every candidate must include a direct quote and page number.";

const SCORE_FIELDS = ["impact", "cost", "risk", "urgency", "confidence"] as const;
const CATEGORY_VALUES = [
  "Operations",
  "Finance",
  "Product",
  "Hiring",
  "Legal",
  "Strategy",
  "Sales/Go-to-market",
  "Other",
] as const;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "these",
  "those",
  "into",
  "over",
  "after",
  "before",
  "about",
  "our",
  "their",
  "will",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "its",
  "they",
  "them",
  "but",
  "not",
  "than",
  "then",
  "also",
  "more",
  "less",
  "per",
  "via",
]);

export async function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}

const createOpenAIClient = () =>
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

type NormalizedRequest = {
  docName: string;
  pageCount: number;
  pages: Array<{ page: number; text: string }>;
  maxCandidatesPerPage: number;
  model: string;
};

const normalizeRequest = (data: DecisionExtractRequest): NormalizedRequest => {
  if ("docName" in data) {
    return {
      docName: data.docName,
      pageCount: data.pages.length,
      pages: data.pages,
      maxCandidatesPerPage: data.options?.maxCandidatesPerPage ?? DEFAULT_MAX_CANDIDATES_PER_PAGE,
      model: data.options?.model ?? DEFAULT_MODEL,
    };
  }

  return {
    docName: data.doc.name,
    pageCount: data.doc.pageCount,
    pages: data.pages.map((page) => ({ page: page.page, text: page.text })),
    maxCandidatesPerPage: data.options.maxCandidatesPerPage ?? DEFAULT_MAX_CANDIDATES_PER_PAGE,
    model: data.options.model ?? DEFAULT_MODEL,
  };
};

const clampQuote = (quote: string) => {
  const trimmed = quote.trim();
  if (trimmed.length <= 280) return trimmed;
  return `${trimmed.slice(0, 277).trim()}...`;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractKeyTerms = (value: string) => {
  const words = normalizeText(value).split(" ");
  return new Set(words.filter((word) => word.length > 3 && !STOP_WORDS.has(word)));
};

const isDuplicateCandidate = (a: DecisionCandidate, b: DecisionCandidate) => {
  const normalizedTitleA = normalizeText(a.title);
  const normalizedTitleB = normalizeText(b.title);
  if (normalizedTitleA && normalizedTitleA === normalizedTitleB) return true;

  if (a.evidence.page !== b.evidence.page) return false;
  const termsA = extractKeyTerms(`${a.title} ${a.decision}`);
  const termsB = extractKeyTerms(`${b.title} ${b.decision}`);
  if (termsA.size === 0 || termsB.size === 0) return false;
  let overlap = 0;
  for (const term of termsA) {
    if (termsB.has(term)) overlap += 1;
    if (overlap >= 2) return true;
  }
  return false;
};

const pickPreferredCandidate = (a: DecisionCandidate, b: DecisionCandidate) => {
  const strengthScore = (candidate: DecisionCandidate) => (candidate.strength === "hard" ? 2 : 1);
  const scoreA = strengthScore(a) * 10 + a.constraints.confidence.score;
  const scoreB = strengthScore(b) * 10 + b.constraints.confidence.score;
  if (scoreA === scoreB) return a;
  return scoreA > scoreB ? a : b;
};

const mergeCandidates = (a: DecisionCandidate, b: DecisionCandidate) => {
  const preferred = pickPreferredCandidate(a, b);
  const fallback = preferred === a ? b : a;
  const evidence =
    preferred.constraints.confidence.score >= fallback.constraints.confidence.score
      ? preferred.evidence
      : fallback.evidence;
  const tags = Array.from(new Set([...(a.tags ?? []), ...(b.tags ?? [])])).filter((tag) => tag.length > 0);

  return {
    ...preferred,
    decision: preferred.decision || fallback.decision,
    rationale: preferred.rationale || fallback.rationale,
    category: preferred.category || fallback.category,
    evidence,
    tags,
  };
};

const normalizeConstraint = (
  value: unknown,
  fallbackEvidence: string,
): { score: number; evidence: string } => {
  if (value && typeof value === "object") {
    const candidate = value as { score?: unknown; evidence?: unknown };
    const scoreValue =
      typeof candidate.score === "number" && Number.isFinite(candidate.score) ? Math.round(candidate.score) : 5;
    const score = Math.min(10, Math.max(1, scoreValue));
    const evidence =
      typeof candidate.evidence === "string" && candidate.evidence.trim().length > 0
        ? candidate.evidence.trim()
        : fallbackEvidence;
    return { score, evidence };
  }
  return { score: 5, evidence: fallbackEvidence };
};

const normalizeCandidate = (
  raw: unknown,
  strength: "hard" | "soft",
  index: number,
): DecisionCandidate | null => {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const evidence = candidate.evidence as { page?: unknown; quote?: unknown; locationHint?: unknown } | undefined;
  const page = typeof evidence?.page === "number" ? Math.round(evidence.page) : null;
  const quote = typeof evidence?.quote === "string" ? clampQuote(evidence.quote) : "";

  if (!page || page < 1 || !quote) return null;

  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const decision = typeof candidate.decision === "string" ? candidate.decision.trim() : "";
  const rationale = typeof candidate.rationale === "string" ? candidate.rationale.trim() : "";
  if (!title || !decision || !rationale) return null;

  const strengthValue = candidate.strength === "hard" || candidate.strength === "soft" ? candidate.strength : strength;
  const category =
    typeof candidate.category === "string" && CATEGORY_VALUES.includes(candidate.category as (typeof CATEGORY_VALUES)[number])
      ? (candidate.category as (typeof CATEGORY_VALUES)[number])
      : "Other";

  const tags = Array.isArray(candidate.tags)
    ? candidate.tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim())
    : [];

  const fallbackEvidence = quote;
  const constraintsSource = candidate.constraints as Record<string, unknown> | undefined;
  const constraints = SCORE_FIELDS.reduce(
    (acc, field) => {
      acc[field] = normalizeConstraint(constraintsSource?.[field], fallbackEvidence);
      return acc;
    },
    {} as DecisionCandidate["constraints"],
  );

  const normalized: DecisionCandidate = {
    id:
      typeof candidate.id === "string" && candidate.id.trim().length > 0
        ? candidate.id.trim()
        : `candidate-${strength}-${page}-${index}`,
    title,
    strength: strengthValue,
    category,
    decision,
    rationale,
    constraints,
    evidence: {
      page,
      quote,
      locationHint: typeof evidence?.locationHint === "string" ? evidence.locationHint.trim() : undefined,
    },
    tags,
  };

  const parsed = decisionCandidateSchema.safeParse(normalized);
  if (!parsed.success) return null;
  return parsed.data;
};

const extractJsonArray = (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1]);
  }
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  return [];
};

const buildUserPrompt = (docName: string, pages: Array<{ page: number; text: string }>, maxPerPage: number) =>
  [
    "Return JSON array only. Follow this DecisionCandidate schema exactly:",
    `{
  "id": "string",
  "title": "string",
  "strength": "hard | soft",
  "category": "Operations | Finance | Product | Hiring | Legal | Strategy | Sales/Go-to-market | Other",
  "decision": "string",
  "rationale": "string",
  "constraints": {
    "impact": { "score": 1-10, "evidence": "string" },
    "cost": { "score": 1-10, "evidence": "string" },
    "risk": { "score": 1-10, "evidence": "string" },
    "urgency": { "score": 1-10, "evidence": "string" },
    "confidence": { "score": 1-10, "evidence": "string" }
  },
  "evidence": { "page": 1, "quote": "<=280 chars", "locationHint": "optional" },
  "tags": ["string"]
}`,
    `Limit to at most ${maxPerPage} candidates per page.`,
    `Document name: ${docName}`,
    "Pages JSON:",
    JSON.stringify(
      pages.map((page) => ({ page: page.page, text: page.text })),
      null,
      2,
    ),
  ].join("\n");

const extractCandidates = async ({
  strength,
  systemPrompt,
  docName,
  pages,
  model,
  maxCandidatesPerPage,
}: {
  strength: "hard" | "soft";
  systemPrompt: string;
  docName: string;
  pages: Array<{ page: number; text: string }>;
  model: string;
  maxCandidatesPerPage: number;
}) => {
  if (!process.env.OPENAI_API_KEY) {
    console.error("decision-extract missing OPENAI_API_KEY");
    return [];
  }

  const openai = createOpenAIClient();
  const userPrompt = buildUserPrompt(docName, pages, maxCandidatesPerPage);
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "[]";
  let raw: unknown;
  try {
    raw = extractJsonArray(content);
  } catch (error) {
    console.error("decision-extract json parse error", error);
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => normalizeCandidate(item, strength, index))
    .filter((item): item is DecisionCandidate => Boolean(item));
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const issues = [{ message: "Invalid JSON payload.", path: [], code: "custom" }];
    console.warn("decision-extract invalid json", issues);
    return Response.json({ error: "Invalid request", issues }, { status: 400 });
  }

  const parsed = decisionExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("decision-extract validation issues", parsed.error.issues);
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const normalized = normalizeRequest(parsed.data);
  const totalChars = normalized.pages.reduce((total, page) => total + page.text.length, 0);

  if (process.env.NODE_ENV !== "production") {
    console.info("decision-extract request", {
      docName: normalized.docName,
      pages: normalized.pages.length,
      totalChars,
    });
  }

  if (totalChars > MAX_TOTAL_CHARS) {
    return Response.json(
      {
        error: "Payload too large",
        message: `Total text exceeds ${MAX_TOTAL_CHARS.toLocaleString()} characters.`,
        totalChars,
        limit: MAX_TOTAL_CHARS,
      },
      { status: 413 },
    );
  }

  let hardCandidates: DecisionCandidate[] = [];
  let softCandidates: DecisionCandidate[] = [];
  try {
    hardCandidates = await extractCandidates({
      strength: "hard",
      systemPrompt: HARD_SYSTEM_PROMPT,
      docName: normalized.docName,
      pages: normalized.pages,
      model: normalized.model,
      maxCandidatesPerPage: normalized.maxCandidatesPerPage,
    });
    softCandidates = await extractCandidates({
      strength: "soft",
      systemPrompt: SOFT_SYSTEM_PROMPT,
      docName: normalized.docName,
      pages: normalized.pages,
      model: normalized.model,
      maxCandidatesPerPage: normalized.maxCandidatesPerPage,
    });
  } catch (error) {
    console.error("decision-extract model error", error);
  }

  const mergedCandidates: DecisionCandidate[] = [];
  for (const candidate of [...hardCandidates, ...softCandidates]) {
    const existingIndex = mergedCandidates.findIndex((existing) => isDuplicateCandidate(existing, candidate));
    if (existingIndex === -1) {
      mergedCandidates.push(candidate);
    } else {
      mergedCandidates[existingIndex] = mergeCandidates(mergedCandidates[existingIndex], candidate);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("decision-extract debug", {
      hardCandidates: hardCandidates.length,
      softCandidates: softCandidates.length,
      mergedCandidates: mergedCandidates.length,
      sampleTitles: mergedCandidates.slice(0, 2).map((candidate) => candidate.title),
    });
  }

  const responseBody = {
    doc: { name: normalized.docName, pageCount: normalized.pageCount },
    candidates: mergedCandidates,
    meta: { pagesReceived: normalized.pages.length, totalChars },
  };

  const responseValidation = decisionExtractResponseSchema.safeParse(responseBody);
  if (!responseValidation.success) {
    console.error("decision-extract response validation failed", responseValidation.error.issues);
    return Response.json({ doc: responseBody.doc, candidates: [], meta: responseBody.meta }, { status: 200 });
  }

  return Response.json(responseValidation.data, { status: 200 });
}
