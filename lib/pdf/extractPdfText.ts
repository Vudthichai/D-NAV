export type RawPdfPage = {
  page: number;
  lines: string[];
};

export type PdfExtractResult = {
  docName: string;
  pageCount: number;
  pages: RawPdfPage[];
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
};

const buildLinesFromItems = (items: PdfTextItem[]) => {
  const lines: string[] = [];
  let currentLine = "";
  let currentY: number | null = null;

  items.forEach((item) => {
    const text = item.str ?? "";
    if (!text) return;
    const y = typeof item.transform?.[5] === "number" ? item.transform?.[5] ?? null : null;
    if (currentY === null) {
      currentY = y;
      currentLine = text;
    } else if (y !== null && currentY !== null && Math.abs(y - currentY) > 3) {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = text;
      currentY = y;
    } else {
      currentLine = currentLine ? `${currentLine} ${text}` : text;
    }

    if (item.hasEOL) {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = "";
      currentY = null;
    }
  });

  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines;
};

export async function extractPdfText(file: File): Promise<PdfExtractResult> {
  const pdfjsLib = (await import("pdfjs-dist")) as typeof import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  const pages: RawPdfPage[] = [];

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    const lines = buildLinesFromItems(content.items as PdfTextItem[]);
    pages.push({ page: index, lines });
  }

  return {
    docName: file.name,
    pageCount: pdf.numPages,
    pages,
  };
}

export const __testables = { buildLinesFromItems };
