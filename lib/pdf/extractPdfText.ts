export type PdfProgress = {
  page: number;
  total: number;
};

export type PdfProgressCallback = (progress: PdfProgress) => void;

export type PdfExtractionOptions = {
  maxPages?: number;
  startPage?: number;
  endPage?: number;
  onProgress?: PdfProgressCallback;
};

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

export type PdfExtractionResult = {
  totalPages: number;
  processedPages: number;
  pages: PdfPageText[];
};

const loadPdfJs = async () => {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjsLib;
};

export const extractPdfText = async (
  arrayBuffer: ArrayBuffer,
  options: PdfExtractionOptions = {},
): Promise<PdfExtractionResult> => {
  const pdfjsLib = await loadPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  const startPage = Math.max(1, options.startPage ?? 1);
  const endBound = options.endPage ?? total;
  const endPage = Math.min(total, endBound, options.maxPages ? startPage + options.maxPages - 1 : total);
  const pages: PdfPageText[] = [];

  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({ pageNumber, text: pageText });

    options.onProgress?.({ page: pageNumber, total: endPage });
  }

  return {
    totalPages: total,
    processedPages: pages.length,
    pages,
  };
};
