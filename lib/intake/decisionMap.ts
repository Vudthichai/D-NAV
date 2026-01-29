export type MapCategoryKey = "whatHappened" | "whatWasDone" | "whatsBeingBetOn" | "whatChangesNext";

export const MAP_CATEGORY_CONFIG: Array<{ key: MapCategoryKey; title: string; description: string }> = [
  {
    key: "whatHappened",
    title: "What happened",
    description: "Signals, outcomes, or reported shifts that set the context.",
  },
  {
    key: "whatWasDone",
    title: "What was done",
    description: "Actions already taken or work actively underway.",
  },
  {
    key: "whatsBeingBetOn",
    title: "What’s being bet on",
    description: "Strategic bets, expectations, and directional commitments.",
  },
  {
    key: "whatChangesNext",
    title: "What changes next",
    description: "Upcoming moves, timing, and near-term changes.",
  },
];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const matchesAny = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

const HAPPENED_PATTERNS = [
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
];

const DONE_PATTERNS = [
  /\bcompleted\b/i,
  /\bdelivered\b/i,
  /\bdeployed\b/i,
  /\bcommissioned\b/i,
  /\bexpanded\b/i,
  /\blaunched\b/i,
  /\bbegan\b/i,
  /\bstarted\b/i,
  /\brolled out\b/i,
  /\bimplemented\b/i,
  /\bexecuted\b/i,
];

const BET_PATTERNS = [
  /\bexpect(?:s|ed)?\b/i,
  /\bforecast\b/i,
  /\boutlook\b/i,
  /\bguidance\b/i,
  /\baim(?:s|ed)?\b/i,
  /\btarget(?:s|ed)?\b/i,
  /\bintent(?:s|ed)?\b/i,
  /\bstrategy\b/i,
  /\bpriorit(?:y|ies|ize|ized)\b/i,
];

const NEXT_PATTERNS = [
  /\bwill\b/i,
  /\bplans?\b/i,
  /\bnext\b/i,
  /\bby\b/i,
  /\bin\s+\d{4}\b/i,
  /\bin\s+q[1-4]\b/i,
  /\bin\s+h[12]\b/i,
  /\bafter\b/i,
  /\bbefore\b/i,
  /\bwithin\b/i,
  /\bover\b/i,
  /\bby end of\b/i,
];

export const classifyMapCategory = (text: string): MapCategoryKey => {
  const cleaned = normalizeWhitespace(text);
  if (matchesAny(cleaned, NEXT_PATTERNS)) return "whatChangesNext";
  if (matchesAny(cleaned, BET_PATTERNS)) return "whatsBeingBetOn";
  if (matchesAny(cleaned, DONE_PATTERNS)) return "whatWasDone";
  if (matchesAny(cleaned, HAPPENED_PATTERNS)) return "whatHappened";
  return "whatWasDone";
};
