const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const stripPunctuation = (value: string) => value.replace(/^[\s\-–—:]+|[\s.]+$/g, "").trim();

const removeActorPrefix = (value: string) =>
  value.replace(/^(?:the\s+)?(company|management|board|team|we|organization|business|firm|leadership)\b[,:-]?\s*/i, "");

const removeTrailingBoilerplate = (value: string) =>
  value
    .replace(/\baccepting\b[^.]*$/i, "")
    .replace(/\bsubject to\b[^.]*$/i, "")
    .replace(/\bpending\b[^.]*$/i, "")
    .replace(/\bassuming\b[^.]*$/i, "")
    .trim();

const ensureSentenceEnd = (value: string) => (/[.!?]$/.test(value) ? value : `${value}.`);

const startsWithAny = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

const FORECAST_PREFIXES = [
  /^(?:outlook|forecast|guidance)[:\s-]*/i,
  /^(?:we|the\s+company|company|management|the\s+team|board)\s+expects?\b/i,
  /^expects?\b/i,
  /^anticipates?\b/i,
  /^projects?\b/i,
];

const COMMIT_PREFIXES = [
  /^(?:we|the\s+company|company|management|the\s+team|board)\s+commits?\s+to\b/i,
  /^(?:we|the\s+company|company|management|the\s+team|board)\s+plans?\s+to\b/i,
  /^plans?\s+to\b/i,
  /^(?:we|the\s+company|company|management|the\s+team|board)\s+will\b/i,
  /^will\b/i,
];

const CONTINUE_PREFIXES = [
  /^(?:we|the\s+company|company|management|the\s+team|board)\s+continues?\s+to\b/i,
  /^continues?\s+to\b/i,
];

const BEGIN_PREFIXES = [
  /^(?:we|the\s+company|company|management|the\s+team|board)\s+(?:begins?|starts?)\s+to\b/i,
  /^(?:begins?|starts?)\s+to\b/i,
];

const replacePrefix = (value: string, patterns: RegExp[]) => {
  let next = value;
  patterns.forEach((pattern) => {
    if (pattern.test(next)) {
      next = next.replace(pattern, "");
    }
  });
  return next.trim();
};

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

export const normalizeDecisionStatement = (input: string): string => {
  const original = normalizeWhitespace(input);
  if (!original) return original;

  let working = removeActorPrefix(original);
  working = removeTrailingBoilerplate(working);

  let prefix = "";

  if (startsWithAny(working, FORECAST_PREFIXES)) {
    working = replacePrefix(working, FORECAST_PREFIXES);
    prefix = "Bet on ";
  } else if (startsWithAny(working, CONTINUE_PREFIXES)) {
    working = replacePrefix(working, CONTINUE_PREFIXES);
    prefix = "Continue ";
  } else if (startsWithAny(working, BEGIN_PREFIXES)) {
    working = replacePrefix(working, BEGIN_PREFIXES);
    prefix = "Begin ";
  } else if (startsWithAny(working, COMMIT_PREFIXES)) {
    working = replacePrefix(working, COMMIT_PREFIXES);
    prefix = "Plan to ";
  }

  working = working.replace(/^to\s+/i, "");
  working = stripPunctuation(working);
  if (!working) return original;

  const normalized = `${prefix}${working}`.trim();
  return ensureSentenceEnd(capitalize(normalized));
};
