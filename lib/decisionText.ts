import { normalizePrecision, type TimingPrecision } from "@/utils/timingPrecision";

const FOOTNOTE_NOISE = /\[(?:\d+|[a-z])\]|\(\d+\)/gi;
const BULLET_PREFIX = /^[•\-\u2022]\s*/gm;
const MULTI_SPACE = /\s+/g;

const NEGATIVE_PREFIXES = [
  "summary highlights",
  "summary of",
  "definition",
  "definitions",
  "footnote",
  "table",
  "results",
  "performance",
];

const COMMITMENT_TERMS = [
  "will",
  "plan to",
  "plans to",
  "committed to",
  "commit to",
  "approved",
  "decided to",
  "intend to",
  "expects to",
  "expect to",
  "aim to",
];

const ALLOCATION_TERMS = [
  "spend",
  "invest",
  "allocate",
  "hire",
  "build",
  "expand",
  "open",
  "acquire",
  "fund",
  "scale",
];

const CONSTRAINT_TERMS = [
  "cap",
  "limit",
  "freeze",
  "pause",
  "stop",
  "avoid",
  "delay",
  "reduce",
  "cut",
  "exit",
];

const TARGET_TERMS = [
  "ship",
  "launch",
  "release",
  "deliver",
  "reach",
  "achieve",
  "roll out",
  "rollout",
  "introduce",
];

const TIMING_TERMS = ["by", "before", "in 20", "q1", "q2", "q3", "q4", "next quarter", "next year"];

const FILLER_TERMS = ["despite", "we believe", "may", "could", "is impacted", "was impacted"];

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "by",
  "with",
  "will",
  "plan",
  "plans",
  "company",
  "team",
]);

const detectActor = (text: string) => {
  const actorMatch = text.match(/\b(Tesla|Company|Management|Board|Team|We)\b/i);
  if (!actorMatch) return "Company";
  const actor = actorMatch[0];
  if (actor.toLowerCase() === "we") return "Company";
  if (actor.toLowerCase() === "company") return "Company";
  if (actor.toLowerCase() === "management") return "Management";
  if (actor.toLowerCase() === "board") return "Board";
  if (actor.toLowerCase() === "team") return "Team";
  return actor;
};

export const cleanExcerpt = (excerpt: string): string => {
  if (!excerpt) return "";
  return excerpt
    .replace(FOOTNOTE_NOISE, "")
    .replace(BULLET_PREFIX, "")
    .replace(MULTI_SPACE, " ")
    .trim();
};

export const extractTiming = (text: string): { text: string; normalized: { precision: TimingPrecision } } => {
  const dateMatch = text.match(
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{2,4})?)\b/i,
  );
  if (dateMatch) {
    return { text: dateMatch[0], normalized: { precision: normalizePrecision("day") } };
  }

  const quarterMatch = text.match(/\bQ[1-4]\s?20\d{2}\b/i);
  if (quarterMatch) {
    return { text: quarterMatch[0], normalized: { precision: normalizePrecision("quarter") } };
  }

  const yearMatch = text.match(/\b(?:FY\s?)?20\d{2}\b/i);
  if (yearMatch) {
    return { text: yearMatch[0], normalized: { precision: normalizePrecision("year") } };
  }

  const relativeMatch = text.match(/\bnext\s+(?:quarter|year|month|week)\b/i);
  if (relativeMatch) {
    return { text: relativeMatch[0], normalized: { precision: normalizePrecision("relative") } };
  }

  return { text: "", normalized: { precision: normalizePrecision("unknown") } };
};

export const isDecisionCandidate = (text: string): boolean => {
  if (!text) return false;
  const cleaned = cleanExcerpt(text);
  if (cleaned.length < 20) return false;
  const lower = cleaned.toLowerCase();
  if (NEGATIVE_PREFIXES.some((prefix) => lower.startsWith(prefix))) return false;
  if (lower.includes("definition") || lower.includes("footnote")) return false;

  const matchesTerm = (terms: string[]) => terms.some((term) => lower.includes(term));
  const hasCommitment =
    matchesTerm(COMMITMENT_TERMS) ||
    matchesTerm(ALLOCATION_TERMS) ||
    matchesTerm(CONSTRAINT_TERMS) ||
    matchesTerm(TARGET_TERMS) ||
    matchesTerm(TIMING_TERMS);

  if (!hasCommitment) return false;

  const isBackwardLooking =
    /\b(was|were|had|reported|delivered|achieved|grew|declined|decreased|increased)\b/i.test(cleaned) &&
    !matchesTerm(COMMITMENT_TERMS);
  if (isBackwardLooking) return false;

  return true;
};

export const toDecisionStatement = (text: string): string => {
  const cleaned = cleanExcerpt(text);
  if (!cleaned) return "";
  const timing = extractTiming(cleaned);
  const actor = detectActor(cleaned);

  const commitmentMatch = cleaned.match(
    /\b(?:will|plan to|plans to|committed to|commit to|decided to|intend to|expects to|expect to|aim to)\s+([^.;]+)/i,
  );
  const approvedMatch = cleaned.match(/\bapproved\s+([^.;]+)/i);
  const action = (commitmentMatch?.[1] ?? approvedMatch?.[1] ?? cleaned.split(/[.!?]/)[0] ?? cleaned).trim();

  const sanitizedAction = FILLER_TERMS.reduce(
    (acc, term) => acc.replace(new RegExp(`\\b${term}\\b`, "gi"), ""),
    action,
  )
    .replace(MULTI_SPACE, " ")
    .trim();
  if (!sanitizedAction) return "";

  const escapedTiming = timing.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalizedAction = timing.text
    ? sanitizedAction.replace(new RegExp(`\\b(in|by|during|over)\\s+${escapedTiming}\\b`, "i"), `by ${timing.text}`)
    : sanitizedAction;
  const timingText = timing.text && !normalizedAction.toLowerCase().includes(timing.text.toLowerCase())
    ? ` by ${timing.text}`
    : "";

  const base = normalizedAction.toLowerCase().startsWith("will ")
    ? normalizedAction.replace(/^will\s+/i, "")
    : normalizedAction;

  return `${actor} will ${base}${timingText}.`.replace(MULTI_SPACE, " ").trim();
};

export const toDecisionTitle = (text: string): string => {
  const statement = toDecisionStatement(text);
  if (!statement) return "";
  const trimmed = statement.replace(/\b(?:Company|Tesla|Management|Board|Team)\b\s+will\s+/i, "");
  const title = trimmed.replace(/\.$/, "").trim();
  if (title.length <= 60) return title.charAt(0).toUpperCase() + title.slice(1);
  const clipped = title.slice(0, 60);
  const lastSpace = clipped.lastIndexOf(" ");
  const safe = lastSpace > 30 ? clipped.slice(0, lastSpace) : clipped;
  return safe.charAt(0).toUpperCase() + safe.slice(1);
};

export const dedupeKey = (title: string, statement: string): string => {
  const base = `${title} ${statement}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token))
    .join(" ");
  return base.trim();
};
