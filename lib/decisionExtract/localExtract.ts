export type PageText = { page: number; text: string };

export type DecisionCandidateDraft = {
  id: string;
  title: string;
  strength: "hard" | "soft";
  category:
    | "Operations"
    | "Finance"
    | "Product"
    | "Hiring"
    | "Legal"
    | "Strategy"
    | "Sales/Go-to-market"
    | "Other";
  decision: string;
  rationale: string;
  constraints: {
    impact: { score: number; evidence: string };
    cost: { score: number; evidence: string };
    risk: { score: number; evidence: string };
    urgency: { score: number; evidence: string };
    confidence: { score: number; evidence: string };
  };
  evidence: { page: number; quote: string; locationHint?: string };
  tags: string[];
  score: number;
};

type CandidateDraftInput = {
  page: number;
  sentence: string;
  score: number;
  hasCommitment: boolean;
  hasTimeAnchor: boolean;
  hasActionNoun: boolean;
};

const COMMITMENT_VERBS = [
  "will",
  "plan",
  "plans",
  "planned",
  "scheduled",
  "on track",
  "expect",
  "expects",
  "target",
  "begin",
  "begins",
  "ramp",
  "launch",
  "commission",
  "deploy",
  "build",
  "expand",
  "invest",
  "continue to pursue",
  "deliveries beginning",
];

const TIME_ANCHORS = [
  /\b20(24|25|26)\b/,
  /\bq[1-4]\b/i,
  /\bq[1-4]\s?20(24|25|26)\b/i,
  /\bfirst half\b/i,
  /\bsecond half\b/i,
  /\bby end of\b/i,
  /\blater this year\b/i,
  /\bthis quarter\b/i,
];

const ACTION_NOUNS = [
  "production",
  "ramp",
  "launch",
  "commissioning",
  "construction",
  "deployment",
  "factory",
  "plant",
  "line",
  "lines",
];

const BOILERPLATE_PATTERNS = [
  /forward-looking statements/i,
  /could cause actual results to differ materially/i,
  /in millions of usd/i,
  /\bcash flows?\b/i,
  /\bnet income\b/i,
  /\bsource:\b/i,
  /\bttm\b/i,
  /estimates based on/i,
];

const TABLE_PATTERNS = [
  /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/,
  /\b\d+(?:\.\d+)?%\b/,
  /[|;]{2,}/,
  /\b(usd|eur|gbp)\b/i,
];

const RETROSPECTIVE_MARKERS = ["achieved", "record", "reported", "grew", "increased", "decreased", "rose", "fell"];

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "to",
  "of",
  "for",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "our",
  "we",
  "their",
  "they",
  "it",
  "as",
  "into",
  "will",
]);

const CATEGORY_HINTS: Array<{ cat: DecisionCandidateDraft["category"]; re: RegExp }> = [
  { cat: "Product", re: /\b(product|model|vehicle|fsd|robotaxi|cybercab|software|feature|launch)\b/i },
  { cat: "Operations", re: /\b(factory|plant|construction|ramp|production|deploy|capacity|commission)\b/i },
  { cat: "Finance", re: /\b(price|margin|capex|cash|financing|liquidity)\b/i },
  { cat: "Sales/Go-to-market", re: /\b(markets|countries|sales|go-to-market|launch in)\b/i },
  { cat: "Strategy", re: /\b(strategy|platform|roadmap|priorit|focus|expand)\b/i },
];

const QUOTE_SUMMARY_LIMIT = 280;
const DEFAULT_MAX_CANDIDATES = 25;
const DEFAULT_MIN_SCORE = 3;
const DEFAULT_PER_PAGE_LIMIT = 10;
const DEDUPE_SIMILARITY = 0.6;

// Heuristic controls: adjust these thresholds to trade recall vs. precision quickly.
// - DEFAULT_MAX_CANDIDATES: total candidates returned
// - DEFAULT_PER_PAGE_LIMIT: per-page cap before global merge
// - DEFAULT_MIN_SCORE: minimum scoring threshold
// - DEDUPE_SIMILARITY: bigram Jaccard threshold for duplicates

const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();

const normalizeForScoring = (text: string) =>
  text
    .toLowerCase()
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeForDedup = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
    .join(" ");

const countDigits = (text: string) => (text.match(/\d/g) ?? []).length;

const digitRatio = (text: string) => {
  const trimmed = text.replace(/\s/g, "");
  if (!trimmed) return 0;
  return countDigits(trimmed) / trimmed.length;
};

const looksTableLike = (text: string) => {
  if (digitRatio(text) > 0.22) return true;
  const numberCount = (text.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []).length;
  if (numberCount >= 4) return true;
  if (TABLE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  const delimiterCount = (text.match(/[|;•]/g) ?? []).length;
  if (delimiterCount >= 4 && numberCount >= 3) return true;
  return false;
};

const isBoilerplate = (text: string) => BOILERPLATE_PATTERNS.some((pattern) => pattern.test(text));

const hasCommitmentVerb = (text: string) => COMMITMENT_VERBS.some((verb) => text.includes(verb));
const hasTimeAnchor = (text: string) => TIME_ANCHORS.some((pattern) => pattern.test(text));
const hasActionNoun = (text: string) => ACTION_NOUNS.some((noun) => text.includes(noun));

const isRetrospectiveOnly = (text: string) => {
  if (!RETROSPECTIVE_MARKERS.some((word) => text.includes(word))) return false;
  return !(hasCommitmentVerb(text) || hasTimeAnchor(text));
};

const splitSentences = (text: string) => {
  if (!text) return [] as string[];
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/([a-zA-Z])-\n([a-zA-Z])/g, "$1$2")
    .replace(/[•\u2022]/g, "•")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) return [];

  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const merged: string[] = [];
  let current = "";
  lines.forEach((line) => {
    const isBullet = /^[-–•]\s+/.test(line);
    if (isBullet) {
      if (current) {
        merged.push(current);
        current = "";
      }
      merged.push(line.replace(/^[-–•]\s+/, "").trim());
      return;
    }
    if (!current) {
      current = line;
      return;
    }
    const endsSentence = /[.!?]$/.test(current);
    const nextLooksContinuation = /^[a-z0-9(]/.test(line);
    if (!endsSentence && nextLooksContinuation) {
      current = `${current} ${line}`.trim();
    } else {
      merged.push(current);
      current = line;
    }
  });
  if (current) merged.push(current);

  const sentences: string[] = [];
  merged.forEach((line) => {
    line
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .forEach((sentence) => sentences.push(sentence));
  });
  return sentences;
};

const scoreSentence = (sentence: string) => {
  const normalized = normalizeForScoring(sentence);
  let score = 0;
  const timeAnchor = hasTimeAnchor(normalized);
  const commitment = hasCommitmentVerb(normalized);
  const actionNoun = hasActionNoun(normalized);

  if (timeAnchor) score += 3;
  if (commitment) score += 3;
  if (actionNoun) score += 2;
  if (isRetrospectiveOnly(normalized)) score -= 3;
  if (looksTableLike(sentence)) score -= 5;

  return {
    score,
    hasTimeAnchor: timeAnchor,
    hasCommitment: commitment,
    hasActionNoun: actionNoun,
  };
};

const bestCategory = (text: string): DecisionCandidateDraft["category"] => {
  for (const hint of CATEGORY_HINTS) if (hint.re.test(text)) return hint.cat;
  return "Other";
};

const buildTitle = (sentence: string) => {
  const cleaned = sentence
    .replace(/[“”"]/g, "")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/\b(Tesla|Company|We|Our|Management)\b\s*/i, "")
    .replace(/^(Q[1-4]\s?\d{4}|\d{4}|First half|Second half)\b\s*/i, "")
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 10);
  const titleWords = words.length >= 6 ? words : cleaned.split(/\s+/).slice(0, 6);
  return titleWords.join(" ").replace(/[.,;:]+$/, "");
};

const summarizeSentence = (sentence: string) => {
  const normalized = normalizeWhitespace(sentence);
  if (normalized.length <= QUOTE_SUMMARY_LIMIT) return normalized;
  const trimmed = normalized.slice(0, QUOTE_SUMMARY_LIMIT - 1);
  const lastSpace = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, Math.max(lastSpace, QUOTE_SUMMARY_LIMIT - 1))}…`;
};

const buildConstraints = (quote: string) => ({
  impact: { score: 5, evidence: quote },
  cost: { score: 5, evidence: quote },
  risk: { score: 5, evidence: quote },
  urgency: { score: 5, evidence: quote },
  confidence: { score: 5, evidence: quote },
});

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

const dedupeCandidates = (candidates: DecisionCandidateDraft[]) => {
  const deduped: DecisionCandidateDraft[] = [];
  candidates.forEach((candidate) => {
    const titleKey = candidate.title.toLowerCase();
    const duplicateIndex = deduped.findIndex((existing) => existing.title.toLowerCase() === titleKey);
    if (duplicateIndex !== -1) {
      const existing = deduped[duplicateIndex];
      const winner =
        candidate.score > existing.score || (candidate.score === existing.score && candidate.evidence.page < existing.evidence.page)
          ? candidate
          : existing;
      deduped[duplicateIndex] = winner;
      return;
    }

    const candidateBigrams = bigramSet(candidate.evidence.quote);
    const similarIndex = deduped.findIndex(
      (existing) => jaccard(candidateBigrams, bigramSet(existing.evidence.quote)) > DEDUPE_SIMILARITY,
    );
    if (similarIndex === -1) {
      deduped.push(candidate);
      return;
    }

    const existing = deduped[similarIndex];
    const winner =
      candidate.score > existing.score || (candidate.score === existing.score && candidate.evidence.page < existing.evidence.page)
        ? candidate
        : existing;
    deduped[similarIndex] = winner;
  });
  return deduped;
};

const extractTags = (text: string) => {
  const tags = new Set<string>();
  const lowered = text.toLowerCase();
  if (lowered.includes("factory") || lowered.includes("plant")) tags.add("factory");
  if (lowered.includes("ramp")) tags.add("ramp");
  if (lowered.includes("launch")) tags.add("launch");
  if (lowered.includes("production")) tags.add("production");
  if (lowered.includes("commission")) tags.add("commissioning");
  return [...tags];
};

const buildCandidate = (input: CandidateDraftInput): DecisionCandidateDraft => {
  const title = buildTitle(input.sentence);
  const summary = summarizeSentence(input.sentence);
  const strength: "hard" | "soft" = input.hasCommitment && input.hasTimeAnchor ? "hard" : "soft";
  const quote = normalizeWhitespace(input.sentence);
  return {
    id: `local-${input.page}-${Math.abs(quote.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0))}`,
    title: title || summary.slice(0, 60),
    strength,
    category: bestCategory(quote),
    decision: summary,
    rationale: "",
    constraints: buildConstraints(quote),
    evidence: { page: input.page, quote },
    tags: extractTags(quote),
    score: input.score,
  };
};

const pageLooksLowSignal = (text: string) => {
  if (!text) return true;
  const dense = digitRatio(text) > 0.2;
  const tableLines = text.split(/\n+/).filter((line) => looksTableLike(line)).length;
  if (dense && tableLines >= 3) return true;
  return false;
};

export function localExtractDecisionCandidates(
  pages: PageText[],
  opts?: { maxCandidates?: number; minScore?: number; perPageLimit?: number },
): DecisionCandidateDraft[] {
  const maxCandidates = opts?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const minScore = opts?.minScore ?? DEFAULT_MIN_SCORE;
  const perPageLimit = opts?.perPageLimit ?? DEFAULT_PER_PAGE_LIMIT;

  const candidates: DecisionCandidateDraft[] = [];

  pages.forEach((page) => {
    if (pageLooksLowSignal(page.text)) return;
    const scored: CandidateDraftInput[] = [];
    splitSentences(page.text).forEach((sentence) => {
      const cleaned = normalizeWhitespace(sentence);
      if (cleaned.length < 35) return;
      if (isBoilerplate(cleaned)) return;
      if (looksTableLike(cleaned)) return;

      const normalized = normalizeForScoring(cleaned);
      const { score, hasActionNoun, hasCommitment, hasTimeAnchor } = scoreSentence(cleaned);
      const qualifies = hasActionNoun || hasCommitment || hasTimeAnchor;
      if (!qualifies) return;
      if (isRetrospectiveOnly(normalized) && !hasTimeAnchor && !hasCommitment) return;
      if (score < minScore) return;

      scored.push({
        page: page.page,
        sentence: cleaned,
        score,
        hasCommitment,
        hasTimeAnchor,
        hasActionNoun,
      });
    });

    scored.sort((a, b) => b.score - a.score);
    scored.slice(0, perPageLimit).forEach((entry) => {
      candidates.push(buildCandidate(entry));
    });
  });

  const deduped = dedupeCandidates(candidates);
  return deduped.sort((a, b) => b.score - a.score || a.evidence.page - b.evidence.page).slice(0, maxCandidates);
}

export const __testables = {
  dedupeCandidates,
  isBoilerplate,
  looksTableLike,
  splitSentences,
};
