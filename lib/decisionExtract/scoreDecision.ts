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
  "deliver",
  "commission",
  "schedule",
  "scheduled",
  "roll out",
  "rollout",
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
  "later this year",
  "next quarter",
  "next year",
  "over",
  "during",
  "within",
  "in 202",
];

const CONSTRAINT_CUES = [
  "pending",
  "subject to",
  "dependent",
  "regulatory",
  "constraint",
  "constrained",
  "capacity",
  "cost",
  "risk",
  "approval",
];

const DESCRIPTIVE_ONLY = [
  "includes",
  "consists of",
  "is useful to",
  "provides information",
  "provides an overview",
  "is designed to",
  "is intended to",
];

const BOILERPLATE_PHRASES = [
  "forward-looking",
  "safe harbor",
  "webcast",
  "replay",
  "gaap",
  "non-gaap",
  "will be available for replay",
  "believes that it is useful to supplement",
];

const TRIVIAL_ACTIONS = [
  "coffee",
  "gym",
  "walked",
  "walk",
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

const TIMELINE_REGEX = /\b(20\d{2}|q[1-4]|by end of|this year|later this year|next quarter|next year|by|during|within)\b/i;

const OBJECT_VERB_PATTERN = new RegExp(
  `\\b(?:${COMMITMENT_VERBS.map((verb) => verb.replace(/\s+/g, "\\s+")).join("|")})\\b\\s+([^.;:]{8,})`,
  "i",
);

const ROLLOUT_CUES = ["launch", "rollout", "roll out", "deploy", "begin", "start", "ramp", "expand", "scale"];

const hasClearObject = (value: string) => OBJECT_VERB_PATTERN.test(value);

const hasTimelineCue = (value: string) =>
  TIMELINE_CUES.some((cue) => value.includes(cue)) || TIMELINE_REGEX.test(value);

const hasConstraintCue = (value: string) => CONSTRAINT_CUES.some((cue) => value.includes(cue));

const isTrivialAction = (value: string) => TRIVIAL_ACTIONS.some((term) => value.includes(term));

const isDescriptiveOnly = (value: string) => DESCRIPTIVE_ONLY.some((phrase) => value.includes(phrase));

const matchesBoilerplate = (value: string) => BOILERPLATE_PHRASES.some((phrase) => value.includes(phrase));

const isCapabilityOnly = (value: string) => {
  if (value.includes("can now") || value.includes("is able to") || value.includes("able to")) {
    return !ROLLOUT_CUES.some((cue) => value.includes(cue));
  }
  return false;
};

const digitRatio = (value: string) => {
  const digits = value.match(/\d/g)?.length ?? 0;
  return value.length > 0 ? digits / value.length : 0;
};

type CandidateFilterOptions = {
  isPersonalMemo?: boolean;
};

export const passesDecisionCandidateFilters = (value: string, options: CandidateFilterOptions = {}) => {
  const normalized = value.trim();
  const lowered = normalized.toLowerCase();
  const hasCommitment = containsCommitmentVerb(lowered);
  const hasPlanLanguage = lowered.includes("plan") || lowered.includes("target") || lowered.includes("on track");
  const hasTimebox = hasTimelineCue(lowered);
  const hasConstraint = hasConstraintCue(lowered);

  if (normalized.length < 45 || normalized.length > 240) return false;
  if (digitRatio(normalized) > 0.25) return false;
  if (isTableLikeLine(normalized)) return false;
  if (matchesBoilerplate(lowered)) return false;
  if (isTrivialAction(lowered)) return false;
  if (isDescriptiveOnly(lowered)) return false;
  if (isCapabilityOnly(lowered)) return false;
  if (!hasCommitment && !hasPlanLanguage && !(hasTimebox && hasClearObject(lowered))) return false;
  if (!hasClearObject(lowered)) return false;

  if (options.isPersonalMemo) {
    if (!hasCommitment || !hasConstraint) return false;
  }

  return true;
};

export const scoreDecisionCandidate = (value: string) => {
  const lowered = value.toLowerCase();
  let score = 0;

  if (containsCommitmentVerb(lowered)) {
    score += 30;
  }

  if (hasTimelineCue(lowered)) {
    score += 20;
  }

  if (hasConstraintCue(lowered)) {
    score += 15;
  }

  if (matchesBoilerplate(lowered)) {
    score -= 40;
  }

  if (digitRatio(value) > 0.25) {
    score -= 40;
  }

  if (isTableLikeLine(value)) {
    score -= 30;
  }

  if (isDescriptiveOnly(lowered)) {
    score -= 20;
  }

  return score;
};
