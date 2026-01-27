import type { RawPdfPage } from "./extractPdfText";

export type NormalizedPdfPage = {
  page: number;
  lines: string[];
  text: string;
};

const PAGE_NUMBER_RE = /^(page\s*)?\d+(\s*of\s*\d+)?$/i;

const normalizeLine = (line: string) => line.replace(/\s+/g, " ").trim();

const mergeWrappedLines = (lines: string[]) => {
  const merged: string[] = [];
  let buffer = "";

  lines.forEach((line) => {
    if (!buffer) {
      buffer = line;
      return;
    }

    const endsWithHyphen = /[A-Za-z]-$/.test(buffer);
    const nextStartsLower = /^[a-z0-9(]/.test(line);
    const endsSentence = /[.!?"”)]$/.test(buffer);

    if (endsWithHyphen && nextStartsLower) {
      buffer = `${buffer.slice(0, -1)}${line}`;
      return;
    }

    if (!endsSentence && nextStartsLower) {
      buffer = `${buffer} ${line}`.trim();
      return;
    }

    merged.push(buffer);
    buffer = line;
  });

  if (buffer) merged.push(buffer);
  return merged;
};

export function normalizePdfText(pages: RawPdfPage[]) {
  const cleanedPages = pages.map((page) => {
    const cleanedLines = page.lines.map(normalizeLine).filter(Boolean);
    return { page: page.page, lines: cleanedLines };
  });

  const headerFooterCounts = new Map<string, number>();

  cleanedPages.forEach((page) => {
    const candidates = [...page.lines.slice(0, 2), ...page.lines.slice(-2)].filter((line) => line.length <= 80);
    candidates.forEach((line) => {
      if (PAGE_NUMBER_RE.test(line)) return;
      headerFooterCounts.set(line, (headerFooterCounts.get(line) ?? 0) + 1);
    });
  });

  const threshold = Math.max(2, Math.ceil(cleanedPages.length * 0.4));
  const repeated = new Set(
    [...headerFooterCounts.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([line]) => line),
  );

  const normalizedPages: NormalizedPdfPage[] = cleanedPages.map((page) => {
    const filteredLines = page.lines.filter((line) => !repeated.has(line) && !PAGE_NUMBER_RE.test(line));
    const merged = mergeWrappedLines(filteredLines);
    const text = merged.join("\n").replace(/\s+\n/g, "\n").trim();
    return { page: page.page, lines: merged, text };
  });

  return {
    pages: normalizedPages,
    removedHeaders: [...repeated],
  };
}

export const __testables = { mergeWrappedLines };
