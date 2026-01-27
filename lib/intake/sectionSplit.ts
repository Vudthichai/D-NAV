import type { NormalizedPdfPage } from "@/lib/pdf/normalizePdfText";
import { digitRatio, looksTableLike, normalizeWhitespace } from "./decisionScoring";

export type SectionLabel = {
  label: string;
  isLowSignal: boolean;
};

export type SectionSplitResult = {
  pageSections: Record<number, SectionLabel>;
  sections: SectionLabel[];
};

const SECTION_RULES: Array<{ label: string; pattern: RegExp; lowSignal?: boolean }> = [
  { label: "Highlights", pattern: /\bhighlights\b/i },
  { label: "Outlook", pattern: /\boutlook\b/i },
  { label: "Operations", pattern: /\boperations\b/i },
  { label: "Financial Summary", pattern: /\bfinancial summary\b/i, lowSignal: true },
  { label: "Core Technology", pattern: /\bcore technology\b/i },
  { label: "Forward-Looking Statements", pattern: /\bforward-looking statements\b/i, lowSignal: true },
  { label: "Risk Factors", pattern: /\brisk factors\b/i, lowSignal: true },
  { label: "Financial Statements", pattern: /\bfinancial statements\b/i, lowSignal: true },
  { label: "Reconciliations", pattern: /\breconciliations\b/i, lowSignal: true },
];

const detectHeading = (lines: string[]) => {
  for (const line of lines.slice(0, 6)) {
    const cleaned = normalizeWhitespace(line);
    if (!cleaned || cleaned.length > 80) continue;
    for (const rule of SECTION_RULES) {
      if (rule.pattern.test(cleaned)) return rule;
    }
  }
  return null;
};

const pageLooksLowSignal = (text: string, lines: string[]) => {
  if (!text) return true;
  if (digitRatio(text) > 0.22) return true;
  const tableLines = lines.filter((line) => looksTableLike(line)).length;
  return tableLines >= 4;
};

export function splitSections(pages: NormalizedPdfPage[]): SectionSplitResult {
  const pageSections: Record<number, SectionLabel> = {};
  const sections: SectionLabel[] = [];
  let currentSection: SectionLabel | null = null;

  pages.forEach((page) => {
    const headingRule = detectHeading(page.lines);
    if (headingRule) {
      currentSection = { label: headingRule.label, isLowSignal: Boolean(headingRule.lowSignal) };
    }

    const sectionLabel = currentSection ?? { label: "General", isLowSignal: false };
    const lowSignal = sectionLabel.isLowSignal || pageLooksLowSignal(page.text, page.lines);
    const applied = { label: sectionLabel.label, isLowSignal: lowSignal };

    pageSections[page.page] = applied;
    if (!sections.find((entry) => entry.label === applied.label && entry.isLowSignal === applied.isLowSignal)) {
      sections.push(applied);
    }
  });

  return { pageSections, sections };
}
