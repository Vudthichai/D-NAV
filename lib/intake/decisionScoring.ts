import type { DecisionCategory } from "./decisionExtractLocal";

export interface SentenceScore {
  score: number;
  hasCommitment: boolean;
  hasTimeAnchor: boolean;
  hasAction: boolean;
  category: DecisionCategory;
  flags: {
    isTableLike: boolean;
    isBoilerplate: boolean;
  };
}

const COMMITMENT_VERBS = [
  "will",
  "expect",
  "plans",
  "plan",
  "target",
  "targeting",
  "prioritize",
  "prioritizing",
  "focus on",
  "double down",
  "position",
  "positioning",
  "scheduled",
  "launch",
  "ramp",
  "begin",
  "start",
  "expand",
  "deploy",
  "deliver",
  "open",
  "build",
  "introduce",
  "commission",
  "complete",
  "completed",
  "on track",
  "preparations underway",
];

const ACTION_NOUNS = [
  "production",
  "ramp",
  "launch",
  "factory",
  "line",
  "capacity",
  "commissioning",
  "deployment",
  "plant",
  "facility",
  "manufacturing",
  "infrastructure",
  "pricing",
];

const TIME_ANCHORS = [
  /\bQ[1-4]\b/i,
  /\b20\d{2}\b/i,
  /\bthis (year|quarter|month)\b/i,
  /\bnext (year|quarter|month)\b/i,
  /\bend of \d{4}\b/i,
  /\bby \d{4}\b/i,
  /\bwithin \d{1,2} months\b/i,
];

const BOILERPLATE_PATTERNS = [
  /forward-looking statements?/i,
  /could cause actual results to differ/i,
  /no obligation to update/i,
  /safe harbor/i,
  /undue reliance/i,
];

const CATEGORY_KEYWORDS: Record<DecisionCategory, RegExp[]> = {
  Operations: [/\bproduction\b/i, /\bmanufacturing\b/i, /\bplant\b/i, /\bfactory\b/i, /\bcapacity\b/i],
  Finance: [/\bmargin\b/i, /\brevenue\b/i, /\bcash flow\b/i, /\bprofit\b/i, /\bguidance\b/i],
  Product: [/\bmodel\b/i, /\bplatform\b/i, /\bproduct\b/i, /\blaunch\b/i, /\bsoftware\b/i],
  Hiring: [/\bhire\b/i, /\bhiring\b/i, /\bheadcount\b/i, /\btalent\b/i],
  Legal: [/\bregulator\b/i, /\bcompliance\b/i, /\bsettlement\b/i, /\blitigation\b/i],
  Strategy: [/\bstrategy\b/i, /\bpartnership\b/i, /\bacquisition\b/i, /\broadmap\b/i],
  "Sales/Go-to-market": [/\borders?\b/i, /\bpricing\b/i, /\bmarket\b/i, /\bdeliveries\b/i],
  Other: [],
};

const normalize = (value: string): string => value.toLowerCase();

export const isTableLike = (sentence: string): boolean => {
  const normalized = normalize(sentence);
  if (/in millions|in thousands|unaudited/i.test(normalized)) return true;
  if (/\b\d{4}\b.*\b\d{4}\b/.test(normalized) && /\b\d+\b/.test(normalized)) return true;
  if (/\$\d|\b\d{1,3}%\b/.test(normalized)) return true;
  const digitCount = (normalized.match(/\d/g) ?? []).length;
  if (digitCount >= 6 && digitCount / Math.max(1, normalized.length) > 0.08) return true;
  if (/\|/.test(normalized)) return true;
  return false;
};

export const isBoilerplate = (sentence: string): boolean =>
  BOILERPLATE_PATTERNS.some((pattern) => pattern.test(sentence));

const countMatches = (sentence: string, patterns: Array<string | RegExp>): number => {
  const normalized = normalize(sentence);
  return patterns.reduce((count, pattern) => {
    if (typeof pattern === "string") {
      return normalized.includes(pattern) ? count + 1 : count;
    }
    return pattern.test(sentence) ? count + 1 : count;
  }, 0);
};

const detectCategory = (sentence: string): DecisionCategory => {
  const normalized = normalize(sentence);
  const matches = Object.entries(CATEGORY_KEYWORDS)
    .map(([category, patterns]) => ({
      category: category as DecisionCategory,
      score: patterns.reduce((count, pattern) => (pattern.test(normalized) ? count + 1 : count), 0),
    }))
    .sort((a, b) => b.score - a.score);
  return matches[0]?.score ? matches[0].category : "Strategy";
};

export const splitSentences = (text: string): string[] => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/g).filter(Boolean);
};

export const scoreSentence = (sentence: string): SentenceScore => {
  const hasCommitment = countMatches(sentence, COMMITMENT_VERBS) > 0;
  const hasAction = countMatches(sentence, ACTION_NOUNS) > 0;
  const hasTimeAnchor = TIME_ANCHORS.some((pattern) => pattern.test(sentence));
  const tableLike = isTableLike(sentence);
  const boilerplate = isBoilerplate(sentence);

  let score = 0;
  if (hasCommitment) score += 3;
  if (hasAction) score += 2;
  if (hasTimeAnchor) score += 2;
  if (/\bon track\b/i.test(sentence)) score += 1;
  if (sentence.length > 220) score -= 2;
  if (tableLike) score -= 5;
  if (boilerplate) score -= 6;

  return {
    score,
    hasCommitment,
    hasAction,
    hasTimeAnchor,
    category: detectCategory(sentence),
    flags: {
      isTableLike: tableLike,
      isBoilerplate: boilerplate,
    },
  };
};
