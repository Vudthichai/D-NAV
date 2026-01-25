import { extractPdfTextByPage, type PdfPageText, type PdfProgress } from "@/lib/pdf/extractPdfText";

export type DistilledChunk = {
  sourceId: string;
  pageStart: number | null;
  pageEnd: number | null;
  text: string;
};

export type DistillStage = "parsing" | "scanning" | "chunking";

type DistillOptions = {
  onProgress?: (progress: PdfProgress & { fileName: string; fileIndex: number; totalFiles: number }) => void;
  onStageChange?: (stage: DistillStage) => void;
  maxChunkChars?: number;
};

const DEFAULT_MAX_CHUNK_CHARS = 9_000;
const SHORT_LINE_MAX = 80;

const normalizeLine = (line: string) => line.toLowerCase().replace(/\s+/g, " ").trim();

const isBulletLine = (line: string) => /^(\u2022|•|-|\*|\d+[\).])\s+/.test(line.trim());

const isTableLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return true;
  const compact = trimmed.replace(/\s/g, "");
  if (!compact) return true;
  const digitCount = (compact.match(/\d/g) ?? []).length;
  const digitRatio = digitCount / compact.length;
  if (digitRatio > 0.35) return true;
  if (/\d{6,}/.test(compact)) return true;
  if (/( {3,}|\t{2,})/.test(line)) return true;
  return false;
};

const buildHeaderFooterSet = (pages: PdfPageText[]) => {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const lines = page.text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line.length <= SHORT_LINE_MAX);
    const uniqueLines = new Set(lines.map(normalizeLine));
    for (const line of uniqueLines) {
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.6));
  const frequent = new Set<string>();
  for (const [line, count] of counts.entries()) {
    if (count >= threshold) {
      frequent.add(line);
    }
  }
  return frequent;
};

const cleanPageText = (page: PdfPageText, frequentLines: Set<string>) => {
  const rawLines = page.text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const filtered = rawLines.filter((line) => {
    if (frequentLines.has(normalizeLine(line))) return false;
    if (isTableLine(line)) return false;
    return true;
  });

  const blocks: string[] = [];
  for (const line of filtered) {
    if (isBulletLine(line)) {
      blocks.push(line);
      continue;
    }
    if (blocks.length === 0) {
      blocks.push(line);
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (isBulletLine(last)) {
      blocks.push(line);
    } else {
      blocks[blocks.length - 1] = `${last} ${line}`.trim();
    }
  }

  return blocks.join("\n").trim();
};

const splitTextIntoChunks = ({
  sourceId,
  pageStart,
  pageEnd,
  text,
  maxChunkChars,
}: {
  sourceId: string;
  pageStart: number | null;
  pageEnd: number | null;
  text: string;
  maxChunkChars: number;
}): DistilledChunk[] => {
  if (text.length <= maxChunkChars) {
    return [{ sourceId, pageStart, pageEnd, text }];
  }
  const chunks: DistilledChunk[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + maxChunkChars);
    const slice = text.slice(start, end);
    chunks.push({
      sourceId,
      pageStart,
      pageEnd,
      text: slice,
    });
    start = end;
  }
  return chunks;
};

export const distillSources = async (
  files: File[],
  memoText: string,
  options: DistillOptions = {},
): Promise<{ chunks: DistilledChunk[]; warnings: string[] }> => {
  const maxChunkChars = options.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS;
  const chunks: DistilledChunk[] = [];
  const warnings: string[] = [];

  if (files.length > 0) {
    options.onStageChange?.("parsing");
  }

  for (const [index, file] of files.entries()) {
    const buffer = await file.arrayBuffer();
    const pages = await extractPdfTextByPage(buffer, (progress) => {
      options.onProgress?.({
        ...progress,
        fileName: file.name,
        fileIndex: index + 1,
        totalFiles: files.length,
      });
    });
    if (pages.length === 0) continue;

    options.onStageChange?.("scanning");
    const frequentLines = buildHeaderFooterSet(pages);
    const cleanedPages = pages
      .map((page) => ({
        ...page,
        text: cleanPageText(page, frequentLines),
      }))
      .filter((page) => page.text);

    if (cleanedPages.length === 0) continue;

    options.onStageChange?.("chunking");
    let currentText = "";
    let chunkStart: number | null = null;
    let chunkEnd: number | null = null;

    const flush = () => {
      if (!currentText.trim() || chunkStart === null || chunkEnd === null) return;
      chunks.push({
        sourceId: file.name,
        pageStart: chunkStart,
        pageEnd: chunkEnd,
        text: currentText.trim(),
      });
      currentText = "";
      chunkStart = null;
      chunkEnd = null;
    };

    for (const page of cleanedPages) {
      const pageText = page.text.trim();
      if (!pageText) continue;
      const separator = currentText ? "\n\n" : "";
      if ((currentText.length + separator.length + pageText.length) > maxChunkChars) {
        flush();
      }
      if (pageText.length > maxChunkChars) {
        const splitChunks = splitTextIntoChunks({
          sourceId: file.name,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          text: pageText,
          maxChunkChars,
        });
        chunks.push(...splitChunks);
        continue;
      }
      if (!currentText) {
        chunkStart = page.pageNumber;
      }
      chunkEnd = page.pageNumber;
      currentText = `${currentText}${separator}${pageText}`;
    }
    flush();
  }

  const trimmedMemo = memoText.trim();
  if (trimmedMemo) {
    if (files.length === 0) {
      options.onStageChange?.("scanning");
    }
    options.onStageChange?.("chunking");
    const memoChunks = splitTextIntoChunks({
      sourceId: "memo",
      pageStart: null,
      pageEnd: null,
      text: trimmedMemo,
      maxChunkChars,
    });
    chunks.push(...memoChunks);
  }

  if (chunks.length === 0) {
    warnings.push("No readable text found in the provided sources.");
  }

  return { chunks, warnings };
};
