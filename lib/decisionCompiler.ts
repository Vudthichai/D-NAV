import type { EvidenceAnchor } from "@/components/stress-test/decision-intake-types";
import type {
  ConstraintTime,
  ConstraintTimeNormalized,
  DecisionEvidenceAnchor,
  DecisionModality,
  DecisionObject,
  DecisionTriage,
} from "@/types/decisionCompiler";

const COMMITMENT_SIGNALS = [
  "will",
  "plan to",
  "plans to",
  "expect to",
  "expects to",
  "target",
  "targets",
  "begin",
  "start",
  "launch",
  "ramp",
  "expand",
  "build",
  "deploy",
  "open",
  "discontinue",
  "delay",
  "invest",
  "acquire",
  "divest",
];

const REPORTING_TERMS = [
  "revenue",
  "net income",
  "ebitda",
  "gross margin",
  "operating income",
  "cash flow",
  "unaudited",
  "financial summary",
  "results",
  "margins",
  "yoy",
  "qoq",
  "earnings per share",
  "eps",
];

const TABLE_HEADER_TERMS = [
  "financial summary",
  "balance sheet",
  "income statement",
  "cash flow",
  "unaudited",
  "table of contents",
];

const ACTION_PATTERNS: Array<{ pattern: RegExp; lemma: string }> = [
  { pattern: /\bstart(?:ing|ed)? production\b/i, lemma: "start production" },
  { pattern: /\bbegin(?:s|ning|ned)?\b/i, lemma: "begin" },
  { pattern: /\bstart(?:s|ing|ed)?\b/i, lemma: "start" },
  { pattern: /\blaunch(?:es|ed|ing)?\b/i, lemma: "launch" },
  { pattern: /\bramp(?:s|ed|ing)?(?:\s+up)?\b/i, lemma: "ramp" },
  { pattern: /\bexpand(?:s|ed|ing)?\b/i, lemma: "expand" },
  { pattern: /\bbuild(?:s|ing|ed)?\b/i, lemma: "build" },
  { pattern: /\bdeploy(?:s|ed|ing)?\b/i, lemma: "deploy" },
  { pattern: /\bopen(?:s|ed|ing)?\b/i, lemma: "open" },
  { pattern: /\bdiscontinue(?:s|d|ing)?\b/i, lemma: "discontinue" },
  { pattern: /\bdelay(?:s|ed|ing)?\b/i, lemma: "delay" },
  { pattern: /\binvest(?:s|ed|ing)?\b/i, lemma: "invest" },
  { pattern: /\bacquire(?:s|d|ing)?\b/i, lemma: "acquire" },
  { pattern: /\bdivest(?:s|ed|ing)?\b/i, lemma: "divest" },
  { pattern: /\bproduce(?:s|d|ing)?\b/i, lemma: "produce" },
];

const LOCATION_PATTERNS: RegExp[] = [
  /\bin\s+parts\s+of\s+the\s+U\.S\./i,
  /\bin\s+the\s+U\.S\./i,
  /\bin\s+the\s+United\s+States\b/i,
  /\bin\s+China\b/i,
  /\bin\s+Shanghai\b/i,
  /\bin\s+Nevada\b/i,
  /\bin\s+Texas\b/i,
  /\bin\s+[A-Z][A-Za-z.-]*(?:\s+[A-Z][A-Za-z.-]*)*/i,
];

const MODALITY_RULES: Array<{ pattern: RegExp; modality: DecisionModality; phrase: string }> = [
  { pattern: /\bplans?\s+to\b|\bplanning\s+to\b/i, modality: "PLAN", phrase: "plans to" },
  { pattern: /\bexpects?\s+to\b/i, modality: "EXPECT", phrase: "expects to" },
  { pattern: /\btargets?\b|\btargeting\b/i, modality: "TARGET", phrase: "targets" },
  { pattern: /\bwill\b/i, modality: "WILL", phrase: "will" },
  { pattern: /\bmay\b|\bmight\b|\bcould\b/i, modality: "MAY", phrase: "may" },
];

const DATE_PATTERNS = {
  iso: /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/,
  numeric: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/,
  quarter: /\bQ([1-4])\s?-?\s?(20\d{2})\b/i,
  half: /\b([12])H\s?(20\d{2})\b/i,
  fiscal: /\bFY\s?(20\d{2})\b/i,
  year: /\b(20\d{2})\b/,
  yearEnd: /\bby\s+end\s+of\s+(20\d{2})\b/i,
  relative: /\b(later this year|later this quarter|next quarter|next year|next month)\b/i,
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();

const normalizeTokenArtifacts = (text: string) => {
  let cleaned = text;
  ["launch", "ramp", "start", "expand", "deploy", "open", "close", "approve", "invest"].forEach((verb) => {
    const pattern = new RegExp(`\\b${verb}\\s+ed\\b`, "gi");
    const replacement = verb.endsWith("e") ? `${verb}d` : `${verb}ed`;
    cleaned = cleaned.replace(pattern, replacement);
  });
  return cleaned;
};

const detectActor = (text: string) => {
  const match = text.match(/\b(Tesla|Company|Management|Board|Team|We)\b/i);
  if (!match) return "Company";
  const actor = match[0];
  if (actor.toLowerCase() === "we" || actor.toLowerCase() === "company") return "Company";
  if (actor.toLowerCase() === "management") return "Management";
  if (actor.toLowerCase() === "board") return "Board";
  if (actor.toLowerCase() === "team") return "Team";
  return actor;
};

const detectModality = (text: string) => {
  for (const rule of MODALITY_RULES) {
    if (rule.pattern.test(text)) {
      return { modality: rule.modality, phrase: rule.phrase };
    }
  }
  return { modality: "WILL" as DecisionModality, phrase: "will" };
};

const detectAction = (text: string) => {
  let best: { lemma: string; index: number; match: string } | null = null;
  ACTION_PATTERNS.forEach(({ pattern, lemma }) => {
    const match = pattern.exec(text);
    if (match) {
      const index = match.index;
      if (!best || index < best.index) {
        best = { lemma, index, match: match[0] };
      }
    }
  });
  return best;
};

const stripTimePhrases = (text: string) =>
  text
    .replace(/\bby\b[^,;.]+/gi, "")
    .replace(/\b(?:in|during|through)\s+Q[1-4]\s?-?\s?20\d{2}\b/gi, "")
    .replace(/\b(?:in|during|through)\s+[12]H\s?20\d{2}\b/gi, "")
    .replace(/\b(?:in|during|through)\s+FY\s?20\d{2}\b/gi, "")
    .replace(/\b(?:in|during|through)\s+20\d{2}\b/gi, "")
    .replace(DATE_PATTERNS.relative, "")
    .trim();

const extractLocation = (text: string) => {
  for (const pattern of LOCATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const phrase = match[0].replace(/^in\s+/i, "").trim();
      if (!/\bQ[1-4]|FY|20\d{2}/i.test(phrase)) {
        return phrase;
      }
    }
  }
  return null;
};

const extractObject = (text: string, actionMatch: { index: number; match: string } | null) => {
  if (!actionMatch) return "";
  const afterVerb = text.slice(actionMatch.index + actionMatch.match.length);
  let object = afterVerb.replace(/^\s*(?:to\s+)?/i, "");
  object = stripTimePhrases(object);
  object = object.split(/[.;]/)[0];
  object = object.replace(/\b(in|within|across)\b[^,;.]+/i, "");
  object = normalizeWhitespace(object);
  if (!object) return "";
  const words = object.split(" ");
  return words.slice(0, 10).join(" ");
};

const isReportingStatement = (text: string) => {
  const lower = text.toLowerCase();
  if (TABLE_HEADER_TERMS.some((term) => lower.includes(term))) return true;
  const hasMetric = REPORTING_TERMS.some((term) => lower.includes(term));
  if (!hasMetric) return false;
  const hasCommitment = COMMITMENT_SIGNALS.some((term) => lower.includes(term));
  if (hasCommitment) return false;
  return /\b(was|were|reported|delivered|achieved|grew|declined|decreased|increased)\b/i.test(text);
};

const formatIsoDate = (year: number, month: number, day: number) => {
  const mm = `${month}`.padStart(2, "0");
  const dd = `${day}`.padStart(2, "0");
  return `${year}-${mm}-${dd}`;
};

const parseYear = (yearText: string) => {
  if (yearText.length === 2) {
    const year = Number(yearText);
    return year <= 50 ? 2000 + year : 1900 + year;
  }
  return Number(yearText);
};

const normalizeConstraintTime = (text: string): ConstraintTime | null => {
  const isoMatch = text.match(DATE_PATTERNS.iso);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const normalized: ConstraintTimeNormalized = {
      type: "date",
      value: formatIsoDate(Number(year), Number(month), Number(day)),
    };
    return { raw: isoMatch[0], normalized };
  }

  const numericMatch = text.match(DATE_PATTERNS.numeric);
  if (numericMatch) {
    const [, month, day, yearText] = numericMatch;
    const year = parseYear(yearText);
    const normalized: ConstraintTimeNormalized = {
      type: "date",
      value: formatIsoDate(year, Number(month), Number(day)),
    };
    return { raw: numericMatch[0], normalized };
  }

  const quarterMatch = text.match(DATE_PATTERNS.quarter);
  if (quarterMatch) {
    const [, quarter, year] = quarterMatch;
    const normalized: ConstraintTimeNormalized = {
      type: "quarter",
      quarter: Number(quarter) as 1 | 2 | 3 | 4,
      year: Number(year),
    };
    return { raw: quarterMatch[0], normalized };
  }

  const halfMatch = text.match(DATE_PATTERNS.half);
  if (halfMatch) {
    const [, half, year] = halfMatch;
    const normalized: ConstraintTimeNormalized = {
      type: "half",
      half: Number(half) as 1 | 2,
      year: Number(year),
    };
    return { raw: halfMatch[0], normalized };
  }

  const fiscalMatch = text.match(DATE_PATTERNS.fiscal);
  if (fiscalMatch) {
    const [, year] = fiscalMatch;
    const normalized: ConstraintTimeNormalized = { type: "fiscalYear", year: Number(year) };
    return { raw: fiscalMatch[0], normalized };
  }

  const yearEndMatch = text.match(DATE_PATTERNS.yearEnd);
  if (yearEndMatch) {
    const [, year] = yearEndMatch;
    const normalized: ConstraintTimeNormalized = { type: "year", year: Number(year) };
    return { raw: yearEndMatch[0], normalized };
  }

  const relativeMatch = text.match(DATE_PATTERNS.relative);
  if (relativeMatch) {
    const normalized: ConstraintTimeNormalized = { type: "relative", label: relativeMatch[0] };
    return { raw: relativeMatch[0], normalized };
  }

  const yearMatch = text.match(DATE_PATTERNS.year);
  if (yearMatch) {
    const normalized: ConstraintTimeNormalized = { type: "year", year: Number(yearMatch[1]) };
    return { raw: yearMatch[0], normalized };
  }

  return null;
};

const enforceSentenceLength = (sentence: string) => {
  const trimmed = normalizeWhitespace(sentence);
  if (trimmed.length <= 110) return trimmed;
  let shortened = trimmed.split(/[,;:]/)[0].trim();
  if (shortened.length <= 160) return shortened;
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 159).trim()}…`;
};

const buildCanonicalText = (
  actor: string,
  modalityPhrase: string,
  action: string,
  object: string,
  location: string | null,
  time: ConstraintTime | null,
) => {
  const parts = [`${actor} ${modalityPhrase} ${action}`.trim()];
  if (object) parts.push(object);
  if (location) parts.push(`in ${location}`);
  if (time?.raw) parts.push(time.raw);
  return enforceSentenceLength(normalizeWhitespace(parts.join(" ")));
};

const computeConfidence = (action: string, object: string, modality: DecisionModality, time: ConstraintTime | null) => {
  let score = 0.4;
  if (action) score += 0.2;
  if (object) score += 0.2;
  if (modality !== "MAY") score += 0.1;
  if (time) score += 0.1;
  return clamp(score);
};

const computeStableHash = (value: string) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
};

export const compileDecisionObject = ({
  text,
  evidenceAnchors,
  tableNoise = false,
}: {
  text: string;
  evidenceAnchors: EvidenceAnchor[];
  tableNoise?: boolean;
}): DecisionObject => {
  const cleaned = normalizeTokenArtifacts(normalizeWhitespace(text));
  const actor = detectActor(cleaned);
  const { modality, phrase } = detectModality(cleaned);
  const actionMatch = detectAction(cleaned);
  const action = actionMatch?.lemma ?? "";
  const location = extractLocation(cleaned);
  const object = extractObject(cleaned, actionMatch ? { index: actionMatch.index, match: actionMatch.match } : null);
  const constraint_time = normalizeConstraintTime(cleaned);

  let triage: DecisionTriage = "KEEP";
  let triageReason = "";

  if (tableNoise) {
    triage = "DROP";
    triageReason = "table/header noise";
  } else if (isReportingStatement(cleaned)) {
    triage = "DROP";
    triageReason = "state/reporting, not commitment";
  } else if (!action || !object) {
    triage = "MAYBE";
    triageReason = "missing action or object";
  } else if (modality === "MAY") {
    triage = "MAYBE";
    triageReason = "weak modality";
  }

  if (!triageReason) {
    triageReason = triage === "KEEP" ? "clear commitment" : "ambiguous commitment";
  }

  const canonical_text = buildCanonicalText(actor, phrase, action || "commit", object, location, constraint_time);
  const confidence_of_extraction = computeConfidence(action, object, modality, constraint_time);
  const id = `decision-${computeStableHash(`${actor}|${action}|${object}|${constraint_time?.raw ?? ""}|${modality}`)}`;

  const evidence_anchors: DecisionEvidenceAnchor[] = evidenceAnchors.map((anchor) => ({
    file: anchor.fileName,
    page: anchor.page,
    snippet: anchor.excerpt,
    span_start: anchor.charStart,
    span_end: anchor.charEnd,
  }));

  return {
    id,
    canonical_text,
    actor,
    action: action || "commit",
    object,
    constraint_time,
    constraint_location: location,
    modality,
    confidence_of_extraction,
    triage,
    triage_reason: triageReason,
    evidence_anchors,
  };
};
