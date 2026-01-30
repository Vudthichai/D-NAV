export type StatementKind = "decision" | "commitment" | "evidence";

export interface DecisionLikenessResult {
  score: number;
  isDecision: boolean;
  kind: StatementKind;
  rewritten: string;
  evidenceText: string;
  signals: {
    hasCommitment: boolean;
    hasAllocation: boolean;
    hasPrioritization: boolean;
    hasTime: boolean;
    isInformational: boolean;
    isOutcomeOnly: boolean;
  };
}

const COMMITMENT_PATTERNS = [
  /\bwill\b/i,
  /\bplans? to\b/i,
  /\bexpects? to\b/i,
  /\baims? to\b/i,
  /\bintends? to\b/i,
  /\bcommits? to\b/i,
  /\bcontinues? to\b/i,
  /\bscheduled\b/i,
  /\bremain on track\b/i,
  /\btarget(?:s|ing)?\b/i,
  /\bbegin(?:s|ning)?\b/i,
  /\bstart(?:s|ing)?\b/i,
  /\blaunch(?:es|ing)?\b/i,
  /\bramp(?:s|ing)?\b/i,
  /\bdeploy(?:s|ing)?\b/i,
  /\ballocate(?:s|d|ing)?\b/i,
  /\binvest(?:s|ed|ing)?\b/i,
  /\bprioritiz(?:e|ing|es)\b/i,
  /\bcommit(?:s|ted|ting)?\b/i,
  /\bprepare(?:s|d|ing)?\b/i,
  /\bcommission(?:s|ed|ing)?\b/i,
  /\bexpand(?:s|ed|ing)?\b/i,
  /\bpursue(?:s|d|ing)?\b/i,
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

const RESOURCE_PATTERNS = [
  /\binvest(?:ing|ment)?\b/i,
  /\bcapex\b/i,
  /\bcapital (?:allocation|deployment)\b/i,
  /\bexpand(?:ing)? capacity\b/i,
  /\bbuild(?:ing)?\b/i,
  /\bscale(?:d|ing)?\b/i,
  /\bdeploy(?:ing)? capital\b/i,
  /\bhiring\b/i,
  /\bheadcount\b/i,
  /\bresource allocation\b/i,
];

const PRIORITIZATION_PATTERNS = [
  /\bfocus on\b/i,
  /\bdouble down\b/i,
  /\bprioritiz(?:e|ing)\b/i,
  /\bposition(?:ing)?\b/i,
  /\bshift(?:ing)? resources\b/i,
  /\brebalance\b/i,
];

const DECISION_ACTION_PATTERNS = [
  /\breassign\b/i,
  /\bapprove\b/i,
  /\bbuild\b/i,
  /\blaunch\b/i,
  /\binvest\b/i,
  /\bacquire\b/i,
  /\brelocate\b/i,
  /\bdivest\b/i,
  /\bexit\b/i,
  /\bclose\b/i,
  /\bcancel\b/i,
  /\bpause\b/i,
  /\bresume\b/i,
  /\bhire\b/i,
  /\bcut\b/i,
];

const TIME_PATTERNS = [
  /\bQ[1-4]\b/i,
  /\b20\d{2}\b/i,
  /\bthis (year|quarter|month)\b/i,
  /\bnext (year|quarter|month)\b/i,
  /\blater this year\b/i,
  /\bend of \d{4}\b/i,
  /\bby \d{4}\b/i,
  /\bwithin \d{1,2} months\b/i,
  /\bin \d{4}\b/i,
];

const INFORMATIONAL_PATTERNS = [
  /\breported\b/i,
  /\bachieved\b/i,
  /\bdelivered\b/i,
  /\bproduced\b/i,
  /\bcompleted\b/i,
  /\badded\b/i,
  /\bwas\b/i,
  /\bwere\b/i,
  /\bended\b/i,
  /\bgrew\b/i,
  /\bincreased\b/i,
  /\bdecreased\b/i,
  /\bresulted\b/i,
  /\bwas best[-\s]?selling\b/i,
  /\brecord\b/i,
];

const AGENCY_PATTERNS = [
  /\bwill\b/i,
  /\bexpects?\b/i,
  /\bplans?\b/i,
  /\bcontinues?\b/i,
  /\bremain on track\b/i,
  /\bbegin(?:s|ning)?\b/i,
  /\blaunch(?:es|ing)?\b/i,
  /\bdeploy(?:s|ing)?\b/i,
  /\ballocate(?:s|d|ing)?\b/i,
  /\binvest(?:s|ed|ing)?\b/i,
  /\bprioritiz(?:e|ing|es)\b/i,
  /\bcommit(?:s|ted|ting)?\b/i,
  /\btarget(?:s|ing)?\b/i,
  /\bprepare(?:s|d|ing)?\b/i,
  /\bcommission(?:s|ed|ing)?\b/i,
  /\bexpand(?:s|ed|ing)?\b/i,
  /\bpursue(?:s|d|ing)?\b/i,
];

const OUTCOME_ONLY_PATTERNS = [
  /\bachieved\b/i,
  /\bdelivered\b/i,
  /\brecord\b/i,
  /\bincreased\b/i,
  /\bdecreased\b/i,
  /\bwas\b/i,
  /\bwere\b/i,
  /\bgrew\b/i,
  /\bmargin\b/i,
  /\brevenue\b/i,
  /\beps\b/i,
  /\bcash flow\b/i,
];

const CAPTION_PATTERNS = [
  /\bsource:\b/i,
  /\badditional information\b/i,
  /\bwebcast\b/i,
  /\bother highlights\b/i,
  /\bttm\b/i,
  /\bacea\b/i,
  /\bautonews\b/i,
  /\blight[-\s]?duty\b/i,
  /\bcumulative miles\b/i,
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
  "commits to",
  "commit to",
  "continues to",
  "continue to",
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

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

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

const buildStatementRewrite = (text: string, kind: StatementKind) => {
  const cleaned = normalizeWhitespace(text);
  const action = toPresentTense(normalizeAction(cleaned));
  const constraint = extractConstraint(cleaned);
  const suffix = constraint ? ` (${constraint})` : "";
  if (kind === "evidence") {
    return cleaned;
  }
  if (!action) return cleaned;
  if (kind === "commitment") {
    return `Plans to ${action}${suffix}.`;
  }
  return `${capitalize(action)}${suffix}.`;
};

const matchesAny = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

const looksLikeFragment = (text: string) => {
  const cleaned = text.trim();
  if (!cleaned) return false;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const alphaOnly = cleaned.replace(/[^a-z]/gi, "");
  if (alphaOnly && cleaned === cleaned.toUpperCase() && tokens.length <= 6) return true;
  if (tokens.length <= 3 && cleaned.length <= 28 && !matchesAny(cleaned, AGENCY_PATTERNS)) return true;
  if (/\([^)]+\)\s*\/\s*\([^)]+\)/.test(cleaned)) return true;
  const digitCount = (cleaned.match(/\d/g) ?? []).length;
  if (digitCount >= 4 && digitCount / Math.max(1, cleaned.length) > 0.06) return true;
  return false;
};

export const classifyStatementKind = (text: string): StatementKind => {
  const cleaned = normalizeWhitespace(text);
  const hasCommitment = matchesAny(cleaned, COMMITMENT_PATTERNS);
  const hasAllocation = matchesAny(cleaned, RESOURCE_PATTERNS);
  const hasPrioritization = matchesAny(cleaned, PRIORITIZATION_PATTERNS);
  const hasAction = matchesAny(cleaned, DECISION_ACTION_PATTERNS) || matchesAny(cleaned, ACTION_PATTERNS);
  const isInformational = matchesAny(cleaned, INFORMATIONAL_PATTERNS);
  const hasDecisionSignal = hasCommitment || hasAllocation || hasPrioritization || hasAction;

  if (isInformational && !hasDecisionSignal) return "evidence";
  if (hasAction) return "decision";
  if (hasCommitment || hasAllocation || hasPrioritization) return "commitment";
  return isInformational ? "evidence" : "decision";
};

export const assessDecisionLikeness = (text: string): DecisionLikenessResult => {
  const cleaned = normalizeWhitespace(text);
  const hasCommitment = matchesAny(cleaned, COMMITMENT_PATTERNS);
  const hasAction = matchesAny(cleaned, ACTION_PATTERNS);
  const hasAllocation = matchesAny(cleaned, RESOURCE_PATTERNS);
  const hasPrioritization = matchesAny(cleaned, PRIORITIZATION_PATTERNS);
  const hasTime = matchesAny(cleaned, TIME_PATTERNS);
  const isInformational = matchesAny(cleaned, INFORMATIONAL_PATTERNS);
  const hasAgency = matchesAny(cleaned, AGENCY_PATTERNS);
  const hasConstraint = matchesAny(cleaned, CONSTRAINT_PATTERNS) || hasTime;
  const isCaptionLike = matchesAny(cleaned, CAPTION_PATTERNS) || looksLikeFragment(cleaned);
  const isOutcomeOnly = matchesAny(cleaned, OUTCOME_ONLY_PATTERNS) && !hasAgency;
  const kind = classifyStatementKind(cleaned);
  const hasDecisionSignal =
    hasAgency && (hasConstraint || hasCommitment || hasAllocation || hasPrioritization || hasAction);

  let score = 0;
  if (hasCommitment) score += 3;
  if (hasAllocation) score += 3;
  if (hasPrioritization) score += 2;
  if (hasAction) score += 1;
  if (hasTime) score += 1;
  if (isInformational && !hasDecisionSignal) score -= 3;
  if (isOutcomeOnly) score -= 4;
  if (isCaptionLike) score -= 6;
  if (!hasDecisionSignal && hasTime) score -= 1;

  const rewritten = buildStatementRewrite(cleaned, kind);
  return {
    score,
    isDecision: hasDecisionSignal && score >= 3 && !isOutcomeOnly && !isCaptionLike,
    kind,
    rewritten,
    evidenceText: cleaned,
    signals: {
      hasCommitment,
      hasAllocation,
      hasPrioritization,
      hasTime,
      isInformational,
      isOutcomeOnly,
    },
  };
};
