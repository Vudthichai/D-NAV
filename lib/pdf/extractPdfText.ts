export type ExtractedPdfPage = { page: number; text: string };

export type ExtractedPdfDocument = {
  docName: string;
  pageCount: number;
  pages: ExtractedPdfPage[];
};

export async function extractPdfText(file: File): Promise<ExtractedPdfDocument> {
  const pdfjsLib = (await import("pdfjs-dist")) as typeof import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pages: ExtractedPdfPage[] = [];

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => {
        if (!("str" in item)) return "";
        const suffix = (item as { hasEOL?: boolean }).hasEOL ? "\n" : " ";
        return `${item.str}${suffix}`;
      })
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
    pages.push({ page: index, text });
  }

  return {
    docName: file.name,
    pageCount: pdf.numPages,
    pages,
  };
}
