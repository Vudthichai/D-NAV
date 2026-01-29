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
  narrativeSummary: string;
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

const NARRATIVE_MIN_CHARS = 350;
const NARRATIVE_MAX_CHARS = 550;

const PRIORITY_PHRASES = [
  "we expect",
  "will",
  "aim",
  "plan",
  "scheduled",
  "begin ramping",
  "launch",
  "on track",
  "completed",
  "continues to",
  "in 2025",
];

const SIGNAL_KEYWORDS = [
  "powerwall",
  "megapack",
  "energy",
  "storage",
  "autonomy",
  "fsd",
  "robotaxi",
  "optimus",
  "manufacturing",
  "factory",
  "ramp",
  "production",
  "capacity",
  "compute",
  "capex",
  "cogs",
  "cost",
  "margin",
  "battery",
  "4680",
  "supply",
];

const trimToLength = (text: string, maxChars: number) => {
  if (text.length <= maxChars) return text;
  const clipped = text.slice(0, maxChars);
  const lastSentenceEnd = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  if (lastSentenceEnd >= NARRATIVE_MIN_CHARS) {
    return clipped.slice(0, lastSentenceEnd + 1);
  }
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, Math.max(0, lastSpace))}…`.trim();
};

const scoreNarrativeSentence = (sentence: string) => {
  const lower = sentence.toLowerCase();
  let score = 0;
  PRIORITY_PHRASES.forEach((phrase) => {
    if (lower.includes(phrase)) score += 4;
  });
  SIGNAL_KEYWORDS.forEach((keyword) => {
    if (lower.includes(keyword)) score += 2;
  });
  if (/\b20(2[4-9]|3[0-2])\b/.test(lower)) score += 2;
  if (sentence.length >= 60 && sentence.length <= 220) score += 1;
  const decisionCheck = assessDecisionLikeness(sentence);
  score += Math.min(4, Math.max(0, decisionCheck.score));
  return score;
};

const buildNarrativeSummary = (pages: SectionedPage[]) => {
  const scored: Array<{ sentence: string; score: number; page: number; index: number }> = [];
  let globalIndex = 0;

  pages.forEach((page) => {
    if (page.isLowSignal) return;
    splitSentences(page.text).forEach((sentence) => {
      const trimmed = sentence.trim();
      globalIndex += 1;
      if (!trimmed) return;
      if (isBoilerplate(trimmed) || isTableLike(trimmed)) return;
      const score = scoreNarrativeSentence(trimmed);
      if (score < 5) return;
      scored.push({ sentence: trimmed, score, page: page.page, index: globalIndex });
    });
  });

  const topCandidates = scored.sort((a, b) => b.score - a.score).slice(0, 8);
  const ordered = [...topCandidates].sort((a, b) => (a.page - b.page) || (a.index - b.index));

  const selected: string[] = [];
  let totalLength = 0;
  ordered.forEach((candidate) => {
    if (selected.length >= 4) return;
    if (totalLength >= NARRATIVE_MAX_CHARS) return;
    selected.push(candidate.sentence);
    totalLength += candidate.sentence.length + 1;
  });

  if (selected.length === 0) {
    return "This document outlines operational priorities, capacity ramps, and near-term product plans.";
  }

  const summaryText = selected.join(" ").replace(/\s+/g, " ").trim();
  if (summaryText.length < NARRATIVE_MIN_CHARS && topCandidates.length > selected.length) {
    topCandidates
      .filter((candidate) => !selected.includes(candidate.sentence))
      .some((candidate) => {
        if (selected.length >= 4) return true;
        selected.push(candidate.sentence);
        return false;
      });
  }

  return trimToLength(selected.join(" ").replace(/\s+/g, " ").trim(), NARRATIVE_MAX_CHARS);
};

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
  const narrativeSummary = buildNarrativeSummary(pages);

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
    summary: narrativeSummary,
    narrativeSummary,
    summaryHeadline,
    map,
    tags: themes.map((theme) => theme.charAt(0).toUpperCase() + theme.slice(1)),
  };
}
