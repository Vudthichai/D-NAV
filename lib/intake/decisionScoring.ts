export type DecisionStrength = "hard" | "soft";

export type DecisionCategory = "Product" | "Operations" | "Finance" | "Strategy" | "Other";

export type SentenceScore = {
  score: number;
  hasCommitment: boolean;
  hasTimeAnchor: boolean;
  hasActionNoun: boolean;
  isBoilerplate: boolean;
  isTableLike: boolean;
  isRetrospective: boolean;
};

const COMMITMENT_VERBS = [
  "will",
  "plan to",
  "plans to",
  "expect to",
  "expects to",
  "begin",
  "began",
  "ramp",
  "launch",
  "start",
  "complete",
  "scheduled to",
  "on track to",
  "preparations underway",
  "deploy",
  "commission",
  "build",
  "expand",
  "invest",
];

const ACTION_NOUNS = [
  "production",
  "ramp",
  "launch",
  "factory",
  "plant",
  "line",
  "lines",
  "capacity",
  "deployment",
  "commissioning",
  "construction",
  "manufacturing",
  "platform",
];

const TIME_ANCHORS = [
  /\b20(24|25|26|27)\b/,
  /\bq[1-4]\b/i,
  /\bq[1-4]\s?20(24|25|26|27)\b/i,
  /\bfirst half\b/i,
  /\bsecond half\b/i,
  /\bby end of\b/i,
  /\blater this year\b/i,
  /\bthis quarter\b/i,
  /\bnext quarter\b/i,
];

const BOILERPLATE_PATTERNS = [
  /forward-looking statements?/i,
  /could cause actual results to differ materially/i,
  /in millions of usd/i,
  /\bnon-gaap\b/i,
  /\bconference call\b/i,
  /\bwebcast\b/i,
];

const TABLE_PATTERNS = [
  /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/,
  /\b\d+(?:\.\d+)?%\b/,
  /[|;]{2,}/,
  /\b(usd|eur|gbp)\b/i,
];

const RETROSPECTIVE_MARKERS = [
  "achieved",
  "reported",
  "grew",
  "increased",
  "decreased",
  "rose",
  "fell",
  "record",
];

const CATEGORY_HINTS: Array<{ cat: DecisionCategory; re: RegExp }> = [
  { cat: "Product", re: /\b(product|model|vehicle|fsd|robotaxi|cybercab|software|feature|launch)\b/i },
  { cat: "Operations", re: /\b(factory|plant|construction|ramp|production|deploy|capacity|commission)\b/i },
  { cat: "Finance", re: /\b(price|margin|capex|cash|financing|liquidity|guidance)\b/i },
  { cat: "Strategy", re: /\b(strategy|platform|roadmap|priorit|focus|expand|partnership)\b/i },
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
  "said",
]);

export const normalizeSentence = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .replace(/["“”]/g, "")
    .trim();

const normalizeForMatch = (text: string) => normalizeSentence(text).toLowerCase();

const countDigits = (text: string) => (text.match(/\d/g) ?? []).length;

export const digitRatio = (text: string) => {
  const trimmed = text.replace(/\s/g, "");
  if (!trimmed) return 0;
  return countDigits(trimmed) / trimmed.length;
};

export const looksTableLike = (text: string) => {
  if (digitRatio(text) > 0.22) return true;
  const numberCount = (text.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []).length;
  if (numberCount >= 4) return true;
  if (TABLE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  const delimiterCount = (text.match(/[|;•]/g) ?? []).length;
  if (delimiterCount >= 4 && numberCount >= 3) return true;
  return false;
};

export const isBoilerplate = (text: string) => BOILERPLATE_PATTERNS.some((pattern) => pattern.test(text));

const hasCommitmentVerb = (text: string) => COMMITMENT_VERBS.some((verb) => text.includes(verb));
const hasActionNoun = (text: string) => ACTION_NOUNS.some((noun) => text.includes(noun));
const hasTimeAnchor = (text: string) => TIME_ANCHORS.some((pattern) => pattern.test(text));

export const splitSentences = (text: string) => {
  if (!text) return [] as string[];
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/([a-zA-Z])-\n([a-zA-Z])/g, "$1$2")
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

export const scoreSentence = (sentence: string): SentenceScore => {
  const cleaned = normalizeSentence(sentence);
  const normalized = normalizeForMatch(cleaned);
  const timeAnchor = hasTimeAnchor(normalized);
  const commitment = hasCommitmentVerb(normalized);
  const actionNoun = hasActionNoun(normalized);
  const boilerplate = isBoilerplate(cleaned);
  const tableLike = looksTableLike(cleaned);
  const retrospective = RETROSPECTIVE_MARKERS.some((word) => normalized.includes(word));

  let score = 0;
  if (timeAnchor) score += 3;
  if (commitment) score += 3;
  if (actionNoun) score += 2;
  if (retrospective && !(timeAnchor || commitment)) score -= 3;
  if (tableLike) score -= 5;
  if (boilerplate) score -= 6;

  return {
    score,
    hasCommitment: commitment,
    hasTimeAnchor: timeAnchor,
    hasActionNoun: actionNoun,
    isBoilerplate: boilerplate,
    isTableLike: tableLike,
    isRetrospective: retrospective,
  };
};

export const buildTitle = (sentence: string) => {
  const cleaned = normalizeSentence(sentence)
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/\b(Company|We|Our|Management)\b\s*/i, "")
    .replace(/^(Q[1-4]\s?\d{4}|\d{4}|First half|Second half)\b\s*/i, "")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const slice = words.length >= 6 ? words.slice(0, 8) : words.slice(0, 6);
  return slice.join(" ").replace(/[.,;:]+$/, "");
};

export const bestCategory = (text: string): DecisionCategory => {
  for (const hint of CATEGORY_HINTS) if (hint.re.test(text)) return hint.cat;
  return "Other";
};

export const decisionStrength = (score: SentenceScore): DecisionStrength =>
  score.hasCommitment && score.hasTimeAnchor ? "hard" : "soft";

export const normalizeForDedup = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
    .join(" ");

export const bigramSet = (text: string) => {
  const tokens = normalizeForDedup(text).split(/\s+/).filter(Boolean);
  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    bigrams.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
};

export const jaccard = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};
