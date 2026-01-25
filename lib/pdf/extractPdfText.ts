export type PdfProgress = {
  page: number;
  total: number;
};

export type PdfProgressCallback = (progress: PdfProgress) => void;

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

const loadPdfJs = async () => {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjsLib;
};

const extractPageText = async (page: { getTextContent: () => Promise<{ items: unknown[] }> }) => {
  const textContent = await page.getTextContent();
  const lines: string[] = [];
  let currentLine = "";
  let currentY: number | null = null;

  for (const item of textContent.items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const text = typeof (item as { str: string }).str === "string" ? (item as { str: string }).str : "";
    if (!text) continue;
    const transform = (item as { transform?: number[] }).transform;
    const itemY = Array.isArray(transform) ? transform[5] : null;

    if (currentY !== null && itemY !== null && Math.abs(itemY - currentY) > 2) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = text;
      currentY = itemY;
    } else {
      currentLine = currentLine ? `${currentLine} ${text}` : text;
      if (currentY === null && itemY !== null) {
        currentY = itemY;
      }
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.join("\n").trim();
};

export const extractPdfText = async (
  arrayBuffer: ArrayBuffer,
  onProgress?: PdfProgressCallback,
): Promise<string> => {
  const pdfjsLib = await loadPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const pageText = await extractPageText(page);

    if (pageText) {
      pages.push(pageText);
    }

    onProgress?.({ page: pageNumber, total });
  }

  return pages.join("\n\n");
};

export const extractPdfTextByPage = async (
  arrayBuffer: ArrayBuffer,
  onProgress?: PdfProgressCallback,
): Promise<PdfPageText[]> => {
  const pdfjsLib = await loadPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  const pages: PdfPageText[] = [];

  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const pageText = await extractPageText(page);
    if (pageText) {
      pages.push({ pageNumber, text: pageText });
    }
    onProgress?.({ page: pageNumber, total });
  }

  return pages;
};
