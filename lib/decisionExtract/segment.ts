import type { CleanedPage } from "@/lib/decisionExtract/cleanText";

export type DecisionSegment = {
  text: string;
  fileName?: string;
  pageNumber: number;
  rawExcerpt: string;
  isRepeatedLine?: boolean;
};

const splitOnDelimiters = (value: string) =>
  value
    .replace(/[•\u2022]/g, "\n")
    .replace(/—/g, "\n")
    .split(/[\n.;:]+/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

const splitLongSegment = (value: string) => {
  if (value.length <= 240) return [value];
  const parts = value
    .split(/,(?![^()]*\))/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [value];
};

const normalizeKey = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

export const segmentDecisionCandidates = (
  pages: CleanedPage[],
  repeatedLines?: Set<string>,
): DecisionSegment[] => {
  const segments: DecisionSegment[] = [];

  for (const page of pages) {
    for (const line of page.lines) {
      const isRepeatedLine = repeatedLines ? repeatedLines.has(normalizeKey(line)) : false;
      const initialSegments = splitOnDelimiters(line);
      for (const segment of initialSegments) {
        const expanded = splitLongSegment(segment);
        for (const chunk of expanded) {
          if (!chunk) continue;
          segments.push({
            text: chunk,
            rawExcerpt: line,
            fileName: page.fileName,
            pageNumber: page.pageNumber,
            isRepeatedLine,
          });
        }
      }
    }
  }

  return segments;
};
