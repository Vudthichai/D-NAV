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

const KEYWORD_PATTERNS = {
  marginPressure: [/\bmargin pressure\b/i, /\bmargin headwind\b/i, /\bmargin compression\b/i, /\bmargin\b/i],
  costReduction: [/\bcost reduction\b/i, /\breduce costs?\b/i, /\bcost discipline\b/i, /\bcost savings\b/i],
  liquidity: [/\bliquidity\b/i, /\bcash flow\b/i, /\bfree cash flow\b/i, /\bcash balance\b/i],
  capex: [/\bcapex\b/i, /\bcapital expenditure\b/i, /\bcapital spend\b/i, /\bcapex efficiency\b/i],
  manufacturingReadiness: [
    /\bmanufacturing readiness\b/i,
    /\bproduction readiness\b/i,
    /\bfactory readiness\b/i,
    /\bline readiness\b/i,
    /\bmanufacturing ramp\b/i,
  ],
  affordableVehicles: [
    /\baffordable vehicles?\b/i,
    /\blow[-\s]?cost (vehicle|model)\b/i,
    /\bnext[-\s]?gen( vehicle|platform)?\b/i,
  ],
  energyStorage: [/\benergy storage\b/i, /\bmegapack\b/i, /\bpowerwall\b/i, /\benergy business\b/i],
  megafactory: [/\bmegafactory\b/i, /\bmega factory\b/i],
  aiTrainingCompute: [/\bai training compute\b/i, /\btraining compute\b/i, /\bai compute\b/i, /\bdojo\b/i, /\bsupercomputer\b/i],
  autonomy: [/\bautonomy\b/i, /\bautonomous\b/i, /\bself[-\s]?driving\b/i, /\bfsd\b/i],
  robotaxi: [/\brobotaxi\b/i, /\bcybercab\b/i],
  lithium: [/\blithium\b/i, /\brefinery\b/i, /\blithium refinery\b/i],
  semi: [/\btesla semi\b/i, /\bsemi\b/i],
  supercharger: [/\bsupercharger\b/i, /\bcharging network\b/i, /\bcharging expansion\b/i],
  vehicleGrowth: [/\bvehicle\b/i, /\bautomotive\b/i, /\bdeliveries\b/i, /\bproduction\b/i, /\bramp\b/i],
};

const formatList = (items: string[]) => {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

const buildNarrativeSummary = (pages: SectionedPage[], candidates: DecisionCandidate[], docLabel: string) => {
  const subject = docLabel ? docLabel : "The document";
  const fullText = pages.map((page) => page.text).join(" ");
  const candidateText = candidates.map((candidate) => candidate.decision).join(" ");
  const corpus = `${fullText} ${candidateText}`;
  const hasSignal = (patterns: RegExp[]) => patterns.some((pattern) => pattern.test(corpus));

  const constraintParts = [];
  if (hasSignal(KEYWORD_PATTERNS.marginPressure)) constraintParts.push("margin pressure");
  if (hasSignal(KEYWORD_PATTERNS.costReduction)) constraintParts.push("cost reduction");
  if (hasSignal(KEYWORD_PATTERNS.liquidity)) constraintParts.push("liquidity discipline");
  const constraintPhrase = constraintParts.length ? formatList(constraintParts) : "execution constraints";

  const capitalParts = [];
  if (hasSignal(KEYWORD_PATTERNS.manufacturingReadiness)) capitalParts.push("manufacturing readiness");
  if (hasSignal(KEYWORD_PATTERNS.energyStorage) || hasSignal(KEYWORD_PATTERNS.megafactory)) {
    capitalParts.push("energy capacity buildout");
  }
  if (hasSignal(KEYWORD_PATTERNS.aiTrainingCompute)) capitalParts.push("AI training infrastructure");

  const postureParts = [];
  if (hasSignal(KEYWORD_PATTERNS.costReduction)) postureParts.push("cost reduction");
  if (hasSignal(KEYWORD_PATTERNS.capex)) postureParts.push("capex efficiency");
  if (hasSignal(KEYWORD_PATTERNS.liquidity)) postureParts.push("liquidity management");

  const forwardParts = [];
  if (hasSignal(KEYWORD_PATTERNS.energyStorage) || hasSignal(KEYWORD_PATTERNS.megafactory)) forwardParts.push("energy growth");
  if (
    hasSignal(KEYWORD_PATTERNS.affordableVehicles) ||
    hasSignal(KEYWORD_PATTERNS.manufacturingReadiness) ||
    hasSignal(KEYWORD_PATTERNS.vehicleGrowth)
  ) {
    forwardParts.push("vehicle growth resuming");
  }
  if (hasSignal(KEYWORD_PATTERNS.autonomy)) forwardParts.push("autonomy as the long-arc driver");

  const plannedSteps = [];
  if (hasSignal(KEYWORD_PATTERNS.robotaxi)) plannedSteps.push("robotaxi/cybercab steps");
  if (hasSignal(KEYWORD_PATTERNS.lithium)) plannedSteps.push("lithium refinery work");
  if (hasSignal(KEYWORD_PATTERNS.semi)) plannedSteps.push("Semi ramp");
  if (hasSignal(KEYWORD_PATTERNS.supercharger)) plannedSteps.push("supercharger expansion");

  const sentencesOut: string[] = [];
  sentencesOut.push(`${subject} frames execution under ${constraintPhrase}, emphasizing disciplined tradeoffs.`);
  sentencesOut.push(
    capitalParts.length
      ? `Capital direction centers on ${formatList(capitalParts)}.`
      : "Capital direction is left implicit beyond ongoing execution focus.",
  );
  sentencesOut.push(
    postureParts.length
      ? `Operational posture emphasizes ${formatList(postureParts)}.`
      : "Operational posture is described as disciplined execution without explicit cost or liquidity signals.",
  );
  sentencesOut.push(
    forwardParts.length
      ? `The forward arc points to ${formatList(forwardParts)}.`
      : "The forward arc is noted without explicit growth sequencing.",
  );
  if (plannedSteps.length) {
    sentencesOut.push(`Planned steps flagged include ${formatList(plannedSteps)}.`);
  }

  return sentencesOut.slice(0, 5).join(" ");
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
  const narrativeSummary = buildNarrativeSummary(pages, candidates, docLabel);

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
