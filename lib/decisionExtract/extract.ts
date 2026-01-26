import {
  buildRepeatedLineSet,
  cleanPdfPages,
  normalizeWhitespace,
  type PdfPageText,
} from "@/lib/decisionExtract/cleanText";
import { segmentDecisionCandidates } from "@/lib/decisionExtract/segment";
import { passesDecisionCandidateFilters, scoreDecisionCandidate } from "@/lib/decisionExtract/scoreDecision";
import type { DecisionCandidate, DecisionSource } from "@/lib/types/decision";

const DEFAULT_SCORE = 5;
const SCORE_THRESHOLD = 20;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.86;
const MIN_CANDIDATES = 30;

type CandidateWithScore = DecisionCandidate & {
  score: number;
};

export type DecisionExtractDebug = {
  pagesParsed: number;
  rawLinesCount: number;
  sentencesCount: number;
  candidatesBeforeDedupe: number;
  candidatesAfterDedupe: number;
  candidatesAfterFiltering: number;
};

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const normalizeForDedup = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const splitOnClause = (value: string) => value.split(/[.;:–—]/).map((chunk) => chunk.trim()).filter(Boolean);

const isPersonalMemoText = (value: string) => {
  const matches = value.match(/\bI\b/g)?.length ?? 0;
  const words = value.trim().split(/\s+/).length || 1;
  return matches >= 3 || matches / words > 0.03;
};

const truncateToWord = (value: string, limit: number) => {
  if (value.length <= limit) return value;
  const sliced = value.slice(0, limit);
  const lastSpace = sliced.lastIndexOf(" ");
  const trimmed = (lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced).trim();
  return trimmed.endsWith("…") ? trimmed : `${trimmed}…`;
};

const rewriteDecisionStatement = (value: string) => {
  const normalized = normalizeWhitespace(value);
  const lowered = normalized.toLowerCase();
  const asWeMatch = normalized.match(/\bas we\s+([^.,;]+)/i);
  if (asWeMatch) {
    const phrase = asWeMatch[1]?.trim();
    if (phrase) {
      const sentence = phrase.replace(/^(are|were)\s+/i, "");
      return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
    }
  }

  const willMatch = normalized.match(/\bwill\s+([^.,;]+)/i);
  if (willMatch) {
    const phrase = willMatch[1]?.trim();
    if (phrase) {
      return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`;
    }
  }

  const scheduledMatch = normalized.match(/\bscheduled to\s+([^.,;]+)/i);
  if (scheduledMatch) {
    const phrase = scheduledMatch[1]?.trim();
    if (phrase) {
      return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`;
    }
  }

  const planMatch = normalized.match(/\b(plan to|expect to|aim to|target to)\s+([^.,;]+)/i);
  if (planMatch) {
    const phrase = planMatch[2]?.trim();
    if (phrase) {
      return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`;
    }
  }

  if (lowered.startsWith("we ")) {
    const trimmed = normalized.replace(/^we\s+/i, "");
    return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  }

  return normalized;
};

const generateTitle = (value: string) => {
  const trimmed = normalizeWhitespace(value);
  const startsWithVerb = /^\s*(we\s+)?(will|plan to|expect to|aim to|target|prepare to|commit to|launch|ramp|begin|start|expand|build|deploy|deliver|commission|schedule|scheduled|roll out|rollout|introduce|scale|invest|allocate|approve|commence|transition|reduce|increase|continue|on track to|remain on track to)\b/i.test(
    trimmed,
  );
  const base = startsWithVerb ? trimmed : splitOnClause(trimmed)[0] ?? trimmed;
  const title = truncateToWord(base, 80).replace(/[,.]$/, "");
  return title.charAt(0).toUpperCase() + title.slice(1);
};

const buildCandidate = (text: string, source: DecisionSource, score: number): CandidateWithScore => {
  const normalized = normalizeWhitespace(text);
  const decisionStatement = rewriteDecisionStatement(normalized);
  return {
    id: `decision-${hashString(`${normalized.toLowerCase()}-${source.fileName ?? ""}-${source.pageNumber ?? ""}`)}`,
    decision: generateTitle(decisionStatement),
    evidence: normalized,
    sources: [source],
    extractConfidence: Math.min(1, Math.max(0, score / 100)),
    qualityScore: Math.max(0, Math.min(100, score)),
    impact: DEFAULT_SCORE,
    cost: DEFAULT_SCORE,
    risk: DEFAULT_SCORE,
    urgency: DEFAULT_SCORE,
    confidence: DEFAULT_SCORE,
    score,
  };
};

const mergeSources = (existing: DecisionSource[], incoming: DecisionSource[]) => {
  const merged = [...existing];
  for (const source of incoming) {
    const already = merged.some(
      (entry) =>
        entry.fileName === source.fileName &&
        entry.pageNumber === source.pageNumber &&
        entry.excerpt === source.excerpt,
    );
    if (!already) {
      merged.push(source);
    }
  }
  return merged;
};

export const extractDecisionCandidatesFromPages = (
  pages: PdfPageText[],
): { candidates: DecisionCandidate[]; debug: DecisionExtractDebug } => {
  const grouped = new Map<string, PdfPageText[]>();
  for (const page of pages) {
    const key = page.fileName ?? "unknown";
    const entry = grouped.get(key) ?? [];
    entry.push(page);
    grouped.set(key, entry);
  }

  const candidates: CandidateWithScore[] = [];
  const filteredCandidates: CandidateWithScore[] = [];
  let sentencesCount = 0;
  let rawLinesCount = 0;

  for (const [, group] of grouped.entries()) {
    rawLinesCount += group.reduce((sum, page) => sum + page.text.split(/\n+/).filter(Boolean).length, 0);
    const memoText = group.map((page) => page.text).join(" ");
    const isPersonalMemo = isPersonalMemoText(memoText);
    const repeatedLines = buildRepeatedLineSet(group);
    const cleanedPages = cleanPdfPages(group);
    const segments = segmentDecisionCandidates(cleanedPages, repeatedLines);
    sentencesCount += segments.length;
    for (const segment of segments) {
      if (!passesDecisionCandidateFilters(segment.text, { isPersonalMemo })) continue;
      const score = scoreDecisionCandidate(segment.text, { isPersonalMemo, isRepeatedLine: segment.isRepeatedLine });
      const candidate = buildCandidate(
        segment.text,
        {
          fileName: segment.fileName,
          pageNumber: segment.pageNumber,
          excerpt: segment.rawExcerpt,
        },
        score,
      );
      candidates.push(candidate);
      if (score >= SCORE_THRESHOLD) {
        filteredCandidates.push(candidate);
      }
    }
  }

  const sorted = [...filteredCandidates].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.evidence.length - b.evidence.length,
  );
  const sortedFallback = [...candidates].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.evidence.length - b.evidence.length,
  );

  const candidatesBeforeDedupe =
    sorted.length < MIN_CANDIDATES ? sortedFallback.slice(0, MIN_CANDIDATES) : sorted;

  const deduped: CandidateWithScore[] = [];

  const similarity = (a: string, b: string) => {
    const tokensA = new Set(normalizeForDedup(a).split(" "));
    const tokensB = new Set(normalizeForDedup(b).split(" "));
    const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
    const union = new Set([...tokensA, ...tokensB]).size || 1;
    return intersection / union;
  };

  for (const candidate of candidatesBeforeDedupe) {
    let merged = false;
    for (const existing of deduped) {
      if (
        similarity(existing.evidence, candidate.evidence) >= DUPLICATE_SIMILARITY_THRESHOLD ||
        existing.evidence.includes(candidate.evidence) ||
        candidate.evidence.includes(existing.evidence)
      ) {
        const winner = existing.score >= candidate.score ? existing : candidate;
        winner.sources = mergeSources(existing.sources, candidate.sources);
        if (winner !== existing) {
          const index = deduped.indexOf(existing);
          deduped[index] = winner;
        }
        merged = true;
        break;
      }
    }
    if (!merged) {
      deduped.push(candidate);
    }
  }

  return {
    candidates: deduped.map(({ score, ...rest }) => rest),
    debug: {
      pagesParsed: pages.length,
      rawLinesCount,
      sentencesCount,
      candidatesBeforeDedupe: candidatesBeforeDedupe.length,
      candidatesAfterDedupe: deduped.length,
      candidatesAfterFiltering: filteredCandidates.length,
    },
  };
};

export const extractDecisionCandidatesFromText = (
  text: string,
  fileName = "Pasted text",
): { candidates: DecisionCandidate[]; debug: DecisionExtractDebug } => {
  const pages: PdfPageText[] = [
    {
      fileName,
      pageNumber: 1,
      text,
    },
  ];
  return extractDecisionCandidatesFromPages(pages);
};
