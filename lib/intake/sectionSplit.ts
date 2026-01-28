export type SectionLabel =
  | "Highlights"
  | "Outlook"
  | "Operations"
  | "Financial Summary"
  | "Core Technology"
  | "Forward-Looking Statements"
  | "Financial Statements"
  | "Risk Factors"
  | "Reconciliations"
  | "Other";

export type SectionedPage = {
  page: number;
  text: string;
  section: SectionLabel;
  lowSignal: boolean;
};

const SECTION_HEADINGS: Array<{ label: SectionLabel; re: RegExp }> = [
  { label: "Highlights", re: /\b(highlights|summary highlights|key highlights)\b/i },
  { label: "Outlook", re: /\b(outlook|guidance)\b/i },
  { label: "Operations", re: /\b(operations|manufacturing|production|capacity)\b/i },
  { label: "Financial Summary", re: /\b(financial summary|financial overview|financial highlights)\b/i },
  { label: "Core Technology", re: /\b(core technology|technology platform|autonomy|ai platform)\b/i },
  { label: "Forward-Looking Statements", re: /\bforward-looking statements?\b/i },
  { label: "Financial Statements", re: /\b(financial statements?|income statement|balance sheet|cash flows?)\b/i },
  { label: "Risk Factors", re: /\brisk factors?\b/i },
  { label: "Reconciliations", re: /\bnon-gaap reconciliations?|reconciliations?\b/i },
];

const LOW_SIGNAL_SECTIONS = new Set<SectionLabel>([
  "Forward-Looking Statements",
  "Financial Statements",
  "Risk Factors",
  "Reconciliations",
]);

const detectHeading = (line: string) => {
  const normalized = line.trim();
  for (const heading of SECTION_HEADINGS) {
    if (heading.re.test(normalized)) return heading.label;
  }
  if (/^[A-Z][A-Z\s&/()-]{6,}$/.test(normalized)) return "Other";
  return null;
};

export function splitDocumentIntoSections(pages: Array<{ page: number; text: string }>): SectionedPage[] {
  let currentSection: SectionLabel = "Other";
  return pages.map((page) => {
    const lines = page.text.split("\n");
    for (const line of lines) {
      const heading = detectHeading(line);
      if (heading) {
        currentSection = heading;
        break;
      }
    }
    return {
      page: page.page,
      text: page.text,
      section: currentSection,
      lowSignal: LOW_SIGNAL_SECTIONS.has(currentSection),
    };
  });
}

export const __testables = {
  detectHeading,
  LOW_SIGNAL_SECTIONS,
};
