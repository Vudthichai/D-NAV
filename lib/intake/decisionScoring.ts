export type DecisionCategory =
  | "Operations"
  | "Finance"
  | "Product"
  | "Hiring"
  | "Legal"
  | "Strategy"
  | "Sales/Go-to-market"
  | "Other";

const COMMITMENT_VERBS = [
  "will",
  "plan",
  "plans",
  "planned",
  "scheduled",
  "on track",
  "expect",
  "expects",
  "target",
  "begin",
  "begins",
  "ramp",
  "launch",
  "start",
  "starting",
  "complete",
  "completed",
  "preparations underway",
  "approved",
  "signed",
  "deploy",
];

const STRONG_COMMITMENT_VERBS = ["will", "scheduled", "begin", "starting", "complete", "completed", "launch", "start"];

const TIME_ANCHORS = [
  /\b20(24|25|26|27)\b/,
  /\bq[1-4]\b/i,
  /\bq[1-4]\s?20(24|25|26|27)\b/i,
  /\bfirst half\b/i,
  /\bsecond half\b/i,
  /\bby end of\b/i,
  /\blater this year\b/i,
  /\bnext quarter\b/i,
  /\bnext year\b/i,
];

const ACTION_NOUNS = [
  "production",
  "ramp",
  "launch",
  "commissioning",
  "construction",
  "deployment",
  "factory",
  "plant",
  "line",
  "lines",
  "capacity",
  "start of production",
];

const BOILERPLATE_PATTERNS = [
  /forward-looking statements/i,
  /could cause actual results to differ materially/i,
  /results may differ materially/i,
  /in millions of usd/i,
  /risk factors/i,
  /financial statements/i,
  /reconciliations/i,
  /cash flows?/i,
  /net income/i,
  /non-gaap/i,
];

const TABLE_PATTERNS = [
  /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/,
  /\b\d+(?:\.\d+)?%\b/,
  /[|;]{2,}/,
  /\b(usd|eur|gbp)\b/i,
];

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "to",
  "of",
  "for",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "our",
  "we",
  "their",
  "they",
  "it",
  "as",
  "into",
  "will",
]);

const CATEGORY_HINTS: Array<{ cat: DecisionCategory; re: RegExp }> = [
  { cat: "Product", re: /\b(product|model|vehicle|fsd|robotaxi|cybercab|software|feature|launch)\b/i },
  { cat: "Operations", re: /\b(factory|plant|construction|ramp|production|deploy|capacity|commission)\b/i },
  { cat: "Finance", re: /\b(price|margin|capex|cash|financing|liquidity|guidance)\b/i },
  { cat: "Sales/Go-to-market", re: /\b(markets|countries|sales|go-to-market|launch in)\b/i },
  { cat: "Strategy", re: /\b(strategy|platform|roadmap|priorit|focus|expand|invest)\b/i },
  { cat: "Hiring", re: /\b(hiring|headcount|staffing|recruit)\b/i },
  { cat: "Legal", re: /\b(regulator|approval|permit|settlement|litigation)\b/i },
];

const normalizeForScoring = (text: string) =>
  text
    .toLowerCase()
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();

export const digitRatio = (text: string) => {
  const trimmed = text.replace(/\s/g, "");
  if (!trimmed) return 0;
  const digits = trimmed.match(/\d/g)?.length ?? 0;
  return digits / trimmed.length;
};

export const looksTableLike = (text: string) => {
  if (digitRatio(text) > 0.22) return true;
  const numberCount = text.match(/\b\d+(?:[.,]\d+)?%?\b/g)?.length ?? 0;
  if (numberCount >= 4) return true;
  if (TABLE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  const delimiterCount = text.match(/[|;•]/g)?.length ?? 0;
  if (delimiterCount >= 4 && numberCount >= 3) return true;
  return false;
};

export const isBoilerplate = (text: string) => BOILERPLATE_PATTERNS.some((pattern) => pattern.test(text));

export const hasCommitmentVerb = (text: string) => COMMITMENT_VERBS.some((verb) => text.includes(verb));
export const hasStrongCommitmentVerb = (text: string) => STRONG_COMMITMENT_VERBS.some((verb) => text.includes(verb));
export const hasTimeAnchor = (text: string) => TIME_ANCHORS.some((pattern) => pattern.test(text));
export const hasActionNoun = (text: string) => ACTION_NOUNS.some((noun) => text.includes(noun));

export const splitSentences = (text: string) => {
  if (!text) return [] as string[];
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/([a-zA-Z])\-\n([a-zA-Z])/g, "$1$2")
    .replace(/[•\u2022]/g, "•")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) return [];

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
    const endsSentence = /[.!?"]$/.test(current);
    const nextLooksContinuation = /^[a-z0-9(]/.test(line);
    if (!endsSentence && nextLooksContinuation) {
      current = `${current} ${line}`.trim();
    } else {
      merged.push(current);
      current = line;
    }
  });
  if (current) merged.push(current);

  const sentences: string[] = [];
  merged.forEach((line) => {
    line
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .forEach((sentence) => sentences.push(sentence));
  });
  return sentences;
};

export const scoreDecisionSentence = (sentence: string) => {
  const normalized = normalizeForScoring(sentence);
  let score = 0;
  const timeAnchor = hasTimeAnchor(normalized);
  const commitment = hasCommitmentVerb(normalized);
  const actionNoun = hasActionNoun(normalized);
  const tableLike = looksTableLike(sentence);
  const boilerplate = isBoilerplate(sentence);
  const digits = digitRatio(sentence);

  if (timeAnchor) score += 3;
  if (commitment) score += 3;
  if (actionNoun) score += 2;
  if (sentence.length > 280) score -= 2;
  if (digits > 0.18) score -= 2;
  if (tableLike) score -= 5;
  if (boilerplate) score -= 6;

  return {
    score,
    hasTimeAnchor: timeAnchor,
    hasCommitment: commitment,
    hasActionNoun: actionNoun,
    isTableLike: tableLike,
    isBoilerplate: boilerplate,
    digitRatio: digits,
  };
};

export const bestCategory = (text: string): DecisionCategory => {
  for (const hint of CATEGORY_HINTS) if (hint.re.test(text)) return hint.cat;
  return "Other";
};

export const normalizeForDedup = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
    .join(" ");
