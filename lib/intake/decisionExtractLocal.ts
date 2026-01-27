import type { NormalizedPdfPage } from "@/lib/pdf/normalizePdfText";
import type { SectionSplitResult } from "./sectionSplit";
import {
  bestCategory,
  hasStrongCommitmentVerb,
  normalizeForDedup,
  normalizeWhitespace,
  scoreDecisionSentence,
  splitSentences,
} from "./decisionScoring";

export type DecisionStrength = "hard" | "soft";

export type DecisionCandidate = {
  id: string;
  title: string;
  decision: string;
  strength: DecisionStrength;
  category: ReturnType<typeof bestCategory>;
  score: number;
  evidence: {
    page: number;
    quote: string;
    fullQuote: string;
  };
  sliders: {
    impact: number;
    cost: number;
    risk: number;
    urgency: number;
    confidence: number;
  };
  tags: string[];
  section?: string;
  alsoSeenOnPages?: number[];
  meta: {
    isTableLike: boolean;
    isBoilerplate: boolean;
    isLowSignalSection: boolean;
    digitRatio: number;
  };
};

type CandidateDraftInput = {
  page: number;
  sentence: string;
  score: number;
  strength: DecisionStrength;
  isTableLike: boolean;
  isBoilerplate: boolean;
  isLowSignalSection: boolean;
  digitRatio: number;
};

const QUOTE_LIMIT = 280;
const DEFAULT_MAX_CANDIDATES = 28;
const DEFAULT_MIN_SCORE = 3;
const DEFAULT_PER_PAGE_LIMIT = 6;
const LOW_SIGNAL_MIN_SCORE = 7;
const DEDUPE_SIMILARITY = 0.58;

const buildTitle = (sentence: string) => {
  const cleaned = sentence
    .replace(/[“”"]/g, "")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/\b(Tesla|Company|We|Our|Management)\b\s*/i, "")
    .replace(/^(Q[1-4]\s?\d{4}|\d{4}|First half|Second half)\b\s*/i, "")
    .trim();
  const words = cleaned.split(/\s+/);
  const slice = words.length >= 8 ? words.slice(0, 10) : words.slice(0, 8);
  return slice.join(" ").replace(/[.,;:]+$/, "");
};

const summarizeSentence = (sentence: string) => {
  const normalized = normalizeWhitespace(sentence);
  if (normalized.length <= QUOTE_LIMIT) return normalized;
  const trimmed = normalized.slice(0, QUOTE_LIMIT - 1);
  const lastSpace = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, Math.max(lastSpace, 220))}…`;
};

const buildTags = (text: string) => {
  const tags = new Set<string>();
  const lowered = text.toLowerCase();
  if (lowered.includes("factory") || lowered.includes("plant")) tags.add("factory");
  if (lowered.includes("ramp")) tags.add("ramp");
  if (lowered.includes("launch")) tags.add("launch");
  if (lowered.includes("production")) tags.add("production");
  if (lowered.includes("commission")) tags.add("commissioning");
  return [...tags];
};

const buildCandidate = (input: CandidateDraftInput): DecisionCandidate => {
  const title = buildTitle(input.sentence);
  const summary = summarizeSentence(input.sentence);
  const quote = normalizeWhitespace(input.sentence);
  const hash = Math.abs(quote.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0));
  return {
    id: `local-${input.page}-${hash}`,
    title: title || summary.slice(0, 60),
    decision: summary,
    strength: input.strength,
    category: bestCategory(quote),
    score: input.score,
    evidence: {
      page: input.page,
      quote: summary,
      fullQuote: quote,
    },
    sliders: {
      impact: 5,
      cost: 5,
      risk: 5,
      urgency: 5,
      confidence: 5,
    },
    tags: buildTags(quote),
    meta: {
      isTableLike: input.isTableLike,
      isBoilerplate: input.isBoilerplate,
      isLowSignalSection: input.isLowSignalSection,
      digitRatio: input.digitRatio,
    },
  };
};

const bigramSet = (text: string) => {
  const tokens = normalizeForDedup(text).split(/\s+/).filter(Boolean);
  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    bigrams.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
};

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const compareCandidates = (a: DecisionCandidate, b: DecisionCandidate) => {
  if (a.strength !== b.strength) return a.strength === "hard" ? a : b;
  if (a.score !== b.score) return a.score > b.score ? a : b;
  return a.decision.length <= b.decision.length ? a : b;
};

const dedupeCandidates = (candidates: DecisionCandidate[]) => {
  const deduped: DecisionCandidate[] = [];
  candidates.forEach((candidate) => {
    const titleKey = candidate.title.toLowerCase();
    const exactIndex = deduped.findIndex((existing) => existing.title.toLowerCase() === titleKey);
    if (exactIndex !== -1) {
      const existing = deduped[exactIndex];
      const winner = compareCandidates(candidate, existing);
      const pages = new Set([existing.evidence.page, candidate.evidence.page, ...(existing.alsoSeenOnPages ?? [])]);
      winner.alsoSeenOnPages = [...pages].sort((a, b) => a - b);
      deduped[exactIndex] = winner;
      return;
    }

    const candidateBigrams = bigramSet(candidate.evidence.fullQuote);
    const similarIndex = deduped.findIndex(
      (existing) => jaccard(candidateBigrams, bigramSet(existing.evidence.fullQuote)) > DEDUPE_SIMILARITY,
    );
    if (similarIndex === -1) {
      deduped.push(candidate);
      return;
    }

    const existing = deduped[similarIndex];
    const winner = compareCandidates(candidate, existing);
    const pages = new Set([existing.evidence.page, candidate.evidence.page, ...(existing.alsoSeenOnPages ?? [])]);
    winner.alsoSeenOnPages = [...pages].sort((a, b) => a - b);
    deduped[similarIndex] = winner;
  });
  return deduped;
};

export function extractDecisionCandidates(
  pages: NormalizedPdfPage[],
  sections: SectionSplitResult,
  opts?: { maxCandidates?: number; minScore?: number; perPageLimit?: number },
): DecisionCandidate[] {
  const maxCandidates = opts?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const minScore = opts?.minScore ?? DEFAULT_MIN_SCORE;
  const perPageLimit = opts?.perPageLimit ?? DEFAULT_PER_PAGE_LIMIT;

  const candidates: DecisionCandidate[] = [];

  pages.forEach((page) => {
    const section = sections.pageSections[page.page];
    const isLowSignalSection = section?.isLowSignal ?? false;
    const scored: CandidateDraftInput[] = [];

    splitSentences(page.text).forEach((sentence) => {
      const cleaned = normalizeWhitespace(sentence);
      if (cleaned.length < 35) return;

      const result = scoreDecisionSentence(cleaned);
      const qualifies = result.hasActionNoun || result.hasCommitment || result.hasTimeAnchor;
      if (!qualifies) return;
      if (result.score < minScore) return;
      if (isLowSignalSection && result.score < LOW_SIGNAL_MIN_SCORE) return;

      const strength: DecisionStrength =
        result.hasCommitment && (result.hasTimeAnchor || hasStrongCommitmentVerb(cleaned.toLowerCase()))
          ? "hard"
          : "soft";

      scored.push({
        page: page.page,
        sentence: cleaned,
        score: result.score,
        strength,
        isTableLike: result.isTableLike,
        isBoilerplate: result.isBoilerplate,
        isLowSignalSection,
        digitRatio: result.digitRatio,
      });
    });

    scored.sort((a, b) => b.score - a.score);
    scored.slice(0, perPageLimit).forEach((entry) => {
      const candidate = buildCandidate(entry);
      candidate.section = section?.label;
      candidates.push(candidate);
    });
  });

  const deduped = dedupeCandidates(candidates);
  return deduped.sort((a, b) => b.score - a.score || a.evidence.page - b.evidence.page).slice(0, maxCandidates);
}

export const __testables = {
  dedupeCandidates,
  compareCandidates,
  buildTitle,
};
