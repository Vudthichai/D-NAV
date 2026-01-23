import type { DecisionCandidate } from "@/lib/types/decision";

const DEFAULT_SCORE = 5;
const MAX_CONFIDENCE = 1;
const MIN_CONFIDENCE = 0;

const STRONG_VERBS = [
  "will",
  "plan",
  "intend",
  "launch",
  "begin",
  "ramp",
  "build",
  "open",
  "close",
  "acquire",
  "expand",
  "reduce",
  "invest",
  "deploy",
  "approve",
  "authorize",
  "expect",
  "target",
  "on track",
  "scheduled",
];

const CONSTRAINT_CUES = [
  "subject to",
  "approval",
  "authorize",
  "authorized",
  "depending on",
  "dependent on",
  "if",
  "regulatory",
  "capacity",
  "budget",
];

const NEAR_TERM_CUES = ["q1", "q2", "this year", "next quarter", "by end of", "near term"];
const COST_CUES = ["capex", "build", "factory", "invest", "investment", "expansion"];
const RISK_CUES = ["regulatory", "subject to", "uncertain", "may", "pending", "approval"];
const CONFIDENCE_CUES = ["on track", "scheduled", "will"];

const METRIC_ONLY_CUES = [
  "cash equivalents",
  "revenue was",
  "gross margin",
  "operating income",
  "earnings per share",
  "net income",
  "adjusted ebitda",
];

const DATE_REGEX =
  /\b(q[1-4]|20\d{2}|by end of|by year-end|this year|next year|next quarter|by [a-z]+ \d{4}|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)\b/i;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const normalizeText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim();

const looksLikeHeading = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length < 4) return true;
  const hasLetters = /[a-z]/i.test(trimmed);
  if (!hasLetters) return true;
  const onlyCaps = trimmed === trimmed.toUpperCase();
  return onlyCaps && trimmed.length < 80;
};

const looksLikeBoilerplate = (value: string) => {
  const lowered = value.toLowerCase();
  return (
    lowered.includes("forward-looking statements") ||
    lowered.includes("webcast") ||
    lowered.includes("conference call")
  );
};

const containsStrongVerb = (value: string) =>
  STRONG_VERBS.some((verb) => value.toLowerCase().includes(verb));

const looksMetricOnly = (value: string) =>
  METRIC_ONLY_CUES.some((cue) => value.toLowerCase().includes(cue));

const scoreConfidence = (value: string) => {
  const lowered = value.toLowerCase();
  let score = 0;
  if (containsStrongVerb(lowered)) {
    score += 0.3;
  }
  if (DATE_REGEX.test(lowered)) {
    score += 0.2;
  }
  if (CONSTRAINT_CUES.some((cue) => lowered.includes(cue))) {
    score += 0.2;
  }
  if (looksMetricOnly(lowered) && !containsStrongVerb(lowered)) {
    score -= 0.3;
  }
  return clamp(score, MIN_CONFIDENCE, MAX_CONFIDENCE);
};

const applyHeuristics = (value: string) => {
  const lowered = value.toLowerCase();
  const urgency = clamp(
    DEFAULT_SCORE + (NEAR_TERM_CUES.some((cue) => lowered.includes(cue)) ? 1 : 0),
    1,
    10,
  );
  const cost = clamp(
    DEFAULT_SCORE + (COST_CUES.some((cue) => lowered.includes(cue)) ? 1 : 0),
    1,
    10,
  );
  const risk = clamp(
    DEFAULT_SCORE + (RISK_CUES.some((cue) => lowered.includes(cue)) ? 1 : 0),
    1,
    10,
  );
  const confidence = clamp(
    DEFAULT_SCORE + (CONFIDENCE_CUES.some((cue) => lowered.includes(cue)) ? 1 : 0),
    1,
    10,
  );

  return { urgency, cost, risk, confidence };
};

const splitIntoSegments = (text: string) => {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[•\u2022]/g, "\n")
    .replace(/(^|\s)[-–]\s+/g, "\n");

  return normalized
    .split(/\n+/)
    .flatMap((line) => line.split(/[.;]\s+/))
    .map((line) => line.trim())
    .filter(Boolean);
};

export const extractDecisionCandidates = (text: string): DecisionCandidate[] => {
  const segments = splitIntoSegments(text);
  const seen = new Set<string>();
  const candidates: DecisionCandidate[] = [];

  for (const segment of segments) {
    const normalized = normalizeText(segment);
    const lowered = normalized.toLowerCase();

    if (looksLikeHeading(normalized) || looksLikeBoilerplate(normalized)) {
      continue;
    }

    if (!containsStrongVerb(lowered)) {
      continue;
    }

    if (looksMetricOnly(lowered) && !containsStrongVerb(lowered)) {
      continue;
    }

    const id = `decision-${hashString(normalizeText(normalized).toLowerCase())}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const { urgency, cost, risk, confidence } = applyHeuristics(normalized);

    const candidate: DecisionCandidate = {
      id,
      decision: normalized,
      evidence: segment.trim(),
      extractConfidence: scoreConfidence(normalized),
      impact: DEFAULT_SCORE,
      cost,
      risk,
      urgency,
      confidence,
      keep: true,
    };

    candidates.push(candidate);
  }

  return candidates;
};
