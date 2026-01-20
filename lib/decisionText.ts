import { normalizePrecision, type TimingPrecision } from "@/utils/timingPrecision";

const FOOTNOTE_NOISE = /\[(?:\d+|[a-z])\]|\(\d+\)/gi;
const BULLET_PREFIX = /^[•\-\u2022]\s*/gm;
const MULTI_SPACE = /\s+/g;
const NEWLINE = /\r\n|\r/g;

const NEGATIVE_PREFIXES = [
  "summary highlights",
  "summary of",
  "definition",
  "definitions",
  "footnote",
  "table",
  "results",
  "performance",
];

const COMMITMENT_TERMS = [
  "will",
  "plan to",
  "plans to",
  "committed to",
  "commit to",
  "approved",
  "decided to",
  "intend to",
  "expects to",
  "expect to",
  "aim to",
  "aims to",
  "begin",
  "launch",
  "ramp",
  "expand",
  "increase",
  "reduce",
  "invest",
  "build",
  "deploy",
  "discontinue",
  "exit",
];

const ALLOCATION_TERMS = [
  "spend",
  "invest",
  "allocate",
  "hire",
  "build",
  "expand",
  "open",
  "acquire",
  "fund",
  "scale",
];

const CONSTRAINT_TERMS = [
  "cap",
  "limit",
  "freeze",
  "pause",
  "stop",
  "avoid",
  "delay",
  "reduce",
  "cut",
  "exit",
];

const TARGET_TERMS = [
  "ship",
  "launch",
  "release",
  "deliver",
  "reach",
  "achieve",
  "roll out",
  "rollout",
  "introduce",
];

const TIMING_TERMS = ["by", "before", "in 20", "q1", "q2", "q3", "q4", "next quarter", "next year"];


const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "by",
  "with",
  "will",
  "plan",
  "plans",
  "company",
  "team",
]);

const TABLE_HEADERS = [
  "financial summary",
  "key metrics",
  "income statement",
  "balance sheet",
  "cash flow",
  "cash flows",
  "segment results",
  "quarterly results",
  "consolidated results",
];

const BOILERPLATE_PATTERNS: RegExp[] = [
  /forward-looking statements/i,
  /non-gaap/i,
  /unaudited/i,
  /see accompanying/i,
  /table of contents/i,
  /safe harbor/i,
  /dollars in millions/i,
  /all amounts in/i,
];

const COMMITMENT_SCORE_TERMS: Array<{ term: string; score: number }> = [
  { term: "committed to", score: 4 },
  { term: "commit to", score: 4 },
  { term: "will", score: 3 },
  { term: "plans to", score: 3 },
  { term: "plan to", score: 3 },
  { term: "expects to", score: 2 },
  { term: "expect to", score: 2 },
  { term: "aims to", score: 2 },
  { term: "aim to", score: 2 },
  { term: "intends to", score: 2 },
  { term: "intend to", score: 2 },
  { term: "begin", score: 1 },
  { term: "launch", score: 1 },
  { term: "ramp", score: 1 },
  { term: "expand", score: 1 },
  { term: "increase", score: 1 },
  { term: "reduce", score: 1 },
  { term: "invest", score: 1 },
  { term: "build", score: 1 },
  { term: "deploy", score: 1 },
  { term: "discontinue", score: 1 },
  { term: "exit", score: 1 },
];

const detectActor = (text: string) => {
  const actorMatch = text.match(/\b(Tesla|Company|Management|Board|Team|We)\b/i);
  if (!actorMatch) return "Company";
  const actor = actorMatch[0];
  if (actor.toLowerCase() === "we") return "Company";
  if (actor.toLowerCase() === "company") return "Company";
  if (actor.toLowerCase() === "management") return "Management";
  if (actor.toLowerCase() === "board") return "Board";
  if (actor.toLowerCase() === "team") return "Team";
  return actor;
};

const countDigits = (text: string) => (text.match(/\d/g) ?? []).length;

const digitRatio = (text: string) => {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return 0;
  return countDigits(compact) / compact.length;
};

const countQuarterTokens = (text: string) => {
  const matches = text.match(/\bQ[1-4](?:\s|-)?(?:20\d{2})?\b/gi);
  return matches ? matches.length : 0;
};

const countYearTokens = (text: string) => {
  const matches = text.match(/\b20\d{2}\b/g);
  return matches ? matches.length : 0;
};

const isAllCapsHeader = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;
  return trimmed === trimmed.toUpperCase() && /^[A-Z\s&-]+$/.test(trimmed);
};

const stripTableJunkSegments = (text: string) => {
  const segments = text
    .split(/(?:[.!?;]|(?:\s\|\s)|(?:\s-\s))/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const cleanedSegments = segments.filter((segment) => {
    const lower = segment.toLowerCase();
    if (digitRatio(segment) > 0.28) return false;
    if (countQuarterTokens(segment) >= 2) return false;
    if (countYearTokens(segment) >= 3) return false;
    if ((segment.match(/,/g) ?? []).length >= 4 && digitRatio(segment) > 0.15) return false;
    if (TABLE_HEADERS.some((header) => lower.includes(header))) return false;
    if (isAllCapsHeader(segment)) return false;
    return true;
  });
  return cleanedSegments.join(". ");
};

const isNumericRow = (text: string) => {
  if (!text.trim()) return false;
  if (!/[\d]/.test(text)) return false;
  if (!/^[\d\s,.$%()\-–—/]+$/.test(text.trim())) return false;
  return countDigits(text) >= 6;
};

const isBoilerplateLine = (text: string) =>
  BOILERPLATE_PATTERNS.some((pattern) => pattern.test(text));

const filterExcerptLines = (text: string) => {
  const lines = text
    .replace(NEWLINE, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const filtered = lines.filter((line) => {
    const lower = line.toLowerCase();
    if (line.length < 12) return false;
    if (isNumericRow(line)) return false;
    if (digitRatio(line) > 0.28) return false;
    if (countQuarterTokens(line) >= 2) return false;
    if (countYearTokens(line) >= 3) return false;
    if (TABLE_HEADERS.some((header) => lower.includes(header))) return false;
    if (isAllCapsHeader(line)) return false;
    if (isBoilerplateLine(line)) return false;
    return true;
  });
  return filtered.join(" ");
};

const splitSentences = (text: string) =>
  text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const normalizeModal = (modal: string) => {
  const lowered = modal.toLowerCase();
  if (lowered === "plan to") return "plans to";
  if (lowered === "plans to") return "plans to";
  if (lowered === "expect to") return "expects to";
  if (lowered === "expects to") return "expects to";
  if (lowered === "aim to") return "aims to";
  if (lowered === "aims to") return "aims to";
  if (lowered === "intend to") return "intends to";
  if (lowered === "intends to") return "intends to";
  if (lowered === "commit to") return "committed to";
  if (lowered === "committed to") return "committed to";
  return lowered;
};

const commitmentScore = (text: string) => {
  const lower = text.toLowerCase();
  return COMMITMENT_SCORE_TERMS.reduce((score, term) => (lower.includes(term.term) ? score + term.score : score), 0);
};

const pickCommitmentSentence = (text: string) => {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return text.trim();
  let best = sentences[0];
  let bestScore = commitmentScore(best);
  sentences.slice(1).forEach((sentence) => {
    const score = commitmentScore(sentence);
    if (score > bestScore) {
      best = sentence;
      bestScore = score;
    }
  });
  return best;
};

const buildDecisionStatement = (text: string) => {
  const cleaned = text.replace(MULTI_SPACE, " ").trim();
  if (!cleaned) return "";
  const actor = detectActor(cleaned) || "Company";
  const modalMatch = cleaned.match(
    /\b(will|plans? to|plan to|expects? to|expect to|aims? to|aim to|committed to|commit to|intends? to|intend to)\b\s+([^.;]+)/i,
  );
  if (modalMatch) {
    const modal = normalizeModal(modalMatch[1]);
    const action = modalMatch[2].trim();
    return `${actor} ${modal} ${action}`.replace(MULTI_SPACE, " ").trim();
  }
  const action = cleaned.replace(/^(?:the\s+)?(?:company|management|board|team|we)\b\s*/i, "").trim();
  if (!action) return "";
  return `${actor} will ${action}`.replace(MULTI_SPACE, " ").trim();
};

const shortenTitle = (text: string) => {
  let title = text.replace(/\s*\([^)]*\)/g, "").trim();
  if (title.length > 80) {
    title = title.split(",")[0]?.trim() ?? title;
  }
  if (title.length > 80) {
    title = title.slice(0, 80).trim();
  }
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length > 14) {
    title = words.slice(0, 14).join(" ");
  }
  return title;
};

const normalizeTitleTokens = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));

export const cleanExcerpt = (excerpt: string): string => {
  if (!excerpt) return "";
  return excerpt
    .replace(FOOTNOTE_NOISE, "")
    .replace(BULLET_PREFIX, "")
    .replace(MULTI_SPACE, " ")
    .trim();
};

export const normalizeDecisionExcerpt = (excerpt: string): string => {
  if (!excerpt) return "";
  const cleaned = cleanExcerpt(excerpt);
  if (!cleaned) return "";
  const filtered = filterExcerptLines(cleaned);
  const stripped = stripTableJunkSegments(filtered || cleaned);
  return stripped.replace(MULTI_SPACE, " ").trim();
};

export const extractTiming = (text: string): { text: string; normalized: { precision: TimingPrecision } } => {
  const dateMatch = text.match(
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{2,4})?)\b/i,
  );
  if (dateMatch) {
    return { text: dateMatch[0], normalized: { precision: normalizePrecision("day") } };
  }

  const quarterMatch = text.match(/\bQ[1-4]\s?20\d{2}\b/i);
  if (quarterMatch) {
    return { text: quarterMatch[0], normalized: { precision: normalizePrecision("quarter") } };
  }

  const yearMatch = text.match(/\b(?:FY\s?)?20\d{2}\b/i);
  if (yearMatch) {
    return { text: yearMatch[0], normalized: { precision: normalizePrecision("year") } };
  }

  const relativeMatch = text.match(/\bnext\s+(?:quarter|year|month|week)\b/i);
  if (relativeMatch) {
    return { text: relativeMatch[0], normalized: { precision: normalizePrecision("relative") } };
  }

  return { text: "", normalized: { precision: normalizePrecision("unknown") } };
};

export const isDecisionCandidate = (text: string): boolean => {
  if (!text) return false;
  const cleaned = cleanExcerpt(text);
  if (cleaned.length < 20) return false;
  const lower = cleaned.toLowerCase();
  if (NEGATIVE_PREFIXES.some((prefix) => lower.startsWith(prefix))) return false;
  if (lower.includes("definition") || lower.includes("footnote")) return false;

  const matchesTerm = (terms: string[]) => terms.some((term) => lower.includes(term));
  const hasCommitment =
    matchesTerm(COMMITMENT_TERMS) ||
    matchesTerm(ALLOCATION_TERMS) ||
    matchesTerm(CONSTRAINT_TERMS) ||
    matchesTerm(TARGET_TERMS) ||
    matchesTerm(TIMING_TERMS);

  if (!hasCommitment) return false;

  const isBackwardLooking =
    /\b(was|were|had|reported|delivered|achieved|grew|declined|decreased|increased)\b/i.test(cleaned) &&
    !matchesTerm(COMMITMENT_TERMS);
  if (isBackwardLooking) return false;

  const reportingTerms = ["revenue", "net income", "ebitda", "margin", "cash flow", "earnings per share", "eps", "yoy", "qoq"];
  if (
    reportingTerms.some((term) => lower.includes(term)) &&
    /\b(was|were|reported|delivered|achieved|grew|declined|decreased|increased)\b/i.test(cleaned)
  ) {
    return false;
  }

  return true;
};

export const toDecisionDetail = (text: string): string => {
  const cleaned = normalizeDecisionExcerpt(text);
  if (!cleaned) return "";
  const sentences = splitSentences(cleaned);
  const detailBase = sentences.slice(0, 2).join(". ").replace(MULTI_SPACE, " ").trim();
  if (detailBase.length <= 240) return detailBase;
  return `${detailBase.slice(0, 237).trim()}...`;
};

export const toDecisionTitle = (text: string): string => {
  const cleaned = normalizeDecisionExcerpt(text);
  if (!cleaned) return "";
  const bestSentence = pickCommitmentSentence(cleaned);
  const statement = buildDecisionStatement(bestSentence);
  if (!statement) return "";
  let title = statement
    .replace(/^(?:the\s+)?(?:company|tesla|management|board|team)\s+/i, "")
    .replace(/^(?:will|plans? to|expects? to|aims? to|intends? to|committed to|commit to)\s+/i, "")
    .trim();
  title = title.replace(/\bin\s+(Q[1-4]\s?20\d{2}|FY\s?20\d{2}|20\d{2})\b/i, "by $1");
  title = shortenTitle(title);
  if (!title) return "";
  return title.charAt(0).toUpperCase() + title.slice(1);
};

export const toDecisionStatement = (text: string): string => {
  const cleaned = normalizeDecisionExcerpt(text);
  if (!cleaned) return "";
  const bestSentence = pickCommitmentSentence(cleaned);
  const statement = buildDecisionStatement(bestSentence);
  if (!statement) return "";
  return statement.endsWith(".") ? statement : `${statement}.`;
};

export const dedupeKey = (title: string): string => normalizeTitleTokens(title).join(" ");

export const isSimilarDecisionTitle = (title: string, other: string): boolean => {
  const tokens = normalizeTitleTokens(title);
  const otherTokens = normalizeTitleTokens(other);
  if (tokens.length === 0 || otherTokens.length === 0) return false;
  const prefixSize = 6;
  if (
    tokens.length >= prefixSize &&
    otherTokens.length >= prefixSize &&
    tokens.slice(0, prefixSize).join(" ") === otherTokens.slice(0, prefixSize).join(" ")
  ) {
    return true;
  }
  const shared = tokens.filter((token) => otherTokens.includes(token));
  const ratio = shared.length / Math.max(tokens.length, otherTokens.length);
  return ratio >= 0.7;
};

export const scoreDecisionCandidate = (title: string, detail: string) => {
  const score = commitmentScore(`${title} ${detail}`);
  const lengthPenalty = detail ? detail.length : 0;
  return { score, lengthPenalty };
};
