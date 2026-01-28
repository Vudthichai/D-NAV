import { assignSections, type PageText, type SectionedPage } from "./sectionSplit";
import { scoreSentence, splitSentences } from "./decisionScoring";
import { buildLocalSummary, type LocalSummary } from "./summaryLocal";

export type DecisionCategory =
  | "Operations"
  | "Finance"
  | "Product"
  | "Hiring"
  | "Legal"
  | "Strategy"
  | "Sales/Go-to-market"
  | "Other";

export interface DecisionCandidate {
  id: string;
  title: string;
  decision: string;
  category: DecisionCategory;
  strength: "hard" | "soft";
  evidence: {
    page?: number;
    quote?: string;
    full?: string;
  };
  score: number;
  sliders: {
    impact: number;
    cost: number;
    risk: number;
    urgency: number;
    confidence: number;
  };
  flags: {
    isTableLike: boolean;
    isBoilerplate: boolean;
  };
}

export interface LocalExtractOptions {
  maxPerPage?: number;
  minScore?: number;
  minLowSignalScore?: number;
}

export interface LocalExtractResult {
  candidates: DecisionCandidate[];
  summary: LocalSummary;
  pages: SectionedPage[];
}

const DEFAULT_SLIDER_VALUE = 5;
const STOPWORDS = new Set(["the", "and", "for", "with", "that", "this", "from", "will", "are", "was"]);

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const buildTitle = (sentence: string): string => {
  const words = sentence
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOPWORDS.has(word.toLowerCase()));

  const titleWords = words.slice(0, 6);
  if (titleWords.length === 0) return "Decision candidate";
  return titleWords
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .trim();
};

const normalizeTokens = (sentence: string): string[] =>
  sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token));

const jaccard = (a: string[], b: string[]): number => {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((token) => setB.has(token)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
};

const dedupeCandidates = (candidates: DecisionCandidate[]): DecisionCandidate[] => {
  const kept: DecisionCandidate[] = [];
  candidates
    .sort((a, b) => b.score - a.score)
    .forEach((candidate) => {
      const tokens = normalizeTokens(candidate.decision);
      const duplicateIndex = kept.findIndex((existing) => jaccard(tokens, normalizeTokens(existing.decision)) > 0.82);
      if (duplicateIndex === -1) {
        kept.push(candidate);
        return;
      }
      const existing = kept[duplicateIndex];
      const shouldReplace =
        candidate.score > existing.score ||
        (candidate.strength === "hard" && existing.strength === "soft") ||
        candidate.decision.length < existing.decision.length;
      if (shouldReplace) {
        kept[duplicateIndex] = candidate;
      }
    });
  return kept;
};

const buildCandidate = (sentence: string, page: number, flags: DecisionCandidate["flags"], score: number, category: DecisionCategory, strength: "hard" | "soft"): DecisionCandidate => {
  const trimmed = sentence.trim();
  return {
    id: `local-${page}-${hashString(trimmed)}`,
    title: buildTitle(trimmed),
    decision: trimmed,
    category,
    strength,
    evidence: {
      page,
      quote: trimmed.slice(0, 280),
      full: trimmed,
    },
    score,
    sliders: {
      impact: DEFAULT_SLIDER_VALUE,
      cost: DEFAULT_SLIDER_VALUE,
      risk: DEFAULT_SLIDER_VALUE,
      urgency: DEFAULT_SLIDER_VALUE,
      confidence: DEFAULT_SLIDER_VALUE,
    },
    flags,
  };
};

export function extractDecisionCandidatesLocal(
  pages: PageText[],
  options: LocalExtractOptions = {},
  docName = "",
): LocalExtractResult {
  const maxPerPage = options.maxPerPage ?? 6;
  const minScore = options.minScore ?? 4;
  const minLowSignalScore = options.minLowSignalScore ?? 8;

  const sectioned = assignSections(pages);
  const candidates: DecisionCandidate[] = [];

  sectioned.forEach((page) => {
    const sentences = splitSentences(page.text);
    const scored = sentences
      .map((sentence) => {
        const trimmed = sentence.trim();
        if (!trimmed) return null;
        const scoreResult = scoreSentence(trimmed);
        if (scoreResult.flags.isBoilerplate) return null;
        if (page.isLowSignal && scoreResult.score < minLowSignalScore) return null;
        if (scoreResult.score < minScore) return null;
        const strength = scoreResult.hasCommitment && scoreResult.hasTimeAnchor ? "hard" : "soft";
        return buildCandidate(
          trimmed,
          page.page,
          scoreResult.flags,
          scoreResult.score,
          scoreResult.category,
          strength,
        );
      })
      .filter((value): value is DecisionCandidate => Boolean(value))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerPage);

    candidates.push(...scored);
  });

  const deduped = dedupeCandidates(candidates);

  return {
    candidates: deduped,
    summary: buildLocalSummary(sectioned, deduped, docName),
    pages: sectioned,
  };
}

export const __testables = { dedupeCandidates };
