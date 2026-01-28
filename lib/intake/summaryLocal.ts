import type { DecisionCandidate } from "./decisionExtractLocal";
import { assessDecisionLikeness } from "./decisionLikeness";
import { isBoilerplate, isTableLike, splitSentences } from "./decisionScoring";
import type { SectionedPage } from "./sectionSplit";

export interface DecisionStatement {
  id: string;
  text: string;
  source: string;
}

export type SummaryHeading =
  | "What happened"
  | "What was done"
  | "What’s being bet on"
  | "What changes next";

export interface SummarySection {
  heading: SummaryHeading;
  summary: string;
}

export interface DecisionBullet {
  id: string;
  section: SummaryHeading;
  text: string;
  source: string;
  page?: number;
}

export interface SupportingEvidence {
  id: string;
  text: string;
  page?: number;
  sourceType: "candidate" | "highlight";
  relatedDecisionId?: string;
}

export interface LocalSummary {
  intro: string;
  sections: SummarySection[];
  themes: string[];
  decisionBullets: DecisionBullet[];
  supportingEvidence: SupportingEvidence[];
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

const buildThemes = (candidates: DecisionCandidate[]): string[] => {
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    candidate.decision
      .toLowerCase()
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
  const excluded = new Set(candidates.map((candidate) => candidate.decision));
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

const SECTION_HEADINGS: SummaryHeading[] = [
  "What happened",
  "What was done",
  "What’s being bet on",
  "What changes next",
];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const classifySection = (text: string): SummaryHeading => {
  const lower = text.toLowerCase();
  if (/\b(completed|launched|delivered|achieved|began|started|deployed|commissioned|expanded|added)\b/.test(lower)) {
    return "What happened";
  }
  if (/\b(will|plans|plan|scheduled|begin|start|launch|ramp|deploy|build|expand)\b/.test(lower)) {
    return "What was done";
  }
  if (/\b(expect|expects|aim|aims|target|intends|intend|prioritize|focus|strategy)\b/.test(lower)) {
    return "What’s being bet on";
  }
  if (/\b(next|by|in\s+\d{4}|in\s+q[1-4]|in\s+h[12]|after|before|within|over)\b/.test(lower)) {
    return "What changes next";
  }
  return "What was done";
};

const extractTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !STOPWORDS.has(token));

const buildSectionSummary = (heading: SummaryHeading, statements: DecisionStatement[]) => {
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
  if (heading === "What happened") {
    return topic ? `Recent commitments center on ${topic}.` : "Recent commitments are concentrated in a few areas.";
  }
  if (heading === "What was done") {
    return topic ? `The active push is toward ${topic}.` : "Active commitments show a clear operational push.";
  }
  if (heading === "What’s being bet on") {
    return topic ? `Strategic bets cluster around ${topic}.` : "Strategic bets are starting to take shape.";
  }
  return topic ? `Next shifts point to ${topic}.` : "Near-term shifts are beginning to surface.";
};

export function buildLocalSummary(
  pages: SectionedPage[],
  candidates: DecisionCandidate[],
  docName: string,
): LocalSummary {
  const docLabel = docName.replace(/\.pdf$/i, "").trim();
  const themes = buildThemes(candidates);
  const highlights = pickHighlightSentences(pages, candidates);

  const introTheme = themes.slice(0, 2).join(" and ");
  const introBase = docLabel
    ? `${docLabel} surfaces near-term commitments and operational focus areas.`
    : "This document surfaces near-term commitments and operational focus areas.";
  const intro = introTheme
    ? `${introBase} The signal clusters around ${introTheme}.`
    : introBase;
  const statements: DecisionStatement[] = [];
  const decisionBullets: DecisionBullet[] = [];
  const supportingEvidence: SupportingEvidence[] = [];
  const decisionKeys = new Set<string>();
  const evidenceKeys = new Set<string>();
  const evidenceIndex = new Map<string, number>();

  const buildSupportingEvidence = (
    source: string,
    page: number | undefined,
    sourceType: SupportingEvidence["sourceType"],
    relatedDecisionId?: string,
  ) => {
    const key = source.toLowerCase();
    if (evidenceKeys.has(key)) {
      const existingIndex = evidenceIndex.get(key);
      if (existingIndex !== undefined && relatedDecisionId) {
        supportingEvidence[existingIndex].relatedDecisionId ??= relatedDecisionId;
      }
      return;
    }
    evidenceKeys.add(key);
    const entry: SupportingEvidence = {
      id: `evidence-${hashString(source)}`,
      text: source,
      page,
      sourceType,
      relatedDecisionId,
    };
    evidenceIndex.set(key, supportingEvidence.length);
    supportingEvidence.push(entry);
  };

  const ingestStatement = (
    source: string,
    page: number | undefined,
    sourceType: SupportingEvidence["sourceType"],
    id: string,
  ) => {
    const decisionCheck = assessDecisionLikeness(source);
    const heading = classifySection(source);
    statements.push({ id, text: decisionCheck.rewritten, source });

    if (decisionCheck.isDecision) {
      const key = decisionCheck.rewritten.toLowerCase();
      if (!decisionKeys.has(key)) {
        const decisionId = `decision-${hashString(decisionCheck.rewritten)}`;
        decisionKeys.add(key);
        decisionBullets.push({
          id: decisionId,
          section: heading,
          text: decisionCheck.rewritten,
          source,
          page,
        });
        buildSupportingEvidence(source, page, sourceType, decisionId);
        return;
      }
    }

    buildSupportingEvidence(source, page, sourceType);
  };

  candidates.forEach((candidate) => {
    ingestStatement(candidate.decision, candidate.evidence.page, "candidate", `candidate-${candidate.id}`);
  });

  highlights.forEach((highlight) => {
    ingestStatement(highlight.sentence, highlight.page, "highlight", `highlight-${hashString(highlight.sentence)}`);
  });

  const buckets = new Map<SummaryHeading, DecisionStatement[]>();
  statements.forEach((statement) => {
    const heading = classifySection(statement.source);
    const list = buckets.get(heading) ?? [];
    list.push(statement);
    buckets.set(heading, list);
  });

  const fallbackPool = [...statements];

  const sections: SummarySection[] = SECTION_HEADINGS.map((heading) => {
    const primary = buckets.get(heading) ?? [];
    const selected: DecisionStatement[] = [...primary];
    fallbackPool.forEach((statement) => {
      if (selected.length >= 4) return;
      if (selected.some((item) => item.id === statement.id)) return;
      if (selected.length < 2) {
        selected.push(statement);
      }
    });
    const ensured = selected.slice(0, Math.max(2, Math.min(4, selected.length)));
    return {
      heading,
      summary: buildSectionSummary(heading, ensured),
    };
  });

  return {
    intro,
    sections,
    themes,
    decisionBullets,
    supportingEvidence,
  };
}
