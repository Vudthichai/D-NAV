export interface DecisionLikenessResult {
  score: number;
  isDecision: boolean;
  rewritten: string;
  evidenceText: string;
}

const COMMITMENT_PATTERNS = [
  /\bwill\b/i,
  /\bplans? to\b/i,
  /\bexpects? to\b/i,
  /\baims? to\b/i,
  /\bintends? to\b/i,
  /\bcommits? to\b/i,
  /\bcontinue\b/i,
  /\blaunch\b/i,
  /\bdeploy\b/i,
  /\bexpand\b/i,
  /\bramp\b/i,
  /\bbegin\b/i,
  /\bstart\b/i,
  /\binvest\b/i,
];

const ACTION_PATTERNS = [
  /\bbuild\b/i,
  /\bdeploy\b/i,
  /\bdeliver\b/i,
  /\bscale\b/i,
  /\bexpand\b/i,
  /\blaunch\b/i,
  /\bramp\b/i,
  /\bintroduce\b/i,
  /\bprioritize\b/i,
  /\bshift\b/i,
  /\breduce\b/i,
  /\bincrease\b/i,
];

const TIME_PATTERNS = [
  /\bQ[1-4]\b/i,
  /\b20\d{2}\b/i,
  /\bthis (year|quarter|month)\b/i,
  /\bnext (year|quarter|month)\b/i,
  /\bend of \d{4}\b/i,
  /\bby \d{4}\b/i,
  /\bwithin \d{1,2} months\b/i,
];

const INFORMATIONAL_PATTERNS = [
  /\breported\b/i,
  /\bachieved\b/i,
  /\bdelivered\b/i,
  /\bproduced\b/i,
  /\bcompleted\b/i,
  /\bwas\b/i,
  /\bwere\b/i,
  /\bended\b/i,
  /\bgrew\b/i,
  /\bincreased\b/i,
  /\bdecreased\b/i,
];

const ACTOR_REGEX = /^(?:the\s+)?(company|management|board|team|we|tesla)\b[,:-]?\s*/i;
const ACTION_PREFIXES = [
  "will",
  "plans to",
  "plan to",
  "expects to",
  "expect to",
  "aims to",
  "aim to",
  "intends to",
  "intend to",
  "is",
  "are",
  "has",
  "have",
  "began",
  "begins",
  "start",
  "started",
  "launch",
  "launched",
  "ramp",
  "ramping",
  "build",
  "built",
  "deploy",
  "deployed",
  "deliver",
  "delivered",
  "expand",
  "expanded",
  "complete",
  "completed",
];

const CONSTRAINT_PATTERNS = [
  /\bby\s+[^,.]+/i,
  /\bin\s+(?:q[1-4]\b[^,.]*|h[12]\b[^,.]*|20\d{2}\b[^,.]*|the\s+next[^,.]*|the\s+first\s+half[^,.]*|the\s+second\s+half[^,.]*|next\s+[^,.]*|this\s+[^,.]*)/i,
  /\bafter\s+[^,.]+/i,
  /\bbefore\s+[^,.]+/i,
  /\bwithin\s+[^,.]+/i,
  /\bover\s+[^,.]+/i,
  /\bsubject to\s+[^,.]+/i,
  /\bpending\s+[^,.]+/i,
  /\bdepending on\s+[^,.]+/i,
];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeAction = (text: string) => {
  const trimmed = normalizeWhitespace(text.replace(/[.]+$/, ""));
  const withoutActor = trimmed.replace(ACTOR_REGEX, "");
  const lowered = withoutActor.toLowerCase();
  const prefix = ACTION_PREFIXES.find((item) => lowered.startsWith(`${item} `) || lowered === item);
  if (!prefix) return withoutActor;
  return normalizeWhitespace(withoutActor.slice(prefix.length));
};

const extractConstraint = (text: string) => {
  for (const pattern of CONSTRAINT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[0]) return normalizeWhitespace(match[0]).replace(/[.]+$/, "");
  }
  return null;
};

const toPresentTense = (value: string) => {
  const replacements: Array<[RegExp, string]> = [
    [/\bdelivered\b/gi, "deliver"],
    [/\bproduced\b/gi, "produce"],
    [/\bcompleted\b/gi, "complete"],
    [/\bexpanded\b/gi, "expand"],
    [/\blaunched\b/gi, "launch"],
    [/\bbegan\b/gi, "begin"],
    [/\bstarted\b/gi, "start"],
    [/\bachieved\b/gi, "achieve"],
    [/\bimproved\b/gi, "improve"],
    [/\bincreased\b/gi, "increase"],
    [/\bdecreased\b/gi, "decrease"],
    [/\bgrew\b/gi, "grow"],
  ];
  return replacements.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), value);
};

const buildDecisionRewrite = (text: string) => {
  const cleaned = normalizeWhitespace(text);
  const action = toPresentTense(normalizeAction(cleaned));
  const constraint = extractConstraint(cleaned);
  const suffix = constraint ? ` (${constraint})` : "";
  if (!action) return cleaned;
  return `Commit to ${action}${suffix}.`;
};

const matchesAny = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

export const assessDecisionLikeness = (text: string): DecisionLikenessResult => {
  const cleaned = normalizeWhitespace(text);
  const hasCommitment = matchesAny(cleaned, COMMITMENT_PATTERNS);
  const hasAction = matchesAny(cleaned, ACTION_PATTERNS);
  const hasTime = matchesAny(cleaned, TIME_PATTERNS);
  const isInformational = matchesAny(cleaned, INFORMATIONAL_PATTERNS);

  let score = 0;
  if (hasCommitment) score += 3;
  if (hasAction) score += 2;
  if (hasTime) score += 1;
  if (isInformational && !hasCommitment && !hasAction) score -= 2;

  const rewritten = buildDecisionRewrite(cleaned);
  return {
    score,
    isDecision: score >= 3,
    rewritten,
    evidenceText: cleaned,
  };
};
