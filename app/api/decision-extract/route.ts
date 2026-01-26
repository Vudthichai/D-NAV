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
const FULL_TEXT_CHAR_LIMIT = 90_000;
const MAX_PRIMARY_PAGES = 10;
const MAX_SECONDARY_PAGES = 8;
const MODEL_TIMEOUT_MS = 20_000;
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_CANDIDATES_PER_PAGE = 6;

const HARD_SYSTEM_PROMPT =
  "You extract ONLY explicit commitments and concrete decisions. Include only statements with clear commitment verbs (will, launch, begin, approved, signed, committed, decided, execute). Output JSON array of DecisionCandidate. Every item must include a direct quote and a 1-indexed page number.";
const SOFT_SYSTEM_PROMPT =
  "You extract implicit strategic decisions (intent, priorities, posture, sequencing, investment focus, deprioritization). These are decisions with lower confidence. Output JSON array of DecisionCandidate with strength='soft'. Every item must include a direct quote and a 1-indexed page number. No hallucinations.";

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

const DECISION_KEYWORDS = [
  "will",
  "plan",
  "plans",
  "expect",
  "expected",
  "target",
  "targets",
  "launch",
  "begin",
  "prioritize",
  "prioritizing",
  "invest",
  "investing",
  "defer",
  "deferring",
  "approve",
  "approved",
  "expand",
  "expanding",
  "focus",
  "guidance",
  "outlook",
  "strategy",
  "strategic",
  "positioned",
  "aim",
  "aims",
  "delay",
  "delaying",
];

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

const scorePageForDecisions = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  let score = 0;
  for (const keyword of DECISION_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "g");
    const matches = normalized.match(regex);
    if (matches) score += matches.length;
  }
  return score;
};

const selectDecisionPages = (
  pages: Array<{ page: number; text: string }>,
  maxPages: number,
) => {
  if (pages.length <= maxPages) return pages;
  const scored = pages.map((page, index) => ({
    page,
    index,
    score: scorePageForDecisions(page.text),
  }));
  const sorted = scored
    .slice()
    .sort((a, b) => (b.score === a.score ? a.index - b.index : b.score - a.score));
  const selected = sorted.slice(0, maxPages).map((item) => item.page);
  const pageOrder = new Set(selected.map((page) => page.page));
  return pages.filter((page) => pageOrder.has(page.page));
};

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

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error("Model timeout");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const extractCandidates = async ({
  strength,
  systemPrompt,
  docName,
  pages,
  model,
  maxCandidatesPerPage,
  timeoutMs,
}: {
  strength: "hard" | "soft";
  systemPrompt: string;
  docName: string;
  pages: Array<{ page: number; text: string }>;
  model: string;
  maxCandidatesPerPage: number;
  timeoutMs: number;
}) => {
  if (!process.env.OPENAI_API_KEY) {
    console.error("decision-extract missing OPENAI_API_KEY");
    return { candidates: [] as DecisionCandidate[], warning: "Missing OpenAI API key", durationMs: 0 };
  }

  const openai = createOpenAIClient();
  const userPrompt = buildUserPrompt(docName, pages, maxCandidatesPerPage);
  const start = Date.now();
  let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>;
  try {
    completion = await withTimeout(
      openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      timeoutMs,
    );
  } catch (error) {
    const warning = error instanceof Error && error.name === "TimeoutError" ? "Model timeout" : "Model error";
    console.error("decision-extract model error", warning);
    return { candidates: [] as DecisionCandidate[], warning, durationMs: Date.now() - start };
  }

  const content = completion.choices[0]?.message?.content ?? "[]";
  let raw: unknown;
  try {
    raw = extractJsonArray(content);
  } catch (error) {
    console.error("decision-extract json parse error", error);
    return { candidates: [] as DecisionCandidate[], warning: "Model response invalid JSON", durationMs: Date.now() - start };
  }
  if (!Array.isArray(raw)) {
    return { candidates: [] as DecisionCandidate[], warning: "Model response not array", durationMs: Date.now() - start };
  }
  const candidates = raw
    .map((item, index) => normalizeCandidate(item, strength, index))
    .filter((item): item is DecisionCandidate => Boolean(item));
  return { candidates, durationMs: Date.now() - start };
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn("decision-extract invalid json");
    return Response.json({ error: "Request body failed validation." }, { status: 400 });
  }

  const parsed = decisionExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("decision-extract validation issues", parsed.error.issues);
    return Response.json({ error: "Request body failed validation." }, { status: 400 });
  }

  const normalized = normalizeRequest(parsed.data);
  const totalChars = normalized.pages.reduce((total, page) => total + page.text.length, 0);
  const warnings: string[] = [];
  const shouldLimitPages =
    totalChars > FULL_TEXT_CHAR_LIMIT || normalized.pages.length > MAX_PRIMARY_PAGES;
  const primaryPages = shouldLimitPages
    ? selectDecisionPages(normalized.pages, MAX_PRIMARY_PAGES)
    : normalized.pages;
  const primaryPageSet = new Set(primaryPages.map((page) => page.page));
  const secondaryPages = shouldLimitPages
    ? selectDecisionPages(
        normalized.pages.filter((page) => !primaryPageSet.has(page.page)),
        MAX_SECONDARY_PAGES,
      )
    : [];

  if (totalChars > MAX_TOTAL_CHARS) {
    warnings.push("Input too large; limiting pages sent to model.");
  }

  console.info("decision-extract request", {
    docName: normalized.docName,
    pages: normalized.pages.length,
    totalChars,
    selectedPrimaryPages: primaryPages.length,
    selectedSecondaryPages: secondaryPages.length,
  });

  let hardCandidates: DecisionCandidate[] = [];
  let softCandidates: DecisionCandidate[] = [];
  const extractPass = async (pages: Array<{ page: number; text: string }>, label: string) => {
    const hardResult = await extractCandidates({
      strength: "hard",
      systemPrompt: HARD_SYSTEM_PROMPT,
      docName: normalized.docName,
      pages,
      model: normalized.model,
      maxCandidatesPerPage: normalized.maxCandidatesPerPage,
      timeoutMs: MODEL_TIMEOUT_MS,
    });
    const softResult = await extractCandidates({
      strength: "soft",
      systemPrompt: SOFT_SYSTEM_PROMPT,
      docName: normalized.docName,
      pages,
      model: normalized.model,
      maxCandidatesPerPage: normalized.maxCandidatesPerPage,
      timeoutMs: MODEL_TIMEOUT_MS,
    });

    if (hardResult.warning) warnings.push(hardResult.warning);
    if (softResult.warning) warnings.push(softResult.warning);

    console.info("decision-extract pass timing", {
      label,
      hardMs: hardResult.durationMs,
      softMs: softResult.durationMs,
      hardCandidates: hardResult.candidates.length,
      softCandidates: softResult.candidates.length,
    });

    return { hard: hardResult.candidates, soft: softResult.candidates };
  };

  const primaryResults = await extractPass(primaryPages, "primary");
  hardCandidates = primaryResults.hard;
  softCandidates = primaryResults.soft;

  if (hardCandidates.length + softCandidates.length === 0 && secondaryPages.length > 0) {
    const secondaryResults = await extractPass(secondaryPages, "secondary");
    hardCandidates = [...hardCandidates, ...secondaryResults.hard];
    softCandidates = [...softCandidates, ...secondaryResults.soft];
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

  console.info("decision-extract summary", {
    hardCandidates: hardCandidates.length,
    softCandidates: softCandidates.length,
    mergedCandidates: mergedCandidates.length,
    sampleTitles: mergedCandidates.slice(0, 2).map((candidate) => candidate.title),
  });

  const uniqueWarnings = Array.from(new Set(warnings));
  const responseBody = {
    doc: { name: normalized.docName, pageCount: normalized.pageCount },
    candidates: mergedCandidates,
    meta: {
      pagesReceived: normalized.pages.length,
      totalChars,
      warnings: uniqueWarnings.length ? uniqueWarnings : undefined,
    },
  };

  const responseValidation = decisionExtractResponseSchema.safeParse(responseBody);
  if (!responseValidation.success) {
    console.error("decision-extract response validation failed", responseValidation.error.issues);
    return Response.json({ doc: responseBody.doc, candidates: [], meta: responseBody.meta }, { status: 200 });
  }

  return Response.json(responseValidation.data, { status: 200 });
}
