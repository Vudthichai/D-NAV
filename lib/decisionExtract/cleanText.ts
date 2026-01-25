export type PdfPageText = {
  fileName?: string;
  pageNumber: number;
  text: string;
};

export type CleanedPage = {
  fileName?: string;
  pageNumber: number;
  lines: string[];
};

const STOPLINES = [
  "forward-looking",
  "safe harbor",
  "gaap",
  "non-gaap",
  "management believes",
  "conference call",
  "webcast",
  "unaudited",
  "reconciliation",
  "risk factors",
];

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

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const containsCommitmentVerb = (value: string) =>
  COMMITMENT_VERBS.some((verb) => value.toLowerCase().includes(verb));

const isPageNumberLine = (value: string) => /^\s*(page\s*\d+|\d+)\s*$/i.test(value);

const isTableLikeLine = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const digits = trimmed.match(/\d/g)?.length ?? 0;
  const digitRatio = trimmed.length ? digits / trimmed.length : 0;
  const numberCount = trimmed.match(/\d+(?:[.,]\d+)?/g)?.length ?? 0;
  const currencyCount = trimmed.match(/[$€£]|\(\d[\d,.\s]*\)|%/g)?.length ?? 0;
  const columnSeparators = trimmed.match(/\s{2,}|\t|\|/g)?.length ?? 0;
  const tokens = trimmed.split(/\s+/);
  const avgTokenLength = tokens.reduce((sum, token) => sum + token.length, 0) / (tokens.length || 1);
  const tooManyShortTokens = tokens.length >= 10 && avgTokenLength <= 3;

  return (
    digitRatio > 0.25 ||
    numberCount >= 6 ||
    currencyCount >= 2 ||
    columnSeparators >= 3 ||
    tooManyShortTokens
  );
};

const shouldDropBoilerplate = (value: string) => {
  const lowered = value.toLowerCase();
  const containsStopline = STOPLINES.some((line) => lowered.includes(line));
  const hasConditional =
    lowered.includes("may") || lowered.includes("might") || lowered.includes("could") || lowered.includes("subject to");
  if ((containsStopline || hasConditional) && !containsCommitmentVerb(lowered)) {
    return true;
  }
  return false;
};

const shouldDropHeaderFooter = (value: string, repeatedLines: Set<string>) => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (repeatedLines.has(normalized)) return true;
  if (normalized.includes("©") || normalized.includes("copyright")) return true;
  if (normalized.includes("tesla, inc")) return true;
  if (isPageNumberLine(normalized)) return true;
  return false;
};

const buildRepeatedLineSet = (pages: PdfPageText[]) => {
  if (pages.length < 2) return new Set<string>();
  const lineCounts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    const lines = page.text.split(/\n+/).map(normalizeWhitespace).filter(Boolean);
    for (const line of lines) {
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.4));
  return new Set([...lineCounts.entries()].filter(([, count]) => count >= threshold).map(([line]) => line));
};

export const cleanPdfPages = (pages: PdfPageText[]): CleanedPage[] => {
  const repeatedLines = buildRepeatedLineSet(pages);

  return pages.map((page) => {
    const rawLines = page.text.split(/\n+/);
    const lines = rawLines
      .map(normalizeWhitespace)
      .filter(Boolean)
      .filter((line) => !shouldDropHeaderFooter(line, repeatedLines))
      .filter((line) => !shouldDropBoilerplate(line))
      .filter((line) => !isTableLikeLine(line));

    return {
      fileName: page.fileName,
      pageNumber: page.pageNumber,
      lines,
    };
  });
};

export { containsCommitmentVerb, isTableLikeLine, normalizeWhitespace };
