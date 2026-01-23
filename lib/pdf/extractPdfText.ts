export type PdfProgress = {
  page: number;
  total: number;
};

export type PdfProgressCallback = (progress: PdfProgress) => void;

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
  onProgress?: PdfProgressCallback,
): Promise<string> => {
  const pdfjsLib = await loadPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .filter(Boolean)
      .join(" ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }

    onProgress?.({ page: pageNumber, total });
  }

  return pages.join("\n\n");
};
