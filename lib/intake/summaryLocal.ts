import type { DecisionCandidate } from "./decisionExtractLocal";
import { assessDecisionLikeness } from "./decisionLikeness";
import { isBoilerplate, isTableLike, splitSentences } from "./decisionScoring";
import type { SectionedPage } from "./sectionSplit";
import { classifyMapCategory, MAP_CATEGORY_CONFIG, type MapCategoryKey } from "./decisionMap";

interface DecisionStatement {
  id: string;
  text: string;
  source: string;
}

export interface LocalSummary {
  summary?: string;
  summaryHeadline: string;
  map: Record<MapCategoryKey, string>;
  tags: string[];
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

const buildThemes = (candidates: DecisionCandidate[]): string[] => {
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    candidate.evidence.full
      ?.toLowerCase()
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

const pickHighlightSentences = (
  pages: SectionedPage[],
  candidates: DecisionCandidate[],
): Array<{ sentence: string; page: number }> => {
  const excluded = new Set(candidates.map((candidate) => candidate.evidence.full ?? candidate.decision));
  const scored: Array<{ sentence: string; score: number; page: number }> = [];

  pages
    .filter((page) => !page.isLowSignal)
    .forEach((page) => {
      splitSentences(page.text).forEach((sentence) => {
        const trimmed = sentence.trim();
        if (!trimmed || excluded.has(trimmed)) return;
        if (isBoilerplate(trimmed) || isTableLike(trimmed)) return;
        const decisionCheck = assessDecisionLikeness(trimmed);
        if (decisionCheck.score < 2) return;
        scored.push({ sentence: trimmed, score: decisionCheck.score, page: page.page });
      });
    });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => ({
      sentence: item.sentence,
      page: item.page,
    }));
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const extractTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !STOPWORDS.has(token));

const buildSectionSummary = (key: MapCategoryKey, statements: DecisionStatement[]) => {
  const tokens = new Map<string, number>();
  statements.forEach((statement) => {
    extractTokens(statement.source).forEach((token) => {
      tokens.set(token, (tokens.get(token) ?? 0) + 1);
    });
  });
  const [first, second] = [...tokens.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, 2);
  const topic = [first, second].filter(Boolean).join(" and ");
  if (key === "whatHappened") {
    return topic ? `Recent shifts center on ${topic}.` : "Recent shifts are concentrated in a few areas.";
  }
  if (key === "whatWasDone") {
    return topic ? `The active push is toward ${topic}.` : "Active execution shows a clear operational push.";
  }
  if (key === "whatsBeingBetOn") {
    return topic ? `Strategic bets cluster around ${topic}.` : "Strategic bets are starting to take shape.";
  }
  return topic ? `Next changes point to ${topic}.` : "Near-term changes are beginning to surface.";
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
  const summaryHeadline = introTheme
    ? `${introBase} The signal clusters around ${introTheme}.`
    : introBase;

  const statements: DecisionStatement[] = [];

  candidates.forEach((candidate) => {
    const sourceText = candidate.evidence.full ?? candidate.decision;
    statements.push({
      id: `candidate-${candidate.id}`,
      text: candidate.decision,
      source: sourceText,
    });
  });

  highlights.forEach((highlight) => {
    const decisionCheck = assessDecisionLikeness(highlight.sentence);
    statements.push({
      id: `highlight-${hashString(highlight.sentence)}`,
      text: decisionCheck.rewritten,
      source: highlight.sentence,
    });
  });

  const buckets = new Map<MapCategoryKey, DecisionStatement[]>();
  statements.forEach((statement) => {
    const key = classifyMapCategory(statement.source);
    const list = buckets.get(key) ?? [];
    list.push(statement);
    buckets.set(key, list);
  });

  const fallbackPool = [...statements];

  const map = MAP_CATEGORY_CONFIG.reduce((acc, { key }) => {
    const primary = buckets.get(key) ?? [];
    const selected: DecisionStatement[] = [...primary];
    fallbackPool.forEach((statement) => {
      if (selected.length >= 4) return;
      if (selected.some((item) => item.id === statement.id)) return;
      if (selected.length < 2) {
        selected.push(statement);
      }
    });
    const ensured = selected.slice(0, Math.max(2, Math.min(4, selected.length)));
    acc[key] = buildSectionSummary(key, ensured);
    return acc;
  }, {} as Record<MapCategoryKey, string>);

  return {
    summaryHeadline,
    map,
    tags: themes.map((theme) => theme.charAt(0).toUpperCase() + theme.slice(1)),
  };
}
