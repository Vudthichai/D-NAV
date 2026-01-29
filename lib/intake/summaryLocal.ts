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

const SUMMARY_SIGNALS = {
  constraints: [
    { re: /\bmargin\b|\bprofitability\b|\bcost\b|\bcogs\b/i, phrase: "margin and cost pressure" },
    { re: /\bmacro\b|\bdemand\b|\binflation\b|\binterest rate\b|\bvolatility\b|\bfx\b/i, phrase: "macro and demand volatility" },
    { re: /\bliquidity\b|\bcash\b|\bbalance sheet\b|\bfunding\b|\bcapital discipline\b/i, phrase: "liquidity and capital discipline" },
    { re: /\bsupply\b|\blogistics\b|\bcommodity\b|\bavailability\b|\bconstraint\b/i, phrase: "supply chain constraints" },
    { re: /\bregulator\b|\bregulatory\b|\bcompliance\b/i, phrase: "regulatory constraints" },
  ],
  investments: [
    { re: /\bcapex\b|\bcapital expenditure\b|\binvest(?:ing|ment)?\b/i, phrase: "capital investment and cost focus" },
    { re: /\bcapacity\b|\bfactory\b|\bplant\b|\bfacility\b|\bline\b|\bmanufacturing\b/i, phrase: "capacity expansion and manufacturing buildout" },
    { re: /\bproduct\b|\bplatform\b|\broadmap\b|\blaunch\b|\bprogram\b/i, phrase: "product and platform execution" },
    { re: /\bsoftware\b|\bai\b|\bautonomy\b|\bautomation\b|\bcompute\b/i, phrase: "software, automation, and technology development" },
    { re: /\benergy\b|\bstorage\b|\binfrastructure\b|\bgrid\b/i, phrase: "infrastructure and energy deployment" },
    { re: /\bpricing\b|\bmarket\b|\bgo-to-market\b|\bchannel\b|\bdistribution\b/i, phrase: "market expansion and go-to-market moves" },
    { re: /\bhire\b|\bhiring\b|\bheadcount\b|\btalent\b/i, phrase: "talent and organizational build" },
  ],
  scale: [
    { re: /\bramp\b|\bscale\b|\bvolume\b|\bthroughput\b/i, phrase: "scale-up execution across operations" },
    { re: /\bproduction\b|\bmanufacturing\b|\bfactory\b|\bplant\b/i, phrase: "manufacturing and production execution" },
    { re: /\bdeliver(?:y|ies)\b|\bdeployment\b|\binstall\b/i, phrase: "delivery and deployment execution" },
    { re: /\befficiency\b|\bquality\b|\boperations\b/i, phrase: "operational efficiency gains" },
  ],
};

const NEAR_TERM_PATTERNS = [
  /\bthis year\b/i,
  /\bthis quarter\b/i,
  /\bQ[1-4]\b/i,
  /\bnext quarter\b/i,
  /\bH[12]\b/i,
];

const LONG_TERM_PATTERNS = [
  /\b2026\b/i,
  /\b2027\b/i,
  /\b2028\b/i,
  /\b2029\b/i,
  /\b2030\b/i,
  /\blong[-\s]?term\b/i,
  /\bmulti[-\s]?year\b/i,
  /\bdecade\b/i,
];

const YEAR_PATTERN = /\b20\d{2}\b/g;

const joinPhrases = (phrases: string[], fallback: string) => (phrases.length ? phrases.join(" and ") : fallback);

const collectSentences = (pages: SectionedPage[]): string[] => {
  const sentences: string[] = [];
  pages.forEach((page) => {
    if (page.isLowSignal) return;
    splitSentences(page.text).forEach((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;
      if (isBoilerplate(trimmed) || isTableLike(trimmed)) return;
      sentences.push(trimmed);
    });
  });
  return sentences;
};

const mostCommonYear = (sentences: string[]): number | null => {
  const counts = new Map<number, number>();
  sentences.forEach((sentence) => {
    const matches = sentence.match(YEAR_PATTERN);
    matches?.forEach((value) => {
      const year = Number(value);
      if (!Number.isNaN(year)) {
        counts.set(year, (counts.get(year) ?? 0) + 1);
      }
    });
  });
  const [year] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return year ?? null;
};

const collectSignalPhrases = (
  sentences: string[],
  signals: Array<{ re: RegExp; phrase: string }>,
  max = 2,
): string[] => {
  const counts = new Map<string, number>();
  sentences.forEach((sentence) => {
    signals.forEach(({ re, phrase }) => {
      if (!re.test(sentence)) return;
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase)
    .slice(0, max);
};

const buildNarrativeSummary = (pages: SectionedPage[], docLabel: string) => {
  const sentences = collectSentences(pages);
  if (sentences.length === 0) {
    return "This document frames the period as one of focused execution while balancing constraints, outlining where effort is concentrated and how near-term delivery links to the longer strategic arc.";
  }

  const year = mostCommonYear(sentences);
  const periodLabel = year ? `${year}` : "the period";
  const nextYearLabel = year ? `${year + 1}` : "the next year";
  const subject = docLabel ? docLabel : "The document";

  const constraints = collectSignalPhrases(sentences, SUMMARY_SIGNALS.constraints, 2);
  const investments = collectSignalPhrases(sentences, SUMMARY_SIGNALS.investments, 2);
  const scaleSignals = collectSignalPhrases(sentences, SUMMARY_SIGNALS.scale, 1);

  const nearTermSentences = sentences.filter((sentence) => NEAR_TERM_PATTERNS.some((pattern) => pattern.test(sentence)));
  const longTermSentences = sentences.filter((sentence) => LONG_TERM_PATTERNS.some((pattern) => pattern.test(sentence)));

  const nearTermThemes = collectSignalPhrases(
    nearTermSentences.length ? nearTermSentences : sentences,
    SUMMARY_SIGNALS.investments,
    2,
  );
  const longTermThemes = collectSignalPhrases(
    longTermSentences.length ? longTermSentences : sentences,
    SUMMARY_SIGNALS.scale,
    1,
  );

  const constraintPhrase = joinPhrases(constraints, "operational and financial constraints");
  const investmentPhrase = joinPhrases(investments, "capacity expansion and product execution");
  const scalePhrase = joinPhrases(scaleSignals, "core operational execution");
  const nearTermPhrase = joinPhrases(nearTermThemes, investmentPhrase);
  const longTermPhrase = joinPhrases(longTermThemes, "the next growth curve and platform build");

  const sentencesOut: string[] = [];
  sentencesOut.push(`${subject} frames ${periodLabel} as a period of execution under ${constraintPhrase}.`);
  sentencesOut.push(`Capital and effort were directed toward ${investmentPhrase}, with leadership attention on operational delivery.`);
  sentencesOut.push(`What is already working at scale is the momentum in ${scalePhrase}, without relying on headline metrics.`);
  sentencesOut.push(
    `Near-term execution centers on ${nearTermPhrase}, while the longer-term arc emphasizes ${longTermPhrase}.`,
  );
  sentencesOut.push(`Looking into ${nextYearLabel}, the narrative bridges toward scaling these priorities into the next phase.`);

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
  const narrativeSummary = buildNarrativeSummary(pages, docLabel);

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
