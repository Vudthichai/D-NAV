const TABLE_KEYWORDS = ["gaap", "non-gaap", "eps", "diluted", "revenue", "cash flows"];

const countDigits = (text: string) => (text.match(/\d/g) ?? []).length;

const digitRatio = (text: string) => {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return 0;
  return countDigits(compact) / compact.length;
};

const countQuarterTokens = (text: string) => {
  const matches = text.match(/\bQ[1-4](?:\s|-)?(?:20\d{2})?\b/gi);
  return matches ? matches.length : 0;
};

const hasTableKeywordWithNumbers = (text: string) => {
  const lower = text.toLowerCase();
  if (!TABLE_KEYWORDS.some((keyword) => lower.includes(keyword))) return false;
  return countDigits(text) >= 6;
};

const removeSpacedCaps = (text: string) => text.replace(/\b(?:[A-Z]\s+){2,}[A-Z]\b/g, " ");

const removeTableFragments = (text: string) =>
  text
    .replace(/\b\d[\d,.\-\s]{6,}\d\b/g, " ")
    .replace(/(?:\bQ[1-4]\s?-?\s?(?:20\d{2})?\b[\s,;]*){3,}/gi, " ")
    .replace(/\b(?:GAAP|non-GAAP|EPS|diluted|Revenue|Cash flows)\b[^.;\n]{0,80}\d[^.;\n]*/gi, " ");

const trimToBoundary = (text: string, maxLength: number) => {
  const boundaryMatches = [".", ";", "\n", "(", ")"]
    .map((boundary) => text.indexOf(boundary))
    .filter((index) => index > 0);
  const boundaryIndex = boundaryMatches.length ? Math.min(...boundaryMatches) : -1;
  const endIndex = boundaryIndex > 0 ? boundaryIndex : Math.min(text.length, maxLength);
  return text.slice(0, endIndex).trim();
};

const extractAnchorClause = (text: string) => {
  const anchors: Array<RegExp> = [
    /\[commitment\]/i,
    /\bchose to\b/i,
    /\bcommitted to\b/i,
    /\bwill\s+[a-z]{3,}(?:\s+[a-z]{2,})?/i,
  ];
  const matches = anchors
    .map((regex) => {
      const match = regex.exec(text);
      return match ? { index: match.index, length: match[0].length } : null;
    })
    .filter((match): match is { index: number; length: number } => Boolean(match));
  if (matches.length === 0) return null;
  const earliest = matches.reduce((min, match) => (match.index < min.index ? match : min), matches[0]);
  const sliced = text.slice(earliest.index);
  return trimToBoundary(sliced, 160);
};

const removeDespiteLead = (text: string) =>
  text.replace(/^Despite\b[^,]{0,160},\s*/i, "").trim();

const dedupeWords = (text: string) => text.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");

export const normalizeDecisionText = (raw: string): string => {
  if (!raw) return "";
  const cleaned = removeTableFragments(removeSpacedCaps(raw)).replace(/\s+/g, " ").trim();
  const anchored = extractAnchorClause(cleaned);
  const base = anchored ?? trimToBoundary(cleaned, 160);
  const normalized = dedupeWords(removeDespiteLead(base)).replace(/\s+/g, " ").trim();
  if (normalized.length < 12) return "";
  if (digitRatio(normalized) > 0.2) return "";
  return normalized;
};

export const isTableNoise = (raw: string): boolean => {
  if (!raw) return false;
  if (digitRatio(raw) > 0.2) return true;
  if (countQuarterTokens(raw) >= 3) return true;
  if (hasTableKeywordWithNumbers(raw)) return true;
  return false;
};
