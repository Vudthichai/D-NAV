import type { EvidenceAnchor, RawCandidate, UploadedDoc } from "@/components/stress-test/decision-intake-types";

type PageTextData = {
  pageTextRaw: string;
  pageLines: string[];
  paragraphText: string;
};

const COMMITMENT_VERBS = [
  "will",
  "plan to",
  "plans to",
  "expects to",
  "expect to",
  "aims to",
  "aim to",
  "scheduled to",
  "begin",
  "ramp",
  "launch",
  "approve",
  "approved",
  "build",
  "expand",
  "reduce",
  "increase",
  "start",
  "stop",
  "delay",
  "enter",
  "exit",
  "invest",
  "hire",
];

const ACTION_TERMS = [
  "build",
  "launch",
  "ramp",
  "increase",
  "reduce",
  "expand",
  "start",
  "stop",
  "delay",
  "enter",
  "exit",
  "deploy",
  "open",
  "close",
  "restructure",
  "hire",
  "layoff",
  "capex",
  "headcount",
];

const FINANCIAL_FIELD_NAMES = [
  "operating cash flow",
  "net income attributable",
  "gross margin",
  "revenue",
  "earnings per share",
  "eps",
  "gaap",
  "non-gaap",
  "cash flows",
  "balance sheet",
  "income statement",
];

const DATE_PATTERNS = [
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{2,4})?\b/gi,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  /\bQ[1-4]\s?20\d{2}\b/gi,
  /\b[12]H\s?20\d{2}\b/gi,
  /\bFY\s?20\d{2}\b/gi,
  /\b(?:later this year|later this quarter|next quarter|next year|next month)\b/gi,
];

const cleanLine = (line: string) => line.replace(/\s+/g, " ").trim();

const ingestPageText = (text: string): PageTextData => {
  const pageTextRaw = text ?? "";
  const pageLines = pageTextRaw.split(/\r?\n/).map((line) => cleanLine(line));
  const paragraphText = cleanLine(pageLines.filter(Boolean).join(" "));
  return {
    pageTextRaw,
    pageLines,
    paragraphText,
  };
};

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const buildSentenceUnits = (paragraphText: string) =>
  splitSentences(paragraphText).filter((unit) => unit.length >= 30 && unit.length <= 280);

const buildLineUnits = (lines: string[]) => {
  const units: string[] = [];
  let buffer = "";
  lines.forEach((line) => {
    if (!line) return;
    if (!buffer) {
      buffer = line;
      return;
    }
    const merged = `${buffer} ${line}`.trim();
    if (merged.length <= 280) {
      buffer = merged;
      return;
    }
    if (buffer.length >= 30 && buffer.length <= 280) {
      units.push(buffer);
    }
    buffer = line;
  });
  if (buffer.length >= 30 && buffer.length <= 280) {
    units.push(buffer);
  }
  return units;
};

const countDigits = (text: string) => (text.match(/\d/g) ?? []).length;

const digitRatio = (text: string) => {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return 0;
  return countDigits(compact) / compact.length;
};

const mostlyNumbersOrSymbols = (text: string) => {
  const letters = (text.match(/[a-z]/gi) ?? []).length;
  if (letters === 0) return true;
  const nonLetters = text.length - letters;
  return nonLetters / text.length > 0.6 && countDigits(text) >= 4;
};

const isAllCapsHeader = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  return trimmed === trimmed.toUpperCase() && /^[A-Z\s&-]+$/.test(trimmed);
};

const looksLikeTableRow = (text: string) => {
  const commaCount = (text.match(/,/g) ?? []).length;
  const separatorCount = (text.match(/[|•·]/g) ?? []).length;
  return (commaCount >= 4 && digitRatio(text) > 0.18) || separatorCount >= 4;
};

const containsFinancialFieldsOnly = (text: string) => {
  const lower = text.toLowerCase();
  const hasField = FINANCIAL_FIELD_NAMES.some((field) => lower.includes(field));
  if (!hasField) return false;
  const hasVerb = COMMITMENT_VERBS.some((verb) => lower.includes(verb));
  return !hasVerb;
};

const isTableNoise = (text: string) => {
  if (mostlyNumbersOrSymbols(text)) return true;
  if (isAllCapsHeader(text)) return true;
  if (looksLikeTableRow(text)) return true;
  if (containsFinancialFieldsOnly(text)) return true;
  return false;
};

const hasCommitmentVerb = (text: string) =>
  COMMITMENT_VERBS.some((verb) => text.toLowerCase().includes(verb));

const hasActionObject = (text: string) => ACTION_TERMS.some((term) => text.toLowerCase().includes(term));

const hasTimeConstraint = (text: string) =>
  /\b(by|before|later this year|later this quarter|next quarter|next year|q[1-4]|[12]h\s?20\d{2}|fy\s?20\d{2})\b/i.test(
    text,
  );

const isDisclaimer = (text: string) => /\b(may|might|could)\b/i.test(text);

const isPurePastFact = (text: string) =>
  /\b(was|were|reported|delivered|achieved|completed|grew|declined|decreased|increased)\b/i.test(text) &&
  !hasCommitmentVerb(text);

const extractDateMentions = (text: string) => {
  const matches = DATE_PATTERNS.flatMap((pattern) => text.match(pattern) ?? []);
  return Array.from(new Set(matches));
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const scoreCandidate = (text: string) => {
  let score = 0;
  const tableNoise = isTableNoise(text);
  const tooNumeric = digitRatio(text) > 0.28 || containsFinancialFieldsOnly(text);

  if (hasCommitmentVerb(text)) score += 0.35;
  if (hasTimeConstraint(text)) score += 0.2;
  if (hasActionObject(text)) score += 0.2;
  if (tableNoise) score -= 0.25;
  if (tooNumeric) score -= 0.15;
  if (isDisclaimer(text)) score -= 0.1;
  if (isPurePastFact(text)) score -= 0.2;

  score = clamp(score);
  if (tableNoise) score = Math.min(score, 0.35);
  return { score, tableNoise };
};

const findLineIndexForUnit = (lines: string[], unit: string) => {
  if (lines.length === 0) return -1;
  const probe = unit.slice(0, 32).toLowerCase();
  const exactIndex = lines.findIndex((line) => line.toLowerCase().includes(probe));
  if (exactIndex >= 0) return exactIndex;
  return lines.findIndex((line) => line.toLowerCase().includes(unit.toLowerCase()));
};

const buildContextText = (lines: string[], unit: string, lineIndex: number) => {
  if (lineIndex < 0) return unit;
  const prevLine = lines
    .slice(0, lineIndex)
    .reverse()
    .find((line) => line.trim().length > 0);
  const nextLine = lines.slice(lineIndex + 1).find((line) => line.trim().length > 0);
  return [prevLine, unit, nextLine].filter(Boolean).join("\n");
};

const findSectionHint = (lines: string[], lineIndex: number) => {
  if (lineIndex < 0) return undefined;
  for (let i = lineIndex; i >= 0; i -= 1) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (isAllCapsHeader(line) || line.endsWith(":")) {
      return line;
    }
  }
  return undefined;
};

export const buildRawCandidates = (docs: UploadedDoc[]): RawCandidate[] => {
  const rawCandidates: RawCandidate[] = [];
  docs.forEach((doc) => {
    doc.pages.forEach((page) => {
      const { pageLines, paragraphText } = ingestPageText(page.text);
      const sentenceUnits = buildSentenceUnits(paragraphText);
      const units = sentenceUnits.length > 0 ? sentenceUnits : buildLineUnits(pageLines);

      units.forEach((unit, unitIndex) => {
        if (unit.length < 30 || unit.length > 280) return;
        const { score, tableNoise } = scoreCandidate(unit);
        const lineIndex = findLineIndexForUnit(pageLines, unit);
        const contextText = buildContextText(pageLines, unit, lineIndex);
        const sectionHint = findSectionHint(pageLines, lineIndex);
        const dateMentions = extractDateMentions(unit);
        const evidence: EvidenceAnchor = {
          docId: doc.id,
          fileName: doc.fileName,
          page: page.pageNumber,
          excerpt: unit,
        };

        rawCandidates.push({
          id: `${doc.id}-p${page.pageNumber}-u${unitIndex}`,
          docId: doc.id,
          page: page.pageNumber,
          rawText: unit,
          contextText,
          sectionHint,
          knowsItIsTableNoise: tableNoise,
          extractionScore: score,
          dateMentions,
          evidence: [evidence],
        });
      });
    });
  });
  return rawCandidates;
};
