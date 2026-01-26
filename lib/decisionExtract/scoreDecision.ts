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
  "by end",
  "this year",
  "later this year",
  "next quarter",
  "next year",
  "over",
  "during",
  "within",
  "in 202",
  "by june",
  "by july",
  "by august",
  "by september",
  "by october",
  "by november",
  "by december",
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
  "provides useful information",
  "believes it is useful",
];

const BOILERPLATE_PHRASES = [
  "forward-looking",
  "forward-looking statements",
  "safe harbor",
  "webcast",
  "replay",
  "gaap",
  "non-gaap",
  "will be available for replay",
  "believes that it is useful to supplement",
  "risk factors",
  "not obligated",
  "undertake no obligation",
];

const TRIVIAL_ACTIONS = [
  "coffee",
  "gym",
  "lunch",
  "dinner",
  "picked up",
  "went to",
  "drove to",
  "texted",
  "called mom",
  "walked",
  "emailed",
  "meeting",
];

const TIMELINE_REGEX =
  /\b(20\d{2}|q[1-4]|by end of|by end|this year|later this year|next quarter|next year|by|during|within|by [a-z]+)\b/i;

const OBJECT_VERB_PATTERN = new RegExp(
  `\\b(?:${COMMITMENT_VERBS.map((verb) => verb.replace(/\s+/g, "\\s+")).join("|")})\\b\\s+([^.;:]{8,})`,
  "i",
);

const ROLLOUT_CUES = ["launch", "rollout", "roll out", "deploy", "begin", "start", "ramp", "expand", "scale"];

const HARD_REJECT_PHRASES = [
  "forward-looking statements",
  "risk factors",
  "not obligated",
  "undertake no obligation",
];

const NON_COMMITMENT_PHRASES = [
  "will depend on",
  "depends on",
  "subject to",
  "may be impacted by",
];

const RISK_LIST_TERMS = [
  "failures",
  "uncertainty",
  "volatility",
  "exposure",
  "adverse",
  "litigation",
  "impairment",
];

const IR_FLUFF_TERMS = [
  "believes",
  "useful to",
  "provides useful information",
  "supplement",
  "investor relations",
];

const CAPACITY_CUES = [
  "capacity",
  "production",
  "manufacturing",
  "build",
  "install",
  "open",
  "scale",
  "launch",
  "deploy",
];

const PRODUCT_CUES = [
  "megafactory",
  "megapack",
  "powerwall",
  "robotaxi",
  "cybercab",
  "model y",
  "semi",
];

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
  isRepeatedLine?: boolean;
};

export const passesDecisionCandidateFilters = (value: string, options: CandidateFilterOptions = {}) => {
  const normalized = value.trim();
  const lowered = normalized.toLowerCase();
  const hasCommitment = containsCommitmentVerb(lowered);
  const hasPlanLanguage = lowered.includes("plan") || lowered.includes("target") || lowered.includes("on track");
  const hasTimebox = hasTimelineCue(lowered);
  const hasConstraint = hasConstraintCue(lowered);
  const numberCount = lowered.match(/\d+(?:[.,]\d+)?/g)?.length ?? 0;
  const currencyCount = lowered.match(/[$€£%]/g)?.length ?? 0;
  const separatorCount = lowered.match(/[|/—–]/g)?.length ?? 0;
  const startsWithAbility = /^\s*our ability to\b/.test(lowered);
  const containsNonCommitment = NON_COMMITMENT_PHRASES.some((phrase) => lowered.includes(phrase));
  const hasHardRejectPhrase = HARD_REJECT_PHRASES.some((phrase) => lowered.includes(phrase));
  const descriptiveStarter = /^\s*(we are|we have|there is|there are|there was|there were)\b/.test(lowered);

  if (normalized.length < 45 || normalized.length > 220) return false;
  if (digitRatio(normalized) > 0.25 && !(hasCommitment && hasTimebox)) return false;
  if (numberCount >= 3) return false;
  if (currencyCount >= 2) return false;
  if (separatorCount >= 4) return false;
  if (isTableLikeLine(normalized) && !(hasCommitment && hasTimebox)) return false;
  if (hasHardRejectPhrase) return false;
  if (/\bmay\b/.test(lowered) || /\bcould\b/.test(lowered)) return false;
  if (matchesBoilerplate(lowered)) return false;
  if (isTrivialAction(lowered)) return false;
  if (isDescriptiveOnly(lowered)) return false;
  if (isCapabilityOnly(lowered)) return false;
  if (startsWithAbility || containsNonCommitment) return false;
  if (descriptiveStarter && !hasCommitment) return false;
  if (!hasCommitment && !hasPlanLanguage && !(hasTimebox && hasClearObject(lowered))) return false;
  if (!hasClearObject(lowered)) return false;

  if (options.isPersonalMemo) {
    if (!hasCommitment || !hasConstraint) return false;
  }

  return true;
};

export const scoreDecisionCandidate = (value: string, options: CandidateFilterOptions = {}) => {
  const lowered = value.toLowerCase();
  let score = 0;

  if (containsCommitmentVerb(lowered)) {
    score += 35;
  }

  if (hasTimelineCue(lowered)) {
    score += 22;
  }

  if (hasConstraintCue(lowered)) {
    score += 15;
  }

  if (hasClearObject(lowered)) {
    score += 18;
  }

  if (CAPACITY_CUES.some((cue) => lowered.includes(cue))) {
    score += 10;
  }

  if (PRODUCT_CUES.some((cue) => lowered.includes(cue))) {
    score += 8;
  }

  if (containsCommitmentVerb(lowered) && hasTimelineCue(lowered) && hasClearObject(lowered)) {
    score += 15;
  }

  if (matchesBoilerplate(lowered)) {
    score -= 45;
  }

  if (digitRatio(value) > 0.25) {
    score -= 35;
  }

  if (isTableLikeLine(value) && !(containsCommitmentVerb(lowered) && hasTimelineCue(lowered))) {
    score -= 35;
  }

  if (isDescriptiveOnly(lowered)) {
    score -= 25;
  }

  if (RISK_LIST_TERMS.some((term) => lowered.includes(term))) {
    score -= 18;
  }

  if (IR_FLUFF_TERMS.some((term) => lowered.includes(term))) {
    score -= 16;
  }

  if (options.isRepeatedLine) {
    score -= 22;
  }

  return score;
};
