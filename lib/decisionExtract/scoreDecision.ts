import { containsCommitmentVerb, isTableLikeLine } from "@/lib/decisionExtract/cleanText";

const COMMITMENT_VERBS = [
  "will",
  "plan to",
  "we expect to",
  "launch",
  "ramp",
  "begin",
  "start",
  "expand",
  "build",
  "deploy",
  "introduce",
  "scale",
  "invest",
  "allocate",
  "approve",
  "commence",
  "transition",
  "reduce",
  "increase",
  "continue",
  "on track to",
];

const TIMELINE_CUES = [
  "in q1",
  "in q2",
  "in q3",
  "in q4",
  "by end of",
  "this year",
  "next quarter",
  "next year",
  "over 2024",
];

const OPERATIONAL_NOUNS = [
  "factory",
  "production",
  "capacity",
  "deliveries",
  "margin",
  "pricing",
  "capex",
  "gigafactory",
  "cybertruck",
  "model",
  "energy storage",
];

const ACCOUNTING_ONLY = [
  "cash equivalents",
  "accounts payable",
  "total assets",
  "operating income",
  "net income",
  "earnings per share",
];

const ACTION_VERBS = ["launch", "ramp", "begin", "start", "expand", "build", "deploy", "introduce", "scale", "invest"];

const TIMELINE_REGEX = /\b(20\d{2}|q[1-4]|by end of|this year|next quarter|next year)\b/i;

export const scoreDecisionCandidate = (value: string) => {
  const lowered = value.toLowerCase();
  let score = 0;

  if (COMMITMENT_VERBS.some((verb) => lowered.includes(verb)) || containsCommitmentVerb(lowered)) {
    score += 3;
  }

  if (TIMELINE_CUES.some((cue) => lowered.includes(cue)) || TIMELINE_REGEX.test(lowered)) {
    score += 2;
  }

  if (OPERATIONAL_NOUNS.some((noun) => lowered.includes(noun))) {
    score += 2;
  }

  const hasConditional =
    lowered.includes("may") || lowered.includes("might") || lowered.includes("could") || lowered.includes("subject to");
  if (hasConditional && !containsCommitmentVerb(lowered)) {
    score -= 4;
  }

  if (isTableLikeLine(value)) {
    score -= 6;
  }

  if (ACCOUNTING_ONLY.some((cue) => lowered.includes(cue)) && !containsCommitmentVerb(lowered)) {
    score -= 2;
  }

  const hasActor = /(we|tesla|management)\b/i.test(value);
  const hasAction = ACTION_VERBS.some((verb) => lowered.includes(verb));
  if (hasActor && hasAction) {
    score += 1;
  }

  return score;
};
