import { containsCommitmentVerb, isTableLikeLine } from "@/lib/decisionExtract/cleanText";

const COMMITMENT_VERBS = [
  "will",
  "plan to",
  "expect to",
  "aim to",
  "target",
  "prepare to",
  "commit to",
  "discontinue",
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
  "remain on track to",
];

const TIMELINE_CUES = [
  "in q1",
  "in q2",
  "in q3",
  "in q4",
  "by",
  "by end of",
  "this year",
  "next quarter",
  "next year",
  "over",
  "during",
  "within",
];

const RESOURCE_CUES = [
  "invest",
  "allocate",
  "capex",
  "budget",
  "hire",
  "staff",
  "capacity",
  "factory",
  "manufacturing",
  "pilot",
  "ramp",
  "expand",
  "build",
];

const ACCOUNTING_ONLY = [
  "cash equivalents",
  "accounts payable",
  "total assets",
  "operating income",
  "net income",
  "earnings per share",
];

const ACTION_VERBS = [
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
  "prepare",
  "target",
  "commit",
  "discontinue",
];

const TIMELINE_REGEX = /\b(20\d{2}|q[1-4]|by end of|this year|next quarter|next year|by|during|within)\b/i;

const TRIVIAL_ACTIONS = [
  "coffee",
  "gym",
  "email",
  "emails",
  "meeting",
  "meetings",
  "call",
  "calls",
  "lunch",
  "dinner",
  "supplies",
  "schedule",
  "travel",
  "trip",
];

const NON_DECISION_PHRASES = [
  "continue to monitor",
  "continue monitoring",
  "monitoring",
  "ongoing operations",
  "day-to-day",
  "as usual",
  "routine",
  "we operate",
  "we continue to operate",
  "we believe",
  "management believes",
];

const PAST_CUES = [
  "was",
  "were",
  "had",
  "completed",
  "achieved",
  "delivered",
  "resulted",
  "concluded",
  "finished",
  "previously",
  "last year",
];

const OBJECT_VERB_PATTERN = new RegExp(
  `\\b(?:${COMMITMENT_VERBS.map((verb) => verb.replace(/\s+/g, "\\s+")).join("|")})\\b\\s+([^.;:]{8,})`,
  "i",
);

const hasClearObject = (value: string) => OBJECT_VERB_PATTERN.test(value);

const hasFutureCue = (value: string) =>
  COMMITMENT_VERBS.some((verb) => value.includes(verb)) ||
  TIMELINE_CUES.some((cue) => value.includes(cue)) ||
  TIMELINE_REGEX.test(value);

const isTrivialAction = (value: string) => TRIVIAL_ACTIONS.some((term) => value.includes(term));

const isNonDecisionPhrase = (value: string) => NON_DECISION_PHRASES.some((phrase) => value.includes(phrase));

const isPastOnly = (value: string) => PAST_CUES.some((cue) => value.includes(cue)) && !hasFutureCue(value);

export const passesDecisionCandidateFilters = (value: string) => {
  const normalized = value.trim();
  const lowered = normalized.toLowerCase();
  const hasTimelineCue = TIMELINE_CUES.some((cue) => lowered.includes(cue)) || TIMELINE_REGEX.test(lowered);

  if (normalized.length < 40 || normalized.length > 240) return false;
  if (!containsCommitmentVerb(lowered)) return false;
  if (!hasClearObject(lowered)) return false;
  if (!hasFutureCue(lowered)) return false;
  if (isPastOnly(lowered)) return false;
  if (isTrivialAction(lowered)) return false;
  if (isNonDecisionPhrase(lowered)) return false;
  if (isTableLikeLine(normalized)) return false;
  if (ACCOUNTING_ONLY.some((cue) => lowered.includes(cue))) return false;
  if ((lowered.includes("on track to") || lowered.includes("remain on track to")) && !hasTimelineCue) return false;

  return true;
};

export const scoreDecisionCandidate = (value: string) => {
  const lowered = value.toLowerCase();
  let score = 0;

  if (containsCommitmentVerb(lowered)) {
    score += 4;
  }

  if (TIMELINE_CUES.some((cue) => lowered.includes(cue)) || TIMELINE_REGEX.test(lowered)) {
    score += 2;
  }

  if (RESOURCE_CUES.some((cue) => lowered.includes(cue))) {
    score += 2;
  }

  const hasConditional =
    lowered.includes("may") || lowered.includes("might") || lowered.includes("could") || lowered.includes("subject to");
  if (hasConditional && !containsCommitmentVerb(lowered)) {
    score -= 3;
  }

  const hasActor = /(we|management|board|company)\b/i.test(value);
  const hasAction = ACTION_VERBS.some((verb) => lowered.includes(verb));
  if (hasActor && hasAction) {
    score += 1;
  }

  if (isTrivialAction(lowered)) {
    score -= 4;
  }

  if (isNonDecisionPhrase(lowered)) {
    score -= 4;
  }

  return score;
};
