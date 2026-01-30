import { assignSections, type PageText, type SectionedPage } from "./sectionSplit";
import { assessDecisionLikeness } from "./decisionLikeness";
import { scoreSentence, splitSentences } from "./decisionScoring";
import { buildLocalSummary, type LocalSummary } from "./summaryLocal";
import { classifyMapCategory, type MapCategoryKey } from "./decisionMap";
import { normalizeDecisionStatement } from "./decisionNormalization";

export type DecisionCategory =
  | "Operations"
  | "Finance"
  | "Product"
  | "Hiring"
  | "Legal"
  | "Strategy"
  | "Sales/Go-to-market"
  | "Other";

export const DECISION_CATEGORIES: DecisionCategory[] = [
  "Operations",
  "Finance",
  "Product",
  "Hiring",
  "Legal",
  "Strategy",
  "Sales/Go-to-market",
  "Other",
];

export interface DecisionCandidate {
  id: string;
  title: string;
  decision: string;
  statementNormalized: string;
  statementVerbatim: string;
  page?: number;
  mapCategory: MapCategoryKey;
  category: DecisionCategory;
  tags: string[];
  statementType: "decision" | "commitment" | "evidence";
  strength: "committed" | "indicative";
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
  filteringNote: string;
  filteringStats: {
    totalSentences: number;
    filteredOut: number;
    reasons: {
      boilerplate: number;
      tableLike: number;
      lowSignalScore: number;
      belowScoreThreshold: number;
      outcomeOnly: number;
      nonDecision: number;
    };
  };
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

const INTENT_GROUPS: Array<{ key: string; patterns: RegExp[] }> = [
  { key: "energy-storage", patterns: [/\benergy storage\b/i, /\bmegapack\b/i, /\bpowerwall\b/i, /\bmegafactory\b/i] },
  { key: "ai-compute", patterns: [/\bai training\b/i, /\btraining compute\b/i, /\bdojo\b/i, /\bsupercomputer\b/i] },
  { key: "autonomy", patterns: [/\bautonomy\b/i, /\bfsd\b/i, /\brobotaxi\b/i, /\bcybercab\b/i] },
  { key: "manufacturing-ramp", patterns: [/\bmanufactur(?:ing|e)\b/i, /\bproduction\b/i, /\bplant\b/i, /\bfactory\b/i, /\bramp\b/i] },
  { key: "deployment", patterns: [/\bdeploy\b/i, /\bdeployment\b/i, /\brollout\b/i, /\blaunch\b/i] },
  { key: "charging", patterns: [/\bsupercharger\b/i, /\bcharging\b/i] },
  { key: "lithium", patterns: [/\blithium\b/i, /\brefinery\b/i] },
  { key: "semi", patterns: [/\bsemi\b/i, /\btruck\b/i] },
  { key: "affordable-vehicle", patterns: [/\baffordable\b/i, /\blow[-\s]?cost\b/i, /\bnext[-\s]?gen\b/i, /\bplatform\b/i] },
];

const intentKeyFor = (text: string): string | null => {
  for (const group of INTENT_GROUPS) {
    if (group.patterns.some((pattern) => pattern.test(text))) {
      return group.key;
    }
  }
  return null;
};

const dedupeCandidates = (candidates: DecisionCandidate[]): DecisionCandidate[] => {
  const kept: DecisionCandidate[] = [];
  candidates
    .sort((a, b) => b.score - a.score)
    .forEach((candidate) => {
      const tokens = normalizeTokens(candidate.decision);
      const candidateIntent = intentKeyFor(candidate.decision);
      const duplicateIndex = kept.findIndex((existing) => {
        const similarity = jaccard(tokens, normalizeTokens(existing.decision));
        if (similarity > 0.82) return true;
        const existingIntent = intentKeyFor(existing.decision);
        if (candidateIntent && existingIntent && candidateIntent === existingIntent) {
          return similarity > 0.5;
        }
        return false;
      });
      if (duplicateIndex === -1) {
        kept.push(candidate);
        return;
      }
      const existing = kept[duplicateIndex];
      const shouldReplace =
        candidate.score > existing.score ||
        (candidate.strength === "committed" && existing.strength === "indicative") ||
        candidate.decision.length < existing.decision.length;
      if (shouldReplace) {
        kept[duplicateIndex] = candidate;
      }
    });
  return kept;
};

const buildCandidate = (
  sentence: string,
  page: number,
  flags: DecisionCandidate["flags"],
  score: number,
  category: DecisionCategory,
  strength: DecisionCandidate["strength"],
  decisionCheck: ReturnType<typeof assessDecisionLikeness>,
): DecisionCandidate => {
  const trimmed = sentence.trim();
  const statementVerbatim = trimmed;
  const statementNormalized = normalizeDecisionStatement(trimmed);
  return {
    id: `local-${page}-${hashString(trimmed)}`,
    title: buildTitle(trimmed),
    decision: decisionCheck.rewritten,
    statementNormalized,
    statementVerbatim,
    page,
    mapCategory: classifyMapCategory(trimmed),
    category,
    tags: [],
    statementType: decisionCheck.kind,
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
  const minLowSignalScore = options.minLowSignalScore ?? 9;

  const sectioned = assignSections(pages);
  const candidates: DecisionCandidate[] = [];
  const filteringStats: LocalExtractResult["filteringStats"] = {
    totalSentences: 0,
    filteredOut: 0,
    reasons: {
      boilerplate: 0,
      tableLike: 0,
      lowSignalScore: 0,
      belowScoreThreshold: 0,
      outcomeOnly: 0,
      nonDecision: 0,
    },
  };

  sectioned.forEach((page) => {
    const sentences = splitSentences(page.text);
    const scored = sentences
      .map((sentence) => {
        const trimmed = sentence.trim();
        if (!trimmed) return null;
        filteringStats.totalSentences += 1;
        const scoreResult = scoreSentence(trimmed);
        if (scoreResult.flags.isBoilerplate) {
          filteringStats.filteredOut += 1;
          filteringStats.reasons.boilerplate += 1;
          return null;
        }
        if (scoreResult.flags.isTableLike) {
          filteringStats.filteredOut += 1;
          filteringStats.reasons.tableLike += 1;
          return null;
        }
        if (page.isLowSignal && scoreResult.score < minLowSignalScore) {
          filteringStats.filteredOut += 1;
          filteringStats.reasons.lowSignalScore += 1;
          return null;
        }
        if (scoreResult.score < minScore) {
          filteringStats.filteredOut += 1;
          filteringStats.reasons.belowScoreThreshold += 1;
          return null;
        }
        const decisionCheck = assessDecisionLikeness(trimmed);
        if (!decisionCheck.isDecision) {
          filteringStats.filteredOut += 1;
          if (decisionCheck.signals.isOutcomeOnly) {
            filteringStats.reasons.outcomeOnly += 1;
          } else {
            filteringStats.reasons.nonDecision += 1;
          }
          return null;
        }
        const strength = scoreResult.hasCommitment && scoreResult.hasTimeAnchor ? "committed" : "indicative";
        return buildCandidate(
          trimmed,
          page.page,
          scoreResult.flags,
          scoreResult.score,
          scoreResult.category,
          strength,
          decisionCheck,
        );
      })
      .filter((value): value is DecisionCandidate => Boolean(value))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerPage);

    candidates.push(...scored);
  });

  const deduped = dedupeCandidates(candidates);
  const summary = buildLocalSummary(sectioned, deduped, docName);
  const filteringNote =
    filteringStats.filteredOut > 0
      ? `Filtered out ${filteringStats.filteredOut} sentences (boilerplate/table: ${
          filteringStats.reasons.boilerplate + filteringStats.reasons.tableLike
        }, low-signal/score: ${
          filteringStats.reasons.lowSignalScore + filteringStats.reasons.belowScoreThreshold
        }, outcome-only: ${filteringStats.reasons.outcomeOnly}, non-decision: ${filteringStats.reasons.nonDecision}).`
      : "Filtered out 0 sentences.";

  return {
    candidates: deduped,
    summary,
    pages: sectioned,
    filteringNote,
    filteringStats,
  };
}

export const __testables = { dedupeCandidates };
