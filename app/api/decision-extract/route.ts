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
const MODEL_TIMEOUT_MS = 35_000;
const DEFAULT_MAX_CANDIDATES_PER_PAGE = 12;
const MODEL_PREFERENCE = ["gpt-4o", "gpt-4.1-mini", "gpt-4o-mini"] as const;

const REFINE_SYSTEM_PROMPT =
  "You refine existing decision candidates. Use ONLY the provided candidates and quotes; do not add new facts. Improve titles/decisions/rationales for clarity, adjust category/tags, and optionally drop obvious junk, but keep at least the minimum count requested. Evidence quotes and page numbers must stay unchanged. Output JSON with top-level 'candidates' array matching the DecisionCandidate schema.";

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

const resolveDefaultModel = () => {
  const envModel = process.env.OPENAI_MODEL ?? process.env.OPENAI_DEFAULT_MODEL;
  if (envModel && envModel.trim().length > 0) return envModel.trim();
  return MODEL_PREFERENCE[2];
};

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
      model: data.options?.model ?? resolveDefaultModel(),
    };
  }

  return {
    docName: data.doc.name,
    pageCount: data.doc.pageCount,
    pages: data.pages.map((page) => ({ page: page.page, text: page.text })),
    maxCandidatesPerPage: data.options.maxCandidatesPerPage ?? DEFAULT_MAX_CANDIDATES_PER_PAGE,
    model: data.options.model ?? resolveDefaultModel(),
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

const COMMITMENT_PHRASES = [
  "will",
  "scheduled",
  "scheduled to start",
  "plan",
  "plans",
  "planned",
  "expect",
  "expected",
  "on track",
  "remain on track",
  "preparations are underway",
  "begin",
  "ramp",
  "start",
  "starting",
  "launch",
  "launched",
  "continue to work on launching",
  "target",
  "aim",
  "volume production planned",
  "commission",
  "completed",
  "deployed",
  "delivered",
  "unveiled",
  "added",
  "achieved",
  "expanded",
];

const HARD_COMMITMENT_PHRASES = [
  "will",
  "scheduled",
  "scheduled to start",
  "volume production planned",
  "completed",
  "launched",
  "deployed",
  "delivered",
  "unveiled",
  "achieved",
  "commission",
  "added",
  "expanded",
];

const SOFT_COMMITMENT_PHRASES = [
  "expect",
  "expected",
  "on track",
  "remain on track",
  "preparations are underway",
  "aim",
  "target",
  "plan",
  "plans",
  "planned",
  "begin",
  "ramp",
  "start",
  "starting",
  "continue to work on launching",
];

const TIME_ANCHOR_PATTERNS = [
  /\bq[1-4]\b/i,
  /\b20\d{2}\b/,
  /\bthis quarter\b/i,
  /\bnext quarter\b/i,
  /\bfirst half\b/i,
  /\bsecond half\b/i,
  /\bby end of\b/i,
  /\bby the end of\b/i,
  /\bby mid\b/i,
];

const NUMBER_ANCHOR_PATTERN =
  /\b\d{1,3}(?:[.,]\d+)?\s?(%|k|m|b|bn|billion|million|gwh|gw|mw|kwh|mwh|h100|v4)?\b/i;

const CATEGORY_RULES: Array<{ category: (typeof CATEGORY_VALUES)[number]; match: RegExp }> = [
  { category: "Finance", match: /\b(cash|margin|capex|opex|free cash|profit|revenue|guidance)\b/i },
  { category: "Operations", match: /\b(factory|plant|megafactory|gigafactory|ramp|production|line|construction|build)\b/i },
  {
    category: "Product",
    match: /\b(fsd|autonomy|robotaxi|cybercab|cybertruck|semi|supercharger|battery|energy|powerwall|megapack|cortex|doj[oa])\b/i,
  },
  { category: "Sales/Go-to-market", match: /\b(launch|deliveries|orders|pricing|customers|market)\b/i },
  { category: "Strategy", match: /\b(strategy|strategic|priorit(y|ize)|focus|roadmap|platform)\b/i },
  { category: "Hiring", match: /\b(hire|hiring|headcount|talent|workforce)\b/i },
  { category: "Legal", match: /\b(regulatory|regulation|legal|compliance|approval|litigation)\b/i },
];

const TAG_RULES: Array<{ tag: string; match: RegExp }> = [
  { tag: "autonomy", match: /\b(fsd|autonomy|robotaxi)\b/i },
  { tag: "factory", match: /\b(factory|gigafactory|megafactory|plant)\b/i },
  { tag: "ramp", match: /\b(ramp|ramping|production)\b/i },
  { tag: "launch", match: /\b(launch|launched|unveiled)\b/i },
  { tag: "energy", match: /\b(energy|megapack|powerwall|battery)\b/i },
  { tag: "supercharger", match: /\b(supercharger|v4)\b/i },
  { tag: "cybercab", match: /\b(cybercab)\b/i },
  { tag: "semi", match: /\b(semi)\b/i },
  { tag: "cortex", match: /\b(cortex|h100)\b/i },
  { tag: "capex", match: /\b(capex|opex|investment)\b/i },
];

const hashText = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return Math.abs(hash).toString(36);
};

const splitIntoClauses = (text: string) => {
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/([a-zA-Z])\-\n([a-zA-Z])/g, "$1$2")
    .replace(/[•\u2022]/g, "•")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) return [] as string[];

  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const merged: string[] = [];
  let current = "";
  lines.forEach((line) => {
    const isBullet = /^[-–•]\s+/.test(line);
    if (isBullet) {
      if (current) {
        merged.push(current);
        current = "";
      }
      merged.push(line.replace(/^[-–•]\s+/, "").trim());
      return;
    }
    if (!current) {
      current = line;
      return;
    }
    const endsSentence = /[.!?]$/.test(current);
    const nextLooksContinuation = /^[a-z0-9(]/.test(line);
    if (!endsSentence && nextLooksContinuation) {
      current = `${current} ${line}`.trim();
    } else {
      merged.push(current);
      current = line;
    }
  });
  if (current) merged.push(current);

  const clauses: string[] = [];
  merged.forEach((line) => {
    line
      .split(/(?<=[.!?])\s+|;\s+|:\s+/)
      .map((clause) => clause.trim())
      .filter(Boolean)
      .forEach((clause) => clauses.push(clause));
  });
  return clauses;
};

const countPhraseHits = (normalized: string, phrases: string[]) => {
  let hits = 0;
  phrases.forEach((phrase) => {
    const pattern = new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "g");
    const matches = normalized.match(pattern);
    if (matches) hits += matches.length;
  });
  return hits;
};

const hasTimeAnchor = (normalized: string) => TIME_ANCHOR_PATTERNS.some((pattern) => pattern.test(normalized));

const hasNumberAnchor = (normalized: string) => NUMBER_ANCHOR_PATTERN.test(normalized);

const scoreClause = (normalized: string) => {
  const commitmentHits = countPhraseHits(normalized, COMMITMENT_PHRASES);
  if (commitmentHits === 0) return { score: 0, commitmentHits: 0 };
  const timeHits = TIME_ANCHOR_PATTERNS.reduce((count, pattern) => (pattern.test(normalized) ? count + 1 : count), 0);
  const numberHits = hasNumberAnchor(normalized) ? 1 : 0;
  const score = commitmentHits * 3 + timeHits * 2 + numberHits;
  return { score, commitmentHits };
};

const inferStrength = (normalized: string) => {
  if (countPhraseHits(normalized, HARD_COMMITMENT_PHRASES) > 0) return "hard";
  if (countPhraseHits(normalized, SOFT_COMMITMENT_PHRASES) > 0) return "soft";
  return "soft";
};

const buildTitle = (quote: string) => {
  const stripped = quote.replace(/^(In|By|During|For|As of|On)\s+[^,]{0,40},\s*/i, "").trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  const title = words.slice(0, 8).join(" ").replace(/[.,;:]+$/, "");
  return title || stripped || quote;
};

const buildDecision = (quote: string) => {
  const trimmed = quote.trim();
  if (trimmed.length <= 180) return trimmed;
  return `${trimmed.slice(0, 177).trim()}...`;
};

const buildRationale = (strength: "hard" | "soft") =>
  strength === "hard"
    ? "Stated in document; indicates a firm commitment or executed action."
    : "Stated in document; indicates an expected or planned action.";

const inferCategory = (quote: string) => {
  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(quote)) return rule.category;
  }
  return "Other";
};

const inferTags = (quote: string) => {
  const tags = TAG_RULES.filter((rule) => rule.match.test(quote)).map((rule) => rule.tag);
  return Array.from(new Set(tags));
};

const buildDefaultConstraints = (quote: string): DecisionCandidate["constraints"] =>
  SCORE_FIELDS.reduce(
    (acc, field) => {
      acc[field] = { score: 5, evidence: quote };
      return acc;
    },
    {} as DecisionCandidate["constraints"],
  );

const extractCandidatesLocal = (
  pages: Array<{ page: number; text: string }>,
  maxCandidatesPerPage: number,
) => {
  const perPageLimit = Math.min(8, Math.max(5, maxCandidatesPerPage));
  const candidates: Array<DecisionCandidate & { score: number }> = [];

  pages.forEach((page) => {
    const clauses = splitIntoClauses(page.text);
    const scoredClauses = clauses
      .map((clause, index) => {
        const cleaned = clause.replace(/\s+/g, " ").trim();
        if (cleaned.length < 40) return null;
        const normalized = normalizeText(cleaned);
        if (!normalized) return null;
        const { score, commitmentHits } = scoreClause(normalized);
        if (commitmentHits === 0) return null;
        const scoreBoost = (hasTimeAnchor(normalized) ? 2 : 0) + (hasNumberAnchor(normalized) ? 1 : 0);
        return { clause: cleaned, index, score: score + scoreBoost };
      })
      .filter(Boolean) as Array<{ clause: string; index: number; score: number }>;

    const topClauses = scoredClauses
      .slice()
      .sort((a, b) => (b.score === a.score ? a.index - b.index : b.score - a.score))
      .slice(0, perPageLimit);

    topClauses.forEach((item) => {
      const normalized = normalizeText(item.clause);
      const strength = inferStrength(normalized);
      const quote = clampQuote(item.clause);
      const title = buildTitle(quote);
      const decision = buildDecision(quote);
      const candidate: DecisionCandidate & { score: number } = {
        id: `local-${page.page}-${item.index}-${hashText(quote)}`,
        title,
        strength,
        category: inferCategory(quote),
        decision,
        rationale: buildRationale(strength),
        constraints: buildDefaultConstraints(quote),
        evidence: { page: page.page, quote },
        tags: inferTags(quote),
        score: item.score,
      };
      candidates.push(candidate);
    });
  });

  const sorted = candidates.sort((a, b) => (b.score === a.score ? a.evidence.page - b.evidence.page : b.score - a.score));
  return sorted.slice(0, 30).map(({ score: _score, ...candidate }) => candidate);
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
  return similarity >= 0.65;
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

const deriveDecision = (quote: string) => {
  const trimmed = quote.trim();
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157).trim()}...`;
};

const deriveTitle = (quote: string) => {
  const trimmed = quote.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const title = words.slice(0, 8).join(" ").replace(/[.,;:]+$/, "");
  if (title) return title;
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

  const decision = decisionRaw || deriveDecision(quote);
  const title = titleRaw || deriveTitle(quote);
  const rationale = rationaleRaw || "Extracted from document quote.";

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

const buildRefinePrompt = (
  docName: string,
  candidates: DecisionCandidate[],
  minCount: number,
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
    `Keep at least ${minCount} candidates (unless fewer were provided).`,
    "Do not invent evidence. Keep evidence.quote and evidence.page exactly as provided.",
    "Only remove obvious junk (boilerplate or irrelevant).",
    `Document name: ${docName}`,
    "Candidates JSON:",
    JSON.stringify(candidates, null, 2),
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

const refineCandidates = async ({
  docName,
  candidates,
  model,
  timeoutMs,
  minCount,
}: {
  docName: string;
  candidates: DecisionCandidate[];
  model: string;
  timeoutMs: number;
  minCount: number;
}) => {
  if (!process.env.OPENAI_API_KEY) {
    console.error("decision-extract missing OPENAI_API_KEY");
    return {
      candidates: [] as DecisionCandidate[],
      warning: "Missing OpenAI API key",
      durationMs: 0,
      rawCount: 0,
      droppedInvalid: 0,
    };
  }

  const openai = createOpenAIClient();
  const userPrompt = buildRefinePrompt(docName, candidates, minCount);
  const start = Date.now();
  let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>;
  try {
    completion = await withTimeout(
      openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: REFINE_SYSTEM_PROMPT },
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
      droppedInvalid: 0,
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
      droppedInvalid: 0,
    };
  }
  if (!Array.isArray(raw)) {
    return {
      candidates: [] as DecisionCandidate[],
      warning: "Model response not array",
      durationMs: Date.now() - start,
      rawCount: Array.isArray(raw) ? raw.length : 0,
      droppedInvalid: 0,
    };
  }
  let droppedInvalid = 0;
  const refined: DecisionCandidate[] = [];
  raw.forEach((item, index) => {
    const result = normalizeCandidate(item, "soft", index);
    if (result.candidate) {
      refined.push(result.candidate);
    } else {
      droppedInvalid += 1;
    }
  });
  return { candidates: refined, durationMs: Date.now() - start, rawCount: raw.length, droppedInvalid };
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
  console.info("decision-extract POST", {
    docName: normalized.docName,
    pages: normalized.pages.length,
  });
  const totalChars = normalized.pages.reduce((total, page) => total + page.text.length, 0);
  const warnings: string[] = [];
  if (totalChars > MAX_TOTAL_CHARS) {
    warnings.push("Input too large; extracting locally from full text.");
  }
  if (totalChars > FULL_TEXT_CHAR_LIMIT) {
    warnings.push("Large document; refine may be slower.");
  }

  const localCandidatesRaw = extractCandidatesLocal(normalized.pages, normalized.maxCandidatesPerPage);
  const localCandidates: DecisionCandidate[] = [];
  for (const candidate of localCandidatesRaw) {
    const existingIndex = localCandidates.findIndex((existing) => isDuplicateCandidate(existing, candidate));
    if (existingIndex === -1) {
      localCandidates.push(candidate);
    } else {
      localCandidates[existingIndex] = mergeCandidates(localCandidates[existingIndex], candidate);
    }
  }

  console.info("decision-extract local", {
    totalChars,
    pages: normalized.pages.length,
    localCandidates: localCandidates.length,
  });

  let refinedCandidates = localCandidates;
  let droppedInvalid = 0;
  if (process.env.OPENAI_API_KEY && localCandidates.length > 0) {
    const minCount = Math.min(12, localCandidates.length);
    const refineResult = await refineCandidates({
      docName: normalized.docName,
      candidates: localCandidates,
      model: normalized.model,
      timeoutMs: MODEL_TIMEOUT_MS,
      minCount,
    });
    droppedInvalid = refineResult.droppedInvalid;
    if (refineResult.warning) {
      warnings.push("Refine unavailable — showing local results");
      warnings.push(refineResult.warning);
    } else if (refineResult.candidates.length < minCount) {
      warnings.push("Refine unavailable — showing local results");
    } else {
      refinedCandidates = refineResult.candidates;
    }

    console.info("decision-extract refine", {
      refineMs: refineResult.durationMs,
      refinedCandidates: refineResult.candidates.length,
      rawCount: refineResult.rawCount,
      droppedInvalid,
    });
  } else if (!process.env.OPENAI_API_KEY) {
    warnings.push("Refine unavailable — showing local results");
  }

  const mergedCandidates: DecisionCandidate[] = [];
  for (const candidate of refinedCandidates) {
    const existingIndex = mergedCandidates.findIndex((existing) => isDuplicateCandidate(existing, candidate));
    if (existingIndex === -1) {
      mergedCandidates.push(candidate);
    } else {
      mergedCandidates[existingIndex] = mergeCandidates(mergedCandidates[existingIndex], candidate);
    }
  }

  console.info("decision-extract summary", {
    localCandidates: localCandidates.length,
    refinedCandidates: refinedCandidates.length,
    mergedCandidates: mergedCandidates.length,
    droppedInvalid,
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
