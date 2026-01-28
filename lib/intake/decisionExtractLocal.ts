import {
  bestCategory,
  bigramSet,
  buildTitle,
  decisionStrength,
  jaccard,
  normalizeSentence,
  scoreSentence,
  splitSentences,
} from "./decisionScoring";
import { splitDocumentIntoSections } from "./sectionSplit";

export type DecisionCandidate = {
  id: string;
  title: string;
  decision: string;
  strength: "hard" | "soft";
  category: "Product" | "Operations" | "Finance" | "Strategy" | "Other";
  evidence: {
    preview: string;
    full: string;
    page: number;
  };
  scores: {
    impact: number;
    cost: number;
    risk: number;
    urgency: number;
    confidence: number;
  };
  meta: {
    score: number;
    isBoilerplate: boolean;
    isTableLike: boolean;
  };
};

export type ExtractedDecisionResult = {
  docName: string;
  pageCount: number;
  candidates: DecisionCandidate[];
};

const QUOTE_PREVIEW_LIMIT = 280;
const DEFAULT_MAX_CANDIDATES = 30;
const DEFAULT_MIN_SCORE = 3;
const DEFAULT_PER_PAGE_LIMIT = 6;
const HIGH_SIGNAL_THRESHOLD = 7;
const DEDUPE_SIMILARITY = 0.6;

const summarizeQuote = (sentence: string) => {
  const normalized = normalizeSentence(sentence);
  if (normalized.length <= QUOTE_PREVIEW_LIMIT) return normalized;
  const trimmed = normalized.slice(0, QUOTE_PREVIEW_LIMIT - 1);
  const lastSpace = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, Math.max(lastSpace, QUOTE_PREVIEW_LIMIT - 1))}…`;
};

const sentenceHash = (sentence: string) => {
  let hash = 5381;
  for (let index = 0; index < sentence.length; index += 1) {
    hash = (hash * 33) ^ sentence.charCodeAt(index);
  }
  return Math.abs(hash).toString(36);
};

const defaultScores = () => ({
  impact: 5,
  cost: 5,
  risk: 5,
  urgency: 5,
  confidence: 5,
});

const buildCandidate = (page: number, sentence: string, score: number) => {
  const normalized = normalizeSentence(sentence);
  const title = buildTitle(normalized);
  const sentenceScore = scoreSentence(normalized);
  return {
    id: `local-${page}-${sentenceHash(normalized)}`,
    title: title || normalized.split(" ").slice(0, 8).join(" "),
    decision: normalized,
    strength: decisionStrength(sentenceScore),
    category: bestCategory(normalized),
    evidence: {
      preview: summarizeQuote(normalized),
      full: normalized,
      page,
    },
    scores: defaultScores(),
    meta: {
      score,
      isBoilerplate: sentenceScore.isBoilerplate,
      isTableLike: sentenceScore.isTableLike,
    },
  } satisfies DecisionCandidate;
};

const pickWinner = (a: DecisionCandidate, b: DecisionCandidate) => {
  if (a.strength !== b.strength) return a.strength === "hard" ? a : b;
  if (a.meta.score !== b.meta.score) return a.meta.score > b.meta.score ? a : b;
  if (a.decision.length !== b.decision.length) return a.decision.length < b.decision.length ? a : b;
  return a.evidence.page <= b.evidence.page ? a : b;
};

export const dedupeCandidates = (candidates: DecisionCandidate[]) => {
  const deduped: DecisionCandidate[] = [];
  candidates.forEach((candidate) => {
    const titleKey = candidate.title.toLowerCase();
    const exactIndex = deduped.findIndex((existing) => existing.title.toLowerCase() === titleKey);
    if (exactIndex !== -1) {
      deduped[exactIndex] = pickWinner(deduped[exactIndex], candidate);
      return;
    }
    const candidateBigrams = bigramSet(candidate.decision);
    const similarIndex = deduped.findIndex(
      (existing) => jaccard(candidateBigrams, bigramSet(existing.decision)) > DEDUPE_SIMILARITY,
    );
    if (similarIndex === -1) {
      deduped.push(candidate);
      return;
    }
    deduped[similarIndex] = pickWinner(deduped[similarIndex], candidate);
  });
  return deduped;
};

export function extractDecisionCandidates(
  document: { docName: string; pageCount: number; pages: Array<{ page: number; text: string }> },
  opts?: { maxCandidates?: number; minScore?: number; perPageLimit?: number },
): ExtractedDecisionResult {
  const maxCandidates = opts?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const minScore = opts?.minScore ?? DEFAULT_MIN_SCORE;
  const perPageLimit = opts?.perPageLimit ?? DEFAULT_PER_PAGE_LIMIT;
  const sectioned = splitDocumentIntoSections(document.pages);

  const candidates: DecisionCandidate[] = [];
  sectioned.forEach((page) => {
    const scored: Array<{ sentence: string; score: number }> = [];
    splitSentences(page.text).forEach((sentence) => {
      const cleaned = normalizeSentence(sentence);
      if (cleaned.length < 40) return;
      const scoring = scoreSentence(cleaned);
      if (scoring.isBoilerplate || scoring.isTableLike) return;
      if (!(scoring.hasCommitment || scoring.hasActionNoun || scoring.hasTimeAnchor)) return;
      if (scoring.score < minScore) return;
      if (page.lowSignal && scoring.score < HIGH_SIGNAL_THRESHOLD) return;
      if (cleaned.length > 320) return;
      scored.push({ sentence: cleaned, score: scoring.score });
    });

    scored.sort((a, b) => b.score - a.score);
    scored.slice(0, perPageLimit).forEach((entry) => {
      candidates.push(buildCandidate(page.page, entry.sentence, entry.score));
    });
  });

  const deduped = dedupeCandidates(candidates);
  const sorted = deduped.sort((a, b) => b.meta.score - a.meta.score || a.evidence.page - b.evidence.page);

  return {
    docName: document.docName,
    pageCount: document.pageCount,
    candidates: sorted.slice(0, maxCandidates),
  };
}

export const __testables = {
  summarizeQuote,
  sentenceHash,
};
