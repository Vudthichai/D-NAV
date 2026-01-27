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
const MAX_PRIMARY_PAGES = 16;
const MAX_SECONDARY_PAGES = 14;
const MODEL_TIMEOUT_MS = 35_000;
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_CANDIDATES_PER_PAGE = 10;

const HARD_SYSTEM_PROMPT =
  "You extract ONLY explicit commitments and executed actions. Include clear commitments (will, plan, on track, scheduled, remain on track, preparations are underway, expect, target, begin, ramp, start of production) AND executed actions (completed, launched, unveiled, added, deployed, achieved). Output JSON object with a 'candidates' array of DecisionCandidate. Use ONLY the provided snippets; every item must include an exact quote from a snippet and a 1-indexed page number. No hallucinations.";
const SOFT_SYSTEM_PROMPT =
  "You extract implicit strategic decisions (intent, priorities, posture, sequencing, investment focus, deprioritization) and softer commitments (aim, expect, scheduled, remain on track, preparations are underway). These are decisions with lower confidence. Output JSON object with a 'candidates' array of DecisionCandidate with strength='soft'. Use ONLY the provided snippets; every item must include an exact quote from a snippet and a 1-indexed page number. No hallucinations.";

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
  "on track",
  "scheduled",
  "remain on track",
  "preparations are underway",
  "we expect",
  "expect",
  "expected",
  "target",
  "targets",
  "pilot production",
  "start of production",
  "ramp beginning",
  "volume production planned",
  "launch",
  "begin",
  "ramping",
  "ramp",
  "completed",
  "launched",
  "unveiled",
  "added",
  "deployed",
  "achieved",
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

const splitIntoSnippets = (text: string) => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const roughSplits = cleaned
    .split(/(?<=[.!?])\s+|;\s+|:\s+|\s-\s|\n+/g)
    .map((snippet) => snippet.trim())
    .filter((snippet) => snippet.length > 0);
  const snippets: string[] = [];
  for (const snippet of roughSplits) {
    if (snippet.length <= 360) {
      snippets.push(snippet);
    } else {
      for (let i = 0; i < snippet.length; i += 300) {
        snippets.push(snippet.slice(i, i + 300).trim());
      }
    }
  }
  return snippets;
};

const scoreSnippet = (snippet: string) => {
  const normalized = normalizeText(snippet);
  if (!normalized) return 0;
  let score = 0;
  for (const keyword of DECISION_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}\\b`, "g");
    const matches = normalized.match(regex);
    if (matches) score += matches.length * 2;
  }
  if (/\b(complete|completed|launch|launched|unveil|unveiled|added|deploy|deployed)\b/.test(normalized)) {
    score += 2;
  }
  if (/\b(2024|2025|2026|2027|q[1-4])\b/.test(normalized)) {
    score += 1;
  }
  return score;
};

const extractCandidateSnippets = (text: string, maxSnippets: number) => {
  const snippets = splitIntoSnippets(text);
  if (snippets.length <= maxSnippets) return snippets;
  const scored = snippets.map((snippet, index) => ({
    snippet,
    index,
    score: scoreSnippet(snippet),
  }));
  const sorted = scored
    .slice()
    .sort((a, b) => (b.score === a.score ? a.index - b.index : b.score - a.score));
  return sorted.slice(0, maxSnippets).map((item) => item.snippet);
};

const scorePageForDecisions = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  let score = 0;
  for (const keyword of DECISION_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}\\b`, "g");
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

const buildSnippetPages = (
  pages: Array<{ page: number; text: string }>,
  maxCandidatesPerPage: number,
) => {
  const snippetLimit = Math.min(14, Math.max(maxCandidatesPerPage, 8));
  return pages.map((page) => ({
    page: page.page,
    snippets: extractCandidateSnippets(page.text, snippetLimit),
  }));
};

const extractKeyTerms = (value: string) => {
  const words = normalizeText(value).split(" ");
  return new Set(words.filter((word) => word.length > 3 && !STOP_WORDS.has(word)));
};

const jaccardSimilarity = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const isDuplicateCandidate = (a: DecisionCandidate, b: DecisionCandidate) => {
  const normalizedTitleA = normalizeText(a.title);
  const normalizedTitleB = normalizeText(b.title);
  if (normalizedTitleA && normalizedTitleA === normalizedTitleB) return true;

  const termsA = extractKeyTerms(`${a.title} ${a.decision}`);
  const termsB = extractKeyTerms(`${b.title} ${b.decision}`);
  const similarity = jaccardSimilarity(termsA, termsB);
  return similarity >= 0.55;
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

const deriveDecision = (title: string, quote: string) => {
  if (title) return title;
  const trimmed = quote.trim();
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157).trim()}...`;
};

const deriveTitle = (decision: string, quote: string) => {
  if (decision) return decision;
  const trimmed = quote.trim();
  if (trimmed.length <= 100) return trimmed;
  return `${trimmed.slice(0, 97).trim()}...`;
};

const normalizeCandidate = (
  raw: unknown,
  strength: "hard" | "soft",
  index: number,
): { candidate: DecisionCandidate | null; droppedReason?: string } => {
  if (!raw || typeof raw !== "object") return { candidate: null, droppedReason: "invalid" };
  const candidate = raw as Record<string, unknown>;
  const evidence = candidate.evidence as { page?: unknown; quote?: unknown; locationHint?: unknown } | undefined;
  const page = typeof evidence?.page === "number" ? Math.round(evidence.page) : null;
  const quote = typeof evidence?.quote === "string" ? clampQuote(evidence.quote) : "";

  if (!page || page < 1 || !quote) return { candidate: null, droppedReason: "missing_evidence" };

  const titleRaw = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const decisionRaw = typeof candidate.decision === "string" ? candidate.decision.trim() : "";
  const rationaleRaw = typeof candidate.rationale === "string" ? candidate.rationale.trim() : "";

  const decision = decisionRaw || deriveDecision(titleRaw, quote);
  const title = titleRaw || deriveTitle(decision, quote);
  const rationale = rationaleRaw || "Stated commitment in document; see quote.";

  if (!title || !decision) {
    return { candidate: null, droppedReason: "missing_fields" };
  }

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
  if (!parsed.success) return { candidate: null, droppedReason: "schema" };
  return { candidate: parsed.data };
};

const extractJsonArray = (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as { candidates?: unknown };
    if (Array.isArray(parsed?.candidates)) {
      return parsed.candidates;
    }
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const parsed = JSON.parse(fenced[1]) as { candidates?: unknown };
    if (Array.isArray(parsed?.candidates)) return parsed.candidates;
    return parsed;
  }
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  return [];
};

const buildUserPrompt = (
  docName: string,
  pages: Array<{ page: number; snippets: string[] }>,
  maxPerPage: number,
) =>
  [
    "Return JSON object only with a top-level 'candidates' array. Follow this DecisionCandidate schema exactly for each item:",
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
    "Use ONLY the provided snippets as evidence. Quotes must be exact substrings of snippets.",
    `Document name: ${docName}`,
    "Pages JSON (snippets per page):",
    JSON.stringify(pages, null, 2),
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
  pages: Array<{ page: number; snippets: string[] }>;
  model: string;
  maxCandidatesPerPage: number;
  timeoutMs: number;
}) => {
  if (!process.env.OPENAI_API_KEY) {
    console.error("decision-extract missing OPENAI_API_KEY");
    return {
      candidates: [] as DecisionCandidate[],
      warning: "Missing OpenAI API key",
      durationMs: 0,
      rawCount: 0,
      droppedMissingFields: 0,
    };
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
        response_format: { type: "json_object" },
      }),
      timeoutMs,
    );
  } catch (error) {
    const warning = error instanceof Error && error.name === "TimeoutError" ? "Model timeout" : "Model error";
    console.error("decision-extract model error", warning);
    return {
      candidates: [] as DecisionCandidate[],
      warning,
      durationMs: Date.now() - start,
      rawCount: 0,
      droppedMissingFields: 0,
    };
  }

  const content = completion.choices[0]?.message?.content ?? "[]";
  let raw: unknown;
  try {
    raw = extractJsonArray(content);
  } catch (error) {
    console.error("decision-extract json parse error", error);
    return {
      candidates: [] as DecisionCandidate[],
      warning: "Model response invalid JSON",
      durationMs: Date.now() - start,
      rawCount: 0,
      droppedMissingFields: 0,
    };
  }
  if (!Array.isArray(raw)) {
    return {
      candidates: [] as DecisionCandidate[],
      warning: "Model response not array",
      durationMs: Date.now() - start,
      rawCount: Array.isArray(raw) ? raw.length : 0,
      droppedMissingFields: 0,
    };
  }
  let droppedMissingFields = 0;
  const candidates: DecisionCandidate[] = [];
  raw.forEach((item, index) => {
    const result = normalizeCandidate(item, strength, index);
    if (result.candidate) {
      candidates.push(result.candidate);
    } else if (result.droppedReason === "missing_fields") {
      droppedMissingFields += 1;
    }
  });
  return { candidates, durationMs: Date.now() - start, rawCount: raw.length, droppedMissingFields };
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
  const primarySnippetPages = buildSnippetPages(primaryPages, normalized.maxCandidatesPerPage);
  const secondarySnippetPages = buildSnippetPages(secondaryPages, normalized.maxCandidatesPerPage);
  const snippetCounts = {
    primary: primarySnippetPages.reduce((total, page) => total + page.snippets.length, 0),
    secondary: secondarySnippetPages.reduce((total, page) => total + page.snippets.length, 0),
  };

  if (totalChars > MAX_TOTAL_CHARS) {
    warnings.push("Input too large; limiting pages sent to model.");
  }

  console.info("decision-extract request", {
    docName: normalized.docName,
    pages: normalized.pages.length,
    totalChars,
    selectedPrimaryPages: primaryPages.length,
    selectedSecondaryPages: secondaryPages.length,
    primaryPageNumbers: primaryPages.map((page) => page.page),
    secondaryPageNumbers: secondaryPages.map((page) => page.page),
    snippetCounts,
  });

  let hardCandidates: DecisionCandidate[] = [];
  let softCandidates: DecisionCandidate[] = [];
  const extractPass = async (pages: Array<{ page: number; snippets: string[] }>, label: string) => {
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
      hardRaw: hardResult.rawCount,
      softRaw: softResult.rawCount,
      hardDroppedMissingFields: hardResult.droppedMissingFields,
      softDroppedMissingFields: softResult.droppedMissingFields,
    });

    return { hard: hardResult.candidates, soft: softResult.candidates };
  };

  const primaryResults = await extractPass(primarySnippetPages, "primary");
  hardCandidates = primaryResults.hard;
  softCandidates = primaryResults.soft;

  if (hardCandidates.length + softCandidates.length === 0 && secondarySnippetPages.length > 0) {
    const secondaryResults = await extractPass(secondarySnippetPages, "secondary");
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
