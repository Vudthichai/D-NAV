export interface PageText {
  page: number;
  text: string;
}

export interface SectionedPage extends PageText {
  section: string;
  isLowSignal: boolean;
}

const SECTION_PATTERNS: Array<{ name: string; patterns: RegExp[] }> = [
  { name: "Highlights", patterns: [/\bhighlights?\b/i, /\bkey highlights\b/i] },
  { name: "Outlook", patterns: [/\boutlook\b/i, /\bguidance\b/i] },
  { name: "Operations", patterns: [/\boperations?\b/i, /\bproduction\b/i, /\bmanufacturing\b/i] },
  { name: "Financial Summary", patterns: [/\bfinancial summary\b/i, /\bresults?\b/i] },
  { name: "Core Technology", patterns: [/\bcore technology\b/i, /\bplatform\b/i] },
  { name: "Forward-Looking Statements", patterns: [/\bforward-looking statements?\b/i] },
  { name: "Risk Factors", patterns: [/\brisk factors?\b/i] },
  { name: "Financial Statements", patterns: [/\bfinancial statements?\b/i, /\bbalance sheet\b/i] },
  { name: "Reconciliations", patterns: [/\breconciliations?\b/i, /\bnon-gaap\b/i] },
];

const LOW_SIGNAL_SECTIONS = [
  /forward-looking/i,
  /risk factors?/i,
  /financial statements?/i,
  /reconciliations?/i,
  /non-gaap/i,
  /cash flows?/i,
  /table of contents/i,
  /notes? to/i,
];

const isHeadingLine = (line: string): boolean => {
  if (line.length < 3 || line.length > 90) return false;
  if (/^[A-Z0-9][A-Z0-9\s\-:&/]{3,}$/.test(line)) return true;
  return SECTION_PATTERNS.some(({ patterns }) => patterns.some((pattern) => pattern.test(line)));
};

const matchSection = (line: string): string | null => {
  const matched = SECTION_PATTERNS.find(({ patterns }) => patterns.some((pattern) => pattern.test(line)));
  if (matched) return matched.name;
  if (isHeadingLine(line)) return line.replace(/[:\-]+$/, "").trim();
  return null;
};

const isLowSignal = (section: string): boolean => {
  return LOW_SIGNAL_SECTIONS.some((pattern) => pattern.test(section));
};

export function assignSections(pages: PageText[]): SectionedPage[] {
  let currentSection = "General";
  return pages.map((page) => {
    const lines = page.text.split("\n").map((line) => line.trim()).filter(Boolean);
    lines.forEach((line) => {
      const heading = matchSection(line);
      if (heading) {
        currentSection = heading;
      }
    });

    const section = currentSection;
    return {
      ...page,
      section,
      isLowSignal: isLowSignal(section),
    };
  });
}
