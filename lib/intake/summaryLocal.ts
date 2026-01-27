import type { NormalizedPdfPage } from "@/lib/pdf/normalizePdfText";
import type { SectionSplitResult } from "./sectionSplit";
import { isBoilerplate, looksTableLike, normalizeWhitespace, splitSentences } from "./decisionScoring";

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "to",
  "of",
  "for",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "our",
  "we",
  "their",
  "they",
  "it",
  "as",
  "into",
  "will",
]);

export type SummaryBullet = {
  label: string;
  text: string;
};

export type DocumentSummary = {
  overview: string;
  bullets: SummaryBullet[];
  themes: string[];
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !STOPWORDS.has(token));

const pickThemes = (text: string) => {
  const counts = new Map<string, number>();
  tokenize(text).forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token]) => token);
};

const classifyOverview = (docName: string, themes: string[]) => {
  const name = docName.replace(/\.pdf$/i, "");
  if (/earnings|quarter|q[1-4]|update/i.test(name)) return `This document is an earnings update (${name}).`;
  if (/annual|report/i.test(name)) return `This document is an annual report (${name}).`;
  if (themes.length > 0) return `This document highlights ${themes.slice(0, 3).join(", ")} and key execution updates.`;
  return `This document summarizes recent operational and strategic updates.`;
};

const scoreSummarySentence = (sentence: string, themes: string[]) => {
  const normalized = normalizeWhitespace(sentence);
  if (normalized.length < 40 || normalized.length > 220) return -Infinity;
  if (looksTableLike(normalized) || isBoilerplate(normalized)) return -Infinity;
  const tokens = tokenize(normalized);
  const themeHits = themes.filter((theme) => tokens.includes(theme)).length;
  const verbHits = /(launch|begin|ramp|expand|start|complete|deliver|build|deploy)/i.test(normalized) ? 1 : 0;
  return themeHits * 2 + verbHits + Math.min(tokens.length / 12, 2);
};

const pickBullets = (sentences: string[]) => {
  const labels = ["What happened", "What they did", "What they're betting on", "What changes next"];
  return sentences.slice(0, labels.length).map((sentence, index) => ({
    label: labels[index],
    text: sentence,
  }));
};

export function buildLocalSummary(
  docName: string,
  pages: NormalizedPdfPage[],
  sections: SectionSplitResult,
): DocumentSummary {
  const usablePages = pages.filter((page) => !sections.pageSections[page.page]?.isLowSignal && page.text.trim().length > 0);
  const combined = usablePages.map((page) => page.text).join(" ");
  const themes = pickThemes(combined);

  const sentences = usablePages.flatMap((page) => splitSentences(page.text));
  const scored = sentences
    .map((sentence) => ({ sentence: normalizeWhitespace(sentence), score: scoreSummarySentence(sentence, themes) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.sentence)
    .filter((sentence, index, arr) => arr.findIndex((item) => item === sentence) === index)
    .slice(0, 6);

  const bullets = pickBullets(scored.slice(0, 4));

  return {
    overview: classifyOverview(docName, themes),
    bullets,
    themes,
  };
}
