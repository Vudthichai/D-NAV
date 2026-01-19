import { cleanExcerpt } from "@/lib/decisionText";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "by",
  "with",
  "will",
  "plan",
  "plans",
  "company",
  "management",
  "board",
  "team",
  "we",
  "our",
]);

const ACTION_TERMS = [
  "commit",
  "committed",
  "plan",
  "plans",
  "will",
  "launch",
  "ship",
  "roll out",
  "release",
  "raise",
  "cut",
  "reduce",
  "hire",
  "lay off",
  "invest",
  "allocate",
  "spend",
  "acquire",
  "sell",
  "exit",
  "pause",
  "delay",
  "cancel",
  "expand",
  "open",
  "close",
  "build",
  "deploy",
  "deliver",
  "start",
  "begin",
];

const SUBJECT_TERMS = ["company", "management", "board", "team", "we", "leadership", "executives"];

const TABLE_HEADERS = [
  "financial summary",
  "key metrics",
  "income statement",
  "balance sheet",
  "cash flow",
  "cash flows",
  "segment results",
  "quarterly results",
  "consolidated results",
];

const VERB_PREFIX =
  /^(?:to\s+)?(launch|expand|reduce|increase|invest|hire|cut|build|ship|open|close|raise|acquire|sell|exit|pause|delay|cancel|roll out|introduce|deploy|start|begin)\b/i;

export type DecisionSource = {
  docId?: string;
  chunkId?: string;
  fileName: string;
  pageNumber?: number | null;
  excerpt: string;
  rawText?: string;
};

export type DecisionFlags = {
  likelyTableNoise: boolean;
  lowSignal: boolean;
  duplicateOf?: string;
};

export type NormalizedDecision = {
  id: string;
  title: string;
  detail?: string;
  flags: DecisionFlags;
  source: DecisionSource;
};

type DecisionCandidateSeed = {
  id: string;
  text: string;
  source: DecisionSource;
};

const countDigits = (text: string) => (text.match(/\d/g) ?? []).length;

const digitRatio = (text: string) => {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return 0;
  return countDigits(compact) / compact.length;
};

const countQuarterTokens = (text: string) => {
  const matches = text.match(/\bQ[1-4](?:\s|-)?(?:20\d{2})?\b/gi);
  return matches ? matches.length : 0;
};

const countYearTokens = (text: string) => {
  const matches = text.match(/\b20\d{2}\b/g);
  return matches ? matches.length : 0;
};

const isAllCapsHeader = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  return trimmed === trimmed.toUpperCase() && /^[A-Z\s&-]+$/.test(trimmed);
};

export const isLikelyTableNoise = (raw: string): boolean => {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (digitRatio(raw) > 0.22) return true;
  if (countQuarterTokens(raw) >= 3) return true;
  if (countYearTokens(raw) >= 4) return true;
  if (TABLE_HEADERS.some((header) => lower.includes(header))) return true;
  if (isAllCapsHeader(raw) && raw.length < 80) return true;
  if ((raw.match(/,/g) ?? []).length >= 4 && digitRatio(raw) > 0.15) return true;
  return false;
};

const stripArtifacts = (text: string) => {
  const cleaned = text
    .replace(/\r|\n+/g, " ")
    .replace(/SUMMARY\s*HIGHLIGHTS/gi, " ")
    .replace(/\b[A-Z]{8,}\b/g, " ")
    .replace(/\b(?:[A-Z]\s+){2,}[A-Z]\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
};

const removeTrailingJoiners = (text: string) => text.replace(/(?:,|\band\b|\bor\b)\s*$/i, "").trim();

const clampLength = (text: string, max: number) => {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
};

const ensureSubject = (text: string) => {
  const lower = text.toLowerCase();
  const hasSubject = SUBJECT_TERMS.some((subject) => lower.includes(subject));
  if (hasSubject) return text;
  if (VERB_PREFIX.test(text)) return `Company will ${text}`.replace(/\s+/g, " ").trim();
  return text;
};

const splitTitleDetail = (text: string) => {
  if (!text) return { title: "", detail: "" };
  const cleaned = removeTrailingJoiners(text);
  const separatorMatch = cleaned.split(/(?:\s[-–—]\s|[.;:])/);
  let title = separatorMatch[0]?.trim() ?? cleaned;
  let remainder = cleaned.slice(title.length).replace(/^[\s,;:–—-]+/, "").trim();

  const words = title.split(/\s+/).filter(Boolean);
  if (title.length > 90 || words.length > 14) {
    title = words.slice(0, 14).join(" ").trim();
    remainder = cleaned.slice(title.length).replace(/^[\s,;:–—-]+/, "").trim();
  }

  title = removeTrailingJoiners(title);
  if (title.length > 90) {
    title = removeTrailingJoiners(title.slice(0, 90));
    remainder = cleaned.slice(title.length).replace(/^[\s,;:–—-]+/, "").trim();
  }

  if (remainder && remainder.length <= title.length) {
    return { title, detail: remainder };
  }

  return { title, detail: remainder };
};

const isUsefulDecision = (text: string) => {
  const lower = text.toLowerCase();
  const hasAction = ACTION_TERMS.some((term) => lower.includes(term));
  const hasOptionality =
    /\$\s?\d|\b\d+\s?(?:million|billion|m|bn)\b/i.test(text) ||
    /(headcount|hire|layoff|budget|capex|opex|funding|raise|cut|reduce|spend|allocate)/i.test(text);
  const hasTiming = /\b(by|before|after|next|within|q[1-4]|20\d{2}|fy\d{2})\b/i.test(text);
  if (hasAction || hasOptionality || hasTiming) return true;
  if (digitRatio(text) > 0.18) return false;
  return false;
};

const similarityKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token))
    .join(" ")
    .trim();

const overlapRatio = (aTokens: string[], bTokens: string[]) => {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const shared = aTokens.filter((token) => bTokens.includes(token));
  return shared.length / Math.max(aTokens.length, bTokens.length);
};

const rankCandidate = (candidate: NormalizedDecision) => {
  const wordCount = candidate.title.split(/\s+/).filter(Boolean).length;
  let score = 0;
  if (!candidate.flags.likelyTableNoise) score += 3;
  if (!candidate.flags.lowSignal) score += 2;
  score += Math.max(0, 1 - Math.abs(wordCount - 10) / 10);
  if (candidate.detail) score += 0.5;
  return score;
};

export const normalizeDecisionCandidate = ({ id, text, source }: DecisionCandidateSeed): NormalizedDecision | null => {
  const stripped = stripArtifacts(cleanExcerpt(text));
  if (!stripped || stripped.length < 16) return null;
  const withSubject = ensureSubject(stripped);
  const normalized = withSubject.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const { title, detail } = splitTitleDetail(normalized);
  if (!title || title.length < 6) return null;
  const safeDetail = detail ? clampLength(detail, 280) : "";
  const likelyTableNoise = isLikelyTableNoise(normalized);
  const lowSignal = !isUsefulDecision(normalized);

  return {
    id,
    title,
    detail: safeDetail || undefined,
    flags: {
      likelyTableNoise,
      lowSignal,
    },
    source: {
      ...source,
      excerpt: clampLength(stripArtifacts(cleanExcerpt(source.excerpt)), 300),
    },
  };
};

export const normalizeDecisionCandidates = (candidates: DecisionCandidateSeed[]): NormalizedDecision[] => {
  const normalized = candidates
    .map((candidate) => normalizeDecisionCandidate(candidate))
    .filter((candidate): candidate is NormalizedDecision => Boolean(candidate));

  const deduped = normalized.map((candidate) => ({ ...candidate, flags: { ...candidate.flags } }));
  const groups: Array<{ index: number; key: string; tokens: string[] }> = [];

  deduped.forEach((candidate, index) => {
    const key = similarityKey(candidate.title);
    const tokens = key.split(/\s+/).filter(Boolean);
    const existing = groups.find((group) => group.key === key || overlapRatio(tokens, group.tokens) >= 0.8);
    if (!existing) {
      groups.push({ index, key, tokens });
      return;
    }
    const currentBest = deduped[existing.index];
    const candidateScore = rankCandidate(candidate);
    const bestScore = rankCandidate(currentBest);
    if (candidateScore > bestScore) {
      deduped[existing.index] = {
        ...currentBest,
        flags: { ...currentBest.flags, duplicateOf: candidate.id },
      };
      existing.index = index;
      existing.key = key;
      existing.tokens = tokens;
    } else {
      deduped[index] = {
        ...candidate,
        flags: { ...candidate.flags, duplicateOf: currentBest.id },
      };
    }
  });

  return deduped;
};
