import type { DecisionCandidate } from "./decisionExtractLocal";
import { scoreSentence, splitSentences } from "./decisionScoring";
import type { SectionedPage } from "./sectionSplit";

export interface LocalSummary {
  intro: string;
  bullets: Array<{ id: string; text: string }>;
  themes: string[];
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "will",
  "are",
  "was",
  "were",
  "into",
  "their",
]);

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const buildThemes = (candidates: DecisionCandidate[]): string[] => {
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    candidate.decision
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3 && !STOPWORDS.has(token))
      .forEach((token) => {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token]) => token);
};

const pickHighlightSentences = (pages: SectionedPage[], candidates: DecisionCandidate[]): string[] => {
  const excluded = new Set(candidates.map((candidate) => candidate.decision));
  const scored: Array<{ sentence: string; score: number }> = [];

  pages
    .filter((page) => !page.isLowSignal)
    .forEach((page) => {
      splitSentences(page.text).forEach((sentence) => {
        const trimmed = sentence.trim();
        if (!trimmed || excluded.has(trimmed)) return;
        const scoreResult = scoreSentence(trimmed);
        if (scoreResult.flags.isBoilerplate || scoreResult.flags.isTableLike) return;
        if (scoreResult.score < 3) return;
        scored.push({ sentence: trimmed, score: scoreResult.score });
      });
    });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => item.sentence)
    .slice(0, 6);
};

export function buildLocalSummary(
  pages: SectionedPage[],
  candidates: DecisionCandidate[],
  docName: string,
): LocalSummary {
  const docLabel = docName.replace(/\.pdf$/i, "").trim();
  const themes = buildThemes(candidates);
  const highlights = pickHighlightSentences(pages, candidates);

  const introTheme = themes.slice(0, 2).join(" and ");
  const introBase = docLabel
    ? `${docLabel} surfaces near-term commitments and operational focus areas.`
    : "This document surfaces near-term commitments and operational focus areas.";
  const intro = introTheme
    ? `${introBase} The signal clusters around ${introTheme}.`
    : introBase;

  const bulletLabels = ["What happened", "What they did", "What they're betting on", "What changes next"];
  const bullets = bulletLabels
    .map((label, index) => {
      const sentence = highlights[index];
      if (!sentence) return null;
      const text = `${label} — ${sentence}`;
      return { id: `summary-${index}-${hashString(text)}`, text };
    })
    .filter((value): value is { id: string; text: string } => Boolean(value));

  return {
    intro,
    bullets,
    themes,
  };
}
