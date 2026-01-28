import { normalizePdfText } from "./normalizePdfText";

export interface PdfTextPage {
  page: number;
  text: string;
  charCount: number;
}

export interface PdfExtractResult {
  docName: string;
  pageCount: number;
  pages: PdfTextPage[];
}

interface ExtractOptions {
  onProgress?: (info: { page: number; pageCount: number; totalChars: number }) => void;
}

const HEADER_FOOTER_CANDIDATE_LINES = 2;

const stripRepeatedLines = (pages: PdfTextPage[]): PdfTextPage[] => {
  if (pages.length === 0) return pages;
  const counts = new Map<string, number>();

  pages.forEach((page) => {
    const lines = page.text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const head = lines.slice(0, HEADER_FOOTER_CANDIDATE_LINES);
    const tail = lines.slice(Math.max(lines.length - HEADER_FOOTER_CANDIDATE_LINES, 0));
    [...head, ...tail].forEach((line) => {
      if (line.length < 3 || line.length > 80) return;
      counts.set(line, (counts.get(line) ?? 0) + 1);
    });
  });

  const threshold = Math.max(2, Math.ceil(pages.length * 0.6));
  const repeated = new Set(
    [...counts.entries()].filter(([, count]) => count >= threshold).map(([line]) => line),
  );

  if (repeated.size === 0) return pages;

  return pages.map((page) => {
    const filtered = page.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !repeated.has(line))
      .join("\n")
      .trim();
    return {
      ...page,
      text: filtered,
      charCount: filtered.length,
    };
  });
};

export async function extractPdfText(file: File, options: ExtractOptions = {}): Promise<PdfExtractResult> {
  const pdfjsLib = (await import("pdfjs-dist")) as typeof import("pdfjs-dist");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pages: PdfTextPage[] = [];
  let totalChars = 0;

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    const raw = content.items
      .map((item) => {
        if (!("str" in item)) return "";
        const suffix = (item as { hasEOL?: boolean }).hasEOL ? "\n" : " ";
        return `${item.str}${suffix}`;
      })
      .join("");
    const text = normalizePdfText(raw);
    totalChars += text.length;
    pages.push({ page: index, text, charCount: text.length });
    options.onProgress?.({ page: index, pageCount: pdf.numPages, totalChars });
  }

  const cleanedPages = stripRepeatedLines(pages);

  return {
    docName: file.name,
    pageCount: pdf.numPages,
    pages: cleanedPages,
  };
}
