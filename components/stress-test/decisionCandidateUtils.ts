import type { DecisionCandidate } from "@/components/stress-test/decision-intake-types";

const TITLE_STOP_TOKENS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "with",
  "for",
  "from",
  "to",
  "of",
  "in",
  "on",
  "by",
  "as",
  "at",
  "we",
  "our",
  "tesla",
  "expects",
  "expect",
  "believe",
  "believes",
  "continue",
  "continues",
  "despite",
]);

const DEDUP_STOP_TOKENS = new Set([
  ...TITLE_STOP_TOKENS,
  "despite",
  "will",
  "would",
  "should",
  "could",
  "may",
  "plan",
  "plans",
  "planned",
  "intend",
  "intends",
]);

const clampText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
};

const splitSentences = (value: string) =>
  value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const stripDespiteClause = (value: string) => value.replace(/^(despite|in spite of)[^,]+,\s*/i, "");

const stripBoilerplate = (value: string) =>
  value
    .replace(/\b(?:tesla|we|our)\b/gi, "")
    .replace(/\b(?:expects?|believe|continue|continues|plans?|intend|intends)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const toTokens = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const buildDecisionTitle = (excerpt: string) => {
  const normalized = normalizeWhitespace(excerpt);
  const sentence = splitSentences(normalized)[0] ?? normalized;
  const stripped = stripBoilerplate(stripDespiteClause(sentence));
  const tokens = toTokens(stripped).filter((token) => !TITLE_STOP_TOKENS.has(token));
  const fallbackTokens = toTokens(normalized);
  const titleTokens: string[] = [];

  const addToken = (token: string) => {
    if (TITLE_STOP_TOKENS.has(token)) return;
    if (!titleTokens.includes(token)) titleTokens.push(token);
  };

  tokens.forEach(addToken);
  for (const token of fallbackTokens) {
    if (titleTokens.length >= 14) break;
    addToken(token);
  }

  const trimmedTokens = titleTokens.slice(0, Math.max(8, Math.min(14, titleTokens.length)));
  if (trimmedTokens.length === 0) return "Decision commitment identified";

  const title = trimmedTokens.join(" ");
  return title.charAt(0).toUpperCase() + title.slice(1);
};

const buildDecisionDetail = (excerpt: string, decisionTitle: string) => {
  const normalized = normalizeWhitespace(excerpt);
  const sentences = splitSentences(normalized);
  if (sentences.length < 2) return "";
  const secondSentence = sentences[1];
  if (secondSentence.length < 20) return "";
  const trimmed = clampText(secondSentence, 160);
  if (trimmed.toLowerCase().includes(decisionTitle.toLowerCase())) return "";
  return trimmed;
};

export const buildNormalizedDecisionText = (excerpt: string) => {
  const decisionTitle = buildDecisionTitle(excerpt);
  const decisionDetail = buildDecisionDetail(excerpt, decisionTitle);
  return { decisionTitle, decisionDetail };
};

const buildDedupTokens = (value: string) =>
  new Set(toTokens(value).filter((token) => !DEDUP_STOP_TOKENS.has(token)));

const jaccardSimilarity = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
};

const getCandidatePreferenceScore = (candidate: DecisionCandidate) => {
  const hasPage = Number.isFinite(candidate.source.pageNumber) && candidate.source.pageNumber > 0 ? 1 : 0;
  const excerptLength = candidate.source.excerpt.length;
  return { hasPage, excerptLength };
};

const pickPreferredCandidate = (current: DecisionCandidate, incoming: DecisionCandidate) => {
  const currentScore = getCandidatePreferenceScore(current);
  const incomingScore = getCandidatePreferenceScore(incoming);
  if (currentScore.hasPage !== incomingScore.hasPage) {
    return incomingScore.hasPage > currentScore.hasPage ? incoming : current;
  }
  if (currentScore.excerptLength !== incomingScore.excerptLength) {
    return incomingScore.excerptLength < currentScore.excerptLength ? incoming : current;
  }
  return current;
};

const mergeDuplicateSources = (winner: DecisionCandidate, loser: DecisionCandidate) => {
  const duplicates = [...(winner.duplicates ?? [])];
  duplicates.push(loser.source);
  if (loser.duplicates?.length) {
    duplicates.push(...loser.duplicates);
  }
  return duplicates;
};

export const normalizeDecisionCandidate = (candidate: DecisionCandidate): DecisionCandidate => {
  const { decisionTitle, decisionDetail } = buildNormalizedDecisionText(candidate.source.excerpt);
  return {
    ...candidate,
    decisionTitle,
    decisionDetail,
  };
};

export const deduplicateDecisionCandidates = (candidates: DecisionCandidate[]) => {
  const deduped: DecisionCandidate[] = [];
  const tokens: Array<Set<string>> = [];

  candidates.forEach((candidate) => {
    const candidateTokens = buildDedupTokens(`${candidate.decisionTitle} ${candidate.source.excerpt}`);
    const matchIndex = tokens.findIndex((existingTokens) => jaccardSimilarity(existingTokens, candidateTokens) >= 0.85);
    if (matchIndex === -1) {
      deduped.push(candidate);
      tokens.push(candidateTokens);
      return;
    }

    const existing = deduped[matchIndex];
    const preferred = pickPreferredCandidate(existing, candidate);
    const duplicateSource = preferred === existing ? candidate : existing;
    const mergedDuplicates = mergeDuplicateSources(preferred, duplicateSource);
    const nextPreferred: DecisionCandidate = { ...preferred, duplicates: mergedDuplicates };

    deduped[matchIndex] = nextPreferred;
    tokens[matchIndex] = buildDedupTokens(`${nextPreferred.decisionTitle} ${nextPreferred.source.excerpt}`);
  });

  return deduped;
};
