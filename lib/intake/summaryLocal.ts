import type { DecisionCandidate } from "./decisionExtractLocal";
import { scoreSentence, splitSentences } from "./decisionScoring";
import type { SectionedPage } from "./sectionSplit";

export interface DecisionStatement {
  id: string;
  text: string;
  source: string;
}

export interface SummarySection {
  heading: "What happened" | "What they did" | "What they’re betting on" | "What changes next";
  summary: string;
  decisions: DecisionStatement[];
}

export interface LocalSummary {
  intro: string;
  sections: SummarySection[];
  themes: string[];
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

const pickHighlightSentences = (pages: SectionedPage[], candidates: DecisionCandidate[]): string[] => {
  const excluded = new Set(candidates.map((candidate) => candidate.decision));
  const scored: Array<{ sentence: string; score: number }> = [];

  pages
    .filter((page) => !page.isLowSignal)
    .forEach((page) => {
      splitSentences(page.text).forEach((sentence) => {
        const trimmed = sentence.trim();
        if (!trimmed || excluded.has(trimmed)) return;
        const scoreResult = scoreSentence(trimmed);
        if (scoreResult.flags.isBoilerplate || scoreResult.flags.isTableLike) return;
        if (scoreResult.score < 3) return;
        scored.push({ sentence: trimmed, score: scoreResult.score });
      });
    });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => item.sentence)
    .slice(0, 6);
};

const SECTION_HEADINGS: SummarySection["heading"][] = [
  "What happened",
  "What they did",
  "What they’re betting on",
  "What changes next",
];

const ACTOR_REGEX = /^(?:the\s+)?(company|management|board|team|we|tesla)\b[,:-]?\s*/i;
const ACTION_PREFIXES = [
  "will",
  "plans to",
  "plan to",
  "expects to",
  "expect to",
  "aims to",
  "aim to",
  "intends to",
  "intend to",
  "is",
  "are",
  "has",
  "have",
  "began",
  "begins",
  "start",
  "started",
  "launch",
  "launched",
  "ramp",
  "ramping",
  "build",
  "built",
  "deploy",
  "deployed",
  "deliver",
  "delivered",
  "expand",
  "expanded",
  "complete",
  "completed",
];

const CONSTRAINT_PATTERNS = [
  /\bby\s+[^,.]+/i,
  /\bin\s+(?:q[1-4]\b[^,.]*|h[12]\b[^,.]*|20\d{2}\b[^,.]*|the\s+next[^,.]*|the\s+first\s+half[^,.]*|the\s+second\s+half[^,.]*|next\s+[^,.]*|this\s+[^,.]*)/i,
  /\bafter\s+[^,.]+/i,
  /\bbefore\s+[^,.]+/i,
  /\bwithin\s+[^,.]+/i,
  /\bover\s+[^,.]+/i,
  /\bsubject to\s+[^,.]+/i,
  /\bpending\s+[^,.]+/i,
  /\bdepending on\s+[^,.]+/i,
];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const detectActor = (text: string) => {
  const match = text.match(/\b(Tesla|Company|Management|Board|Team|We)\b/i);
  if (!match) return "Company";
  const actor = match[0];
  if (actor.toLowerCase() === "we") return "Company";
  return actor.charAt(0).toUpperCase() + actor.slice(1);
};

const normalizeAction = (text: string) => {
  const trimmed = normalizeWhitespace(text.replace(/[.]+$/, ""));
  const withoutActor = trimmed.replace(ACTOR_REGEX, "");
  const lowered = withoutActor.toLowerCase();
  const prefix = ACTION_PREFIXES.find((item) => lowered.startsWith(`${item} `) || lowered === item);
  if (!prefix) return withoutActor;
  return normalizeWhitespace(withoutActor.slice(prefix.length));
};

const extractConstraint = (text: string) => {
  for (const pattern of CONSTRAINT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[0]) return normalizeWhitespace(match[0]).replace(/[.]+$/, "");
  }
  return "the stated scope";
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const buildDecisionStatement = (text: string, id: string): DecisionStatement | null => {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return null;
  const actor = detectActor(cleaned);
  const action = normalizeAction(cleaned);
  if (!action) return null;
  const constraint = extractConstraint(cleaned);
  return {
    id,
    text: `${actor} commits to ${action}, accepting ${constraint}.`,
    source: cleaned,
  };
};

const classifySection = (text: string): SummarySection["heading"] => {
  const lower = text.toLowerCase();
  if (/\b(completed|launched|delivered|achieved|began|started|deployed|commissioned|expanded|added)\b/.test(lower)) {
    return "What happened";
  }
  if (/\b(will|plans|plan|scheduled|begin|start|launch|ramp|deploy|build|expand)\b/.test(lower)) {
    return "What they did";
  }
  if (/\b(expect|expects|aim|aims|target|intends|intend|prioritize|focus|strategy)\b/.test(lower)) {
    return "What they’re betting on";
  }
  if (/\b(next|by|in\s+\d{4}|in\s+q[1-4]|in\s+h[12]|after|before|within|over)\b/.test(lower)) {
    return "What changes next";
  }
  return "What they did";
};

const extractTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !STOPWORDS.has(token));

const buildSectionSummary = (heading: SummarySection["heading"], statements: DecisionStatement[]) => {
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
  if (heading === "What they did") {
    return topic ? `The active push is toward ${topic}.` : "Active commitments show a clear operational push.";
  }
  if (heading === "What they’re betting on") {
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
  const statementKeys = new Set<string>();

  candidates.forEach((candidate) => {
    const statement = buildDecisionStatement(candidate.decision, `candidate-${candidate.id}`);
    if (!statement) return;
    const key = statement.text.toLowerCase();
    if (statementKeys.has(key)) return;
    statementKeys.add(key);
    statements.push(statement);
  });

  highlights.forEach((sentence) => {
    if (statementKeys.size >= 20) return;
    const statement = buildDecisionStatement(sentence, `highlight-${hashString(sentence)}`);
    if (!statement) return;
    const key = statement.text.toLowerCase();
    if (statementKeys.has(key)) return;
    statementKeys.add(key);
    statements.push(statement);
  });

  const buckets = new Map<SummarySection["heading"], DecisionStatement[]>();
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
      decisions: ensured,
    };
  });

  return {
    intro,
    sections,
    themes,
  };
}
