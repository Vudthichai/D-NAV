import { normalizeSentence, scoreSentence, splitSentences } from "./decisionScoring";
import { splitDocumentIntoSections } from "./sectionSplit";

export type SummaryBullet = {
  label: "What happened" | "What they did" | "What they’re betting on" | "What changes next";
  text: string;
};

export type LocalSummary = {
  overview: string;
  themes: string[];
  bullets: SummaryBullet[];
};

const THEME_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "were",
  "was",
  "are",
  "our",
  "their",
  "they",
  "these",
  "those",
  "into",
  "will",
  "have",
  "has",
  "had",
  "its",
]);

const extractThemes = (text: string) => {
  const counts = new Map<string, number>();
  text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !THEME_STOPWORDS.has(token))
    .forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token]) => token);
};

const pickSentence = (sentences: string[], matcher: (sentence: string) => boolean) => {
  const candidates = sentences.filter(matcher);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => scoreSentence(b).score - scoreSentence(a).score);
  return candidates[0];
};

export function buildLocalSummary(document: { docName: string; pages: Array<{ page: number; text: string }> }): LocalSummary {
  const sectioned = splitDocumentIntoSections(document.pages);
  const highSignalText = sectioned.filter((page) => !page.lowSignal).map((page) => page.text).join("\n");
  const themes = extractThemes(highSignalText);

  const sentences = splitSentences(highSignalText)
    .map((sentence) => normalizeSentence(sentence))
    .filter((sentence) => sentence.length > 50 && sentence.length < 260)
    .filter((sentence) => {
      const score = scoreSentence(sentence);
      return !score.isBoilerplate && !score.isTableLike;
    });

  const overviewThemes = themes.slice(0, 3).join(", ");
  const overview = overviewThemes
    ? `This document summarizes updates on ${overviewThemes}, with operational and strategic actions highlighted.`
    : `This document summarizes operational and strategic updates with forward-looking commitments.`;

  const bullets: SummaryBullet[] = [
    {
      label: "What happened",
      text:
        pickSentence(sentences, (sentence) => /\b(completed|delivered|achieved|record|expanded)\b/i.test(sentence)) ??
        "Reported progress on execution and recent operational milestones.",
    },
    {
      label: "What they did",
      text:
        pickSentence(sentences, (sentence) => /\b(began|launched|deployed|built|opened|ramped)\b/i.test(sentence)) ??
        "Advanced ongoing initiatives with concrete delivery steps.",
    },
    {
      label: "What they’re betting on",
      text:
        pickSentence(sentences, (sentence) => /\b(plan|expect|will|target|roadmap|strategy)\b/i.test(sentence)) ??
        "Outlined the strategic bets that shape near-term priorities.",
    },
    {
      label: "What changes next",
      text:
        pickSentence(sentences, (sentence) => /\b(next|later|by end|scheduled|on track)\b/i.test(sentence)) ??
        "Flagged the next shifts in timelines, launches, and capacity.",
    },
  ];

  return {
    overview,
    themes,
    bullets,
  };
}
