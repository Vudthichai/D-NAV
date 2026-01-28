export type NormalizedPage = { page: number; text: string };

type NormalizedDocument = {
  docName: string;
  pageCount: number;
  pages: NormalizedPage[];
};

const normalizeWhitespace = (text: string) =>
  text
    .replace(/\u00ad/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const dehyphenate = (text: string) => text.replace(/([a-zA-Z])-\n([a-zA-Z])/g, "$1$2");

const normalizeLineWraps = (text: string) => {
  const lines = text.split("\n").map((line) => line.trim());
  const merged: string[] = [];
  let current = "";

  lines.forEach((line) => {
    if (!line) {
      if (current) {
        merged.push(current);
        current = "";
      }
      return;
    }

    if (!current) {
      current = line;
      return;
    }

    const endsSentence = /[.!?]$/.test(current);
    const nextLooksContinuation = /^[a-z0-9(]/.test(line);
    if (!endsSentence && nextLooksContinuation) {
      current = `${current} ${line}`.trim();
    } else {
      merged.push(current);
      current = line;
    }
  });

  if (current) merged.push(current);
  return merged.join("\n");
};

const headerFooterKey = (line: string) =>
  line
    .toLowerCase()
    .replace(/\bpage\s+\d+\b/g, "")
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, "")
    .replace(/\d{4}/g, "")
    .replace(/[^a-z]/g, "")
    .trim();

const isHeaderFooterLine = (line: string, repeatedKeys: Set<string>) => {
  const key = headerFooterKey(line);
  if (!key || key.length < 4) return false;
  return repeatedKeys.has(key);
};

const collectRepeatingHeaders = (pages: NormalizedPage[]) => {
  const lineCounts = new Map<string, number>();
  pages.forEach((page) => {
    const lines = page.text.split("\n").map((line) => line.trim());
    const seen = new Set<string>();
    lines.forEach((line) => {
      if (!line) return;
      const key = headerFooterKey(line);
      if (!key || key.length < 4) return;
      if (seen.has(key)) return;
      seen.add(key);
      lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
    });
  });

  const threshold = Math.max(2, Math.ceil(pages.length * 0.4));
  const repeated = new Set<string>();
  lineCounts.forEach((count, key) => {
    if (count >= threshold) repeated.add(key);
  });
  return repeated;
};

export function normalizePdfText(document: NormalizedDocument): NormalizedDocument {
  const basePages = document.pages.map((page) => ({
    page: page.page,
    text: normalizeLineWraps(dehyphenate(normalizeWhitespace(page.text))),
  }));

  const repeatedKeys = collectRepeatingHeaders(basePages);

  const cleanedPages = basePages.map((page) => {
    const filteredLines = page.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !isHeaderFooterLine(line, repeatedKeys));
    return { page: page.page, text: filteredLines.join("\n").trim() };
  });

  return {
    ...document,
    pages: cleanedPages,
  };
}

export const __testables = {
  normalizeWhitespace,
  dehyphenate,
  normalizeLineWraps,
  collectRepeatingHeaders,
};
