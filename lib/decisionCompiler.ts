import type {
  CanonicalDecision,
  Candidate,
  DecisionGateBin,
  DecisionGateDiagnostics,
  DecisionQualityGate,
  EvidenceAnchor,
  RawCandidate,
  UploadedDoc,
} from "@/components/stress-test/decision-intake-types";

type TextChunk = {
  docId: string;
  fileName: string;
  pageNumber: number;
  text: string;
};

type PageTextData = {
  pageTextRaw: string;
  pageLines: string[];
  paragraphText: string;
};

type GateResult = {
  bin: DecisionGateBin;
  gate: DecisionQualityGate;
};

type CanonicalUnit = {
  candidate: Candidate;
  title: string;
  titleStatus: "Ok" | "NeedsRewrite";
  timeHintRaw?: string | null;
  timingNormalized?: CanonicalDecision["timingNormalized"];
  timeCue?: { raw: string; confidence: number };
  actionVerb: string;
  objectKey: string;
  timeBucket: string;
  tokens: Set<string>;
};

const COMMITMENT_VERBS = [
  "will",
  "plan to",
  "plans to",
  "expect to",
  "expects to",
  "intend to",
  "intends to",
  "scheduled to",
  "launch",
  "begin",
  "start",
  "ramp",
  "build",
  "expand",
  "reduce",
  "invest",
  "deploy",
  "introduce",
  "roll out",
  "discontinue",
  "acquire",
  "open",
  "close",
  "schedule",
  "complete",
];

const ACTION_VERBS = [
  "launch",
  "begin",
  "start",
  "ramp",
  "build",
  "expand",
  "reduce",
  "invest",
  "deploy",
  "introduce",
  "roll out",
  "discontinue",
  "acquire",
  "open",
  "close",
  "schedule",
  "complete",
  "produce",
  "hire",
];

const RESOURCE_MARKERS = [
  "capex",
  "investment",
  "construction",
  "hiring",
  "manufacturing",
  "ramp",
  "production start",
  "production",
];

const METRIC_TERMS = [
  "revenue",
  "yoy",
  "qoq",
  "margin",
  "eps",
  "earnings per share",
  "operating income",
  "cash flow",
  "free cash flow",
  "diluted",
  "operating profit",
  "net income",
];

const HEADER_TERMS = ["financial summary", "outlook", "guidance", "results"];

const WEAK_MODALS = ["may", "might", "could"];

const actionVerbPatterns = ACTION_VERBS.map((verb) => {
  if (verb.includes(" ")) {
    return new RegExp(`\\b${verb.replace(/\s+/g, "\\\\s+")}\\b`, "i");
  }
  return new RegExp(`\\b${verb}(?:s|es|ed|ing)?\\b`, "i");
});

const commitmentVerbPatterns = COMMITMENT_VERBS.map((verb) => {
  if (verb.includes(" ")) {
    return new RegExp(`\\b${verb.replace(/\s+/g, "\\\\s+")}\\b`, "i");
  }
  if (verb === "will") {
    return /\bwill\b/i;
  }
  return new RegExp(`\\b${verb}(?:s|es|ed|ing)?\\b`, "i");
});

const STOP_PHRASES = [
  "we expect",
  "we believe",
  "the company",
  "company",
  "management",
  "board",
  "team",
];

const VERB_SYNONYMS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\broll\s?out\b/i, canonical: "roll out" },
  { pattern: /\brelease\b/i, canonical: "launch" },
  { pattern: /\bintroduce\b/i, canonical: "introduce" },
  { pattern: /\bscale(?:\s?up)?\b/i, canonical: "ramp" },
  { pattern: /\bkick\s?off\b/i, canonical: "begin" },
  { pattern: /\bcommence\b/i, canonical: "begin" },
  { pattern: /\bmanufacture\b/i, canonical: "produce" },
  { pattern: /\bstart\s+production\b/i, canonical: "start production" },
];

const OBJECT_KEYWORDS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /\brobotaxi\b/i, key: "robotaxi" },
  { pattern: /\bmegafactory shanghai\b/i, key: "megafactory shanghai" },
  { pattern: /\bmegafactory\b/i, key: "megafactory" },
  { pattern: /\baffordable models?\b/i, key: "affordable models" },
  { pattern: /\bmore affordable models?\b/i, key: "affordable models" },
  { pattern: /\bsemi\b/i, key: "semi" },
  { pattern: /\benergy storage\b/i, key: "energy storage" },
  { pattern: /\bfull self-driving\b/i, key: "fsd" },
  { pattern: /\bfsd\b/i, key: "fsd" },
  { pattern: /\bproduction\b/i, key: "production" },
];

const STOPWORDS = new Set([
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
  "expects",
  "expect",
  "aim",
  "aims",
  "intend",
  "intends",
  "company",
  "tesla",
  "management",
  "board",
  "team",
  "we",
]);

const DATE_PATTERNS = [
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{2,4})?\b/gi,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+20\d{2}\b/gi,
  /\bQ[1-4]\s?20\d{2}\b/gi,
  /\b[12]H\s?20\d{2}\b/gi,
  /\bFY\s?20\d{2}\b/gi,
  /\b(?:later this year|later this quarter|next quarter|next year|next month|end of 20\d{2}|by end of 20\d{2})\b/gi,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi,
];

const MAX_TITLE_LENGTH = 110;

const WORD_MERGES: Array<[RegExp, string]> = [
  [/\bdeploy\s+ments\b/gi, "deployments"],
  [/\binvest\s+ments\b/gi, "investments"],
  [/\bdeliver\s+ies\b/gi, "deliveries"],
];

export const cleanText = (text: string) => {
  let cleaned = text ?? "";
  WORD_MERGES.forEach(([pattern, replacement]) => {
    cleaned = cleaned.replace(pattern, replacement);
  });
  cleaned = cleaned.replace(/\b([a-z]{3,})\s+((?:m|n|r|l|t)ents)\b/gi, "$1$2");
  cleaned = cleaned.replace(/\b([a-z]{3,})\s+ies\b/gi, "$1ies");
  cleaned = cleaned.replace(/\s+([,.;:!?])/g, "$1");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  return cleaned.trim();
};

const cleanLine = (line: string) => cleanText(line);

const ingestPageText = (text: string): PageTextData => {
  const pageTextRaw = text ?? "";
  const pageLines = pageTextRaw.split(/\r?\n/).map((line) => cleanLine(line));
  const paragraphText = cleanLine(pageLines.filter(Boolean).join(" "));
  return {
    pageTextRaw,
    pageLines,
    paragraphText,
  };
};

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const buildSentenceUnits = (paragraphText: string) =>
  splitSentences(paragraphText).filter((unit) => unit.length >= 30 && unit.length <= 280);

const buildLineUnits = (lines: string[]) => {
  const units: string[] = [];
  let buffer = "";
  lines.forEach((line) => {
    if (!line) return;
    if (!buffer) {
      buffer = line;
      return;
    }
    const merged = `${buffer} ${line}`.trim();
    if (merged.length <= 280) {
      buffer = merged;
      return;
    }
    if (buffer.length >= 30 && buffer.length <= 280) {
      units.push(buffer);
    }
    buffer = line;
  });
  if (buffer.length >= 30 && buffer.length <= 280) {
    units.push(buffer);
  }
  return units;
};

const countDigits = (text: string) => (text.match(/\d/g) ?? []).length;

const digitRatio = (text: string) => {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return 0;
  return countDigits(compact) / compact.length;
};

const isAllCapsHeader = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;
  if (HEADER_TERMS.some((term) => trimmed.toLowerCase() === term)) return true;
  return trimmed === trimmed.toUpperCase() && /^[A-Z\s&-]+$/.test(trimmed);
};

const looksLikeTableRow = (text: string) => {
  const commaCount = (text.match(/,/g) ?? []).length;
  const separatorCount = (text.match(/[|•·]/g) ?? []).length;
  return (commaCount >= 4 && digitRatio(text) > 0.18) || separatorCount >= 4;
};

const containsMetricTerms = (text: string) => {
  const lower = text.toLowerCase();
  return METRIC_TERMS.some((term) => lower.includes(term)) || /\b(yoy|qoq)\b/i.test(text);
};

const containsActionVerb = (text: string) => actionVerbPatterns.some((pattern) => pattern.test(text));

const containsTimeMarker = (text: string) =>
  /\b(Q[1-4]\s?20\d{2}|[12]H\s?20\d{2}|FY\s?20\d{2}|later this year|later this quarter|next quarter|next year|next month|end of 20\d{2}|by end of 20\d{2})\b/i.test(
    text,
  ) ||
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i.test(text) ||
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+20\d{2}\b/i.test(text);

const containsResourceMarker = (text: string) =>
  RESOURCE_MARKERS.some((term) => text.toLowerCase().includes(term));

const detectCommitmentVerb = (text: string) => {
  const lowered = text.toLowerCase();
  let bestIndex = Number.POSITIVE_INFINITY;
  let bestVerb: string | null = null;
  let strength = 0;

  const registerMatch = (verb: string, match: RegExpExecArray | null, baseStrength: number) => {
    if (!match) return;
    if (match.index < bestIndex) {
      bestIndex = match.index;
      bestVerb = verb;
      strength = baseStrength;
    }
  };

  actionVerbPatterns.forEach((pattern, index) => {
    registerMatch(ACTION_VERBS[index], pattern.exec(text), 1);
  });

  VERB_SYNONYMS.forEach(({ pattern, canonical }) => {
    registerMatch(canonical, pattern.exec(text), 1);
  });

  commitmentVerbPatterns.forEach((pattern, index) => {
    if (bestVerb) return;
    const match = pattern.exec(text);
    if (match) {
      bestVerb = COMMITMENT_VERBS[index];
      strength = 0.8;
      bestIndex = match.index;
    }
  });

  if (WEAK_MODALS.some((term) => lowered.includes(term)) && strength > 0) {
    strength = Math.min(strength, 0.45);
  }

  return {
    verb: bestVerb,
    strength,
  };
};

const extractDateMentions = (text: string) => {
  const matches = DATE_PATTERNS.flatMap((pattern) => text.match(pattern) ?? []);
  return Array.from(new Set(matches));
};

const pickBestTimeCue = (dateMentions: string[], text: string) => {
  const candidates = dateMentions.length > 0 ? dateMentions : extractDateMentions(text);
  if (candidates.length === 0) return undefined;
  const normalized = candidates.map((value) => value.trim());
  const scoreTimeCue = (cue: string) => {
    if (/\bQ[1-4]\s?20\d{2}\b/i.test(cue)) return 5;
    if (/\b[12]H\s?20\d{2}\b/i.test(cue)) return 4;
    if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i.test(cue)) return 4;
    if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+20\d{2}\b/i.test(cue)) return 3;
    if (/\bFY\s?20\d{2}\b/i.test(cue)) return 3;
    if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(cue)) return 3;
    if (/\bend of 20\d{2}\b/i.test(cue)) return 3;
    if (/\b20\d{2}\b/.test(cue)) return 2;
    return 1;
  };
  const best = normalized.reduce((acc, cue) => (scoreTimeCue(cue) > scoreTimeCue(acc) ? cue : acc), normalized[0]);
  const confidence = Math.min(1, 0.5 + scoreTimeCue(best) * 0.1);
  return { raw: best, confidence };
};

const normalizeTimingFromHint = (hint?: string | null) => {
  if (!hint) return { precision: "unknown" as const };
  if (/\bQ[1-4]\s?20\d{2}\b/i.test(hint)) {
    return { precision: "quarter" as const };
  }
  if (/\b[12]H\s?20\d{2}\b/i.test(hint)) {
    return { precision: "year" as const };
  }
  if (/\bFY\s?20\d{2}\b/i.test(hint) || /\b20\d{2}\b/.test(hint)) {
    return { precision: "year" as const };
  }
  if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i.test(hint)) {
    return { precision: "day" as const };
  }
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(hint)) {
    return { precision: "day" as const };
  }
  if (/\b(?:later this year|later this quarter|next quarter|next year|next month)\b/i.test(hint)) {
    return { precision: "relative" as const };
  }
  return { precision: "unknown" as const };
};

const detectConstraintSignals = (text: string) => {
  const dateMentions = extractDateMentions(text);
  return {
    time: containsTimeMarker(text) || dateMentions.length > 0 ? 1 : 0,
    capital: containsResourceMarker(text) ? 1 : 0,
    exposure: /\b(guidance|outlook|expects|expect|forecast|target|will)\b/i.test(text) ? 1 : 0,
    dependency: /\b(requires|in order to|dependent on|contingent on|after|before|once)\b/i.test(text) ? 1 : 0,
    reversalCost:
      /\b(completed|construction finished|signed|launched|begun|started production|underway|already)\b/i.test(text)
        ? 1
        : 0,
    dateMentions,
  };
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const optionalityScoreFromSignals = (commitmentStrength: number, signals: ReturnType<typeof detectConstraintSignals>) =>
  clamp(
    0.35 * commitmentStrength +
      0.25 * signals.time +
      0.2 * signals.capital +
      0.1 * signals.exposure +
      0.05 * signals.dependency +
      0.05 * signals.reversalCost,
  );

const isMetricNoise = (text: string) =>
  containsMetricTerms(text) &&
  !containsActionVerb(text) &&
  /\b(was|were|increased|decreased|declined|grew|improved|impacted|due to)\b/i.test(text);

const isForecastMaybe = (text: string) =>
  /\b(expected to|expect to|expects to|forecast to|forecasted to|deliveries expected to)\b/i.test(text);

const isFragment = (text: string) => text.trim().length < 35 || isAllCapsHeader(text) || looksLikeTableRow(text);

const scoreGate = (candidate: RawCandidate): GateResult => {
  const cleanedText = cleanText(candidate.rawText);
  const commitment = detectCommitmentVerb(cleanedText);
  const signals = detectConstraintSignals(cleanedText);
  const hasAction = containsActionVerb(cleanedText);
  const hasTime = containsTimeMarker(cleanedText);
  const hasResource = containsResourceMarker(cleanedText);
  const metricNoise = isMetricNoise(cleanedText);
  const header = isAllCapsHeader(cleanedText) || HEADER_TERMS.some((term) => cleanedText.toLowerCase().includes(term));
  const fragment = isFragment(cleanedText);
  const forecastMaybe = isForecastMaybe(cleanedText);

  const reasonsIncluded: string[] = [];
  const reasonsExcluded: string[] = [];

  if (commitment.verb) reasonsIncluded.push(`commitmentVerb:${commitment.verb}`);
  if (hasTime) reasonsIncluded.push("timeMarker");
  if (hasResource) reasonsIncluded.push("resourceMarker");
  if (hasAction) reasonsIncluded.push("actionVerb");

  if (metricNoise) reasonsExcluded.push("metricNoise");
  if (header) reasonsExcluded.push("sectionHeader");
  if (!hasAction && !commitment.verb) {
    reasonsExcluded.push("missingActionVerb");
    reasonsExcluded.push("missingCommitmentVerb");
  }
  if (fragment) reasonsExcluded.push("fragment");
  if (forecastMaybe) reasonsIncluded.push("forecast");

  let score = 0;
  if (commitment.verb) score += 0.45;
  if (hasAction) score += 0.2;
  if (hasTime) score += 0.2;
  if (hasResource) score += 0.2;
  if (forecastMaybe) score += 0.1;
  if (metricNoise) score -= 0.6;
  if (header) score -= 0.4;
  if (fragment) score -= 0.25;
  if (!hasAction && !commitment.verb) score -= 0.3;
  score = clamp(score);

  let bin: DecisionGateBin = "Rejected";
  if (!metricNoise && !header) {
    if (!hasAction && !commitment.verb) {
      bin = "Rejected";
    } else if (score >= 0.6 && (hasAction || commitment.verb)) {
      bin = "Decision";
    } else if (score >= 0.35 || forecastMaybe) {
      bin = "MaybeDecision";
    }
  }

  const optionalityScore = optionalityScoreFromSignals(commitment.strength, signals);
  const gate: DecisionQualityGate = {
    bin,
    optionalityScore,
    commitmentVerb: commitment.verb,
    commitmentStrength: commitment.strength,
    constraintSignals: signals,
    reasonsIncluded,
    reasonsExcluded,
  };

  return { bin, gate };
};

const findLineIndexForUnit = (lines: string[], unit: string) => {
  if (lines.length === 0) return -1;
  const probe = unit.slice(0, 32).toLowerCase();
  const exactIndex = lines.findIndex((line) => line.toLowerCase().includes(probe));
  if (exactIndex >= 0) return exactIndex;
  return lines.findIndex((line) => line.toLowerCase().includes(unit.toLowerCase()));
};

const buildContextText = (lines: string[], unit: string, lineIndex: number) => {
  if (lineIndex < 0) return unit;
  const prevLine = lines
    .slice(0, lineIndex)
    .reverse()
    .find((line) => line.trim().length > 0);
  const nextLine = lines.slice(lineIndex + 1).find((line) => line.trim().length > 0);
  return [prevLine, unit, nextLine].filter(Boolean).join("\n");
};

const findSectionHint = (lines: string[], lineIndex: number) => {
  if (lineIndex < 0) return undefined;
  for (let i = lineIndex; i >= 0; i -= 1) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (isAllCapsHeader(line) || line.endsWith(":")) {
      return line;
    }
  }
  return undefined;
};

const stripBoilerplatePrefix = (text: string) =>
  text
    .replace(
      /^(?:the\s+)?company\s+(?:will|expects to|expect to|plans to|plan to|aims to|aim to|intends to|intend to|scheduled to)\s+/i,
      "",
    )
    .replace(
      /^tesla\s+(?:will|expects to|expect to|plans to|plan to|aims to|aim to|intends to|intend to|scheduled to)\s+/i,
      "",
    )
    .replace(
      /^(?:we|management|board|team)\s+(?:will|expect to|expects to|plan to|plans to|aim to|aims to|intend to|intends to|scheduled to)\s+/i,
      "",
    )
    .trim();

const stripFillerPhrases = (text: string) =>
  text
    .replace(/\bwe believe\b/gi, "")
    .replace(/\bwe continue\b/gi, "")
    .replace(/\bwe are focused on\b/gi, "")
    .replace(/\bwe saw\b/gi, "")
    .replace(/\bwe delivered\b/gi, "")
    .replace(/\bthe company\b/gi, "")
    .replace(/\bmanagement\b/gi, "")
    .replace(/\bboard\b/gi, "")
    .replace(/\bteam\b/gi, "");

const stripSubordinateClauses = (text: string) =>
  text
    .split(/\b(?:due to|as a result|which|that|because|after|before|while|if)\b/i)[0]
    .split(/[.;]/)[0]
    .trim();

const repairTokenization = (text: string) =>
  text
    .replace(/\b(launch|build|ramp|start|expand|reduce|deploy|introduce|invest|produce)\s+(ed|ing)\b/gi, "$1$2")
    .replace(/\bplan\s+s\b/gi, "plans")
    .replace(/\bintend\s+s\b/gi, "intends")
    .replace(/\bexpect\s+s\b/gi, "expects");

const detectActorName = (text: string) => {
  const match = text.match(/\b(Tesla|Company|Management|Board|Team|We)\b/i);
  if (!match) return "Company";
  const actor = match[0];
  if (actor.toLowerCase() === "we" || actor.toLowerCase() === "company") return "Company";
  if (actor.toLowerCase() === "management") return "Management";
  if (actor.toLowerCase() === "board") return "Board";
  if (actor.toLowerCase() === "team") return "Team";
  return actor;
};

const normalizeModal = (verb?: string | null) => {
  if (!verb) return "will";
  if (verb === "plan to" || verb === "plans to") return "plans to";
  if (verb === "intend to" || verb === "intends to") return "intends to";
  if (verb === "expect to" || verb === "expects to") return "expects to";
  if (verb === "scheduled to") return "scheduled to";
  return "will";
};

const findActionVerb = (text: string) => {
  let bestIndex = Number.POSITIVE_INFINITY;
  let bestVerb: string | null = null;
  actionVerbPatterns.forEach((pattern, index) => {
    const match = pattern.exec(text);
    if (match && match.index < bestIndex) {
      bestIndex = match.index;
      bestVerb = ACTION_VERBS[index];
    }
  });
  VERB_SYNONYMS.forEach(({ pattern, canonical }) => {
    const match = pattern.exec(text);
    if (match && match.index < bestIndex) {
      bestIndex = match.index;
      bestVerb = canonical;
    }
  });
  return bestVerb;
};

const stripTimeFromPhrase = (text: string) =>
  text
    .replace(/\bby\b[^,;.]+/gi, "")
    .replace(/\b(?:in|during|through)\s+Q[1-4]\s?20\d{2}\b/gi, "")
    .replace(/\b(?:in|during|through)\s+[12]H\s?20\d{2}\b/gi, "")
    .replace(/\b(?:in|during|through)\s+FY\s?20\d{2}\b/gi, "")
    .replace(/\b(?:in|during|through)\s+20\d{2}\b/gi, "")
    .replace(/\b(?:later this year|later this quarter|next quarter|next year|next month|end of 20\d{2}|by end of 20\d{2})\b/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "");

const enforceTitleLength = (title: string) => {
  if (title.length <= MAX_TITLE_LENGTH) {
    return { title: title.trim(), status: "Ok" as const };
  }
  let trimmed = title.replace(/\s*\([^)]*\)/g, "").trim();
  trimmed = trimmed.replace(/\b(?:in order to|in order for|we expect that|we believe that)\b/gi, "").trim();
  trimmed = trimmed.replace(/\b(?:globally|in all markets|across markets)\b/gi, "").trim();
  trimmed = trimmed.replace(/\s+/g, " ");
  if (trimmed.length <= MAX_TITLE_LENGTH) return { title: trimmed.trim(), status: "Ok" as const };
  const clauseIndex = trimmed.search(/[;,]/);
  if (clauseIndex > 0) {
    trimmed = trimmed.slice(0, clauseIndex).trim();
  }
  if (trimmed.length <= MAX_TITLE_LENGTH) return { title: trimmed.trim(), status: "Ok" as const };
  const subClauseIndex = trimmed.search(/\b(?:which|that)\b/i);
  if (subClauseIndex > 0) {
    trimmed = trimmed.slice(0, subClauseIndex).trim();
  }
  if (trimmed.length <= MAX_TITLE_LENGTH) return { title: trimmed.trim(), status: "Ok" as const };
  return { title: `${trimmed.slice(0, MAX_TITLE_LENGTH - 1).trim()}…`, status: "NeedsRewrite" as const };
};

const extractObjectKey = (text: string) => {
  for (const entry of OBJECT_KEYWORDS) {
    if (entry.pattern.test(text)) return entry.key;
  }
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token));
  return tokens.slice(0, 2).join(" ") || "general";
};

const timeBucketFromCue = (timeCue?: string) => {
  if (!timeCue) return "unknown";
  const qMatch = timeCue.match(/\bQ[1-4]\s?20\d{2}\b/i);
  if (qMatch) return qMatch[0].toUpperCase().replace(/\s+/g, " ");
  const hMatch = timeCue.match(/\b[12]H\s?20\d{2}\b/i);
  if (hMatch) return hMatch[0].match(/\b20\d{2}\b/)?.[0] ?? "unknown";
  const yearMatch = timeCue.match(/\b20\d{2}\b/);
  if (yearMatch) return yearMatch[0];
  return "unknown";
};

const normalizeTokens = (text: string) => {
  const replaced = VERB_SYNONYMS.reduce((acc, entry) => acc.replace(entry.pattern, entry.canonical), text);
  const cleaned = STOP_PHRASES.reduce((acc, phrase) => acc.replace(new RegExp(phrase, "gi"), ""), replaced);
  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      if (STOPWORDS.has(token)) return false;
      if (/^\d+$/.test(token)) return /\b20\d{2}\b/.test(token);
      return true;
    });
};

const jaccardSimilarity = (aTokens: Set<string>, bTokens: Set<string>) => {
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) intersection += 1;
  });
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

const buildMergeReasons = (actionVerb: string, objectKey: string, timeBucket: string, similarity: number) => {
  const reasons: string[] = [];
  if (actionVerb && objectKey) reasons.push("same action+object");
  if (timeBucket !== "unknown") reasons.push("same time cue");
  if (similarity >= 0.72) reasons.push("high text similarity");
  return reasons;
};

const UNIT_REGEX =
  /\b(\$?\d[\d,]*(?:\.\d+)?)(?:\s*)(%|percent|bps|bp|GWh|MWh|kWh|GW|MW|million|billion|thousand|USD|usd|dollars?)\b/gi;

const DOLLAR_REGEX = /\$\d[\d,]*(?:\.\d+)?/g;

const normalizeNumber = (value: string) => Number(value.replace(/[$,]/g, ""));

const formatUnitDisplay = (rawNumber: string, unit: string) => {
  if (unit === "%" || unit.toLowerCase() === "percent") {
    return `${rawNumber.replace(/[$,]/g, "")}%`;
  }
  if (unit.toLowerCase() === "bp" || unit.toLowerCase() === "bps") {
    return `${rawNumber.replace(/[$,]/g, "")} bps`;
  }
  if (unit.toLowerCase() === "usd" || unit.toLowerCase().includes("dollar")) {
    return `$${rawNumber.replace(/[$]/g, "")}`;
  }
  return `${rawNumber.replace(/[$]/g, "")} ${unit}`;
};

const buildNumberUnitMap = (text: string) => {
  const map = new Map<string, string>();
  UNIT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  while ((match = UNIT_REGEX.exec(text)) !== null) {
    const rawNumber = match[1];
    const unit = match[2];
    const key = normalizeNumber(rawNumber).toString();
    if (!map.has(key)) {
      map.set(key, formatUnitDisplay(rawNumber, unit));
    }
  }
  const dollarMatches = text.match(DOLLAR_REGEX) ?? [];
  dollarMatches.forEach((raw) => {
    const key = normalizeNumber(raw).toString();
    if (!map.has(key)) {
      map.set(key, raw);
    }
  });
  return map;
};

const injectUnitsIntoTitle = (title: string, sourceText: string) => {
  const numberUnitMap = buildNumberUnitMap(sourceText);
  let missingUnit = false;
  const updatedTitle = title.replace(/(\$?\d[\d,]*(?:\.\d+)?)/g, (match, rawNumber, offset, full) => {
    if (match.includes("$")) return match;
    const numberValue = normalizeNumber(rawNumber);
    if (!Number.isFinite(numberValue)) return match;
    if (numberValue >= 1900 && numberValue <= 2100) return match;
    const after = full.slice(offset + match.length);
    if (/\s?(%|bps|bp|GWh|MWh|kWh|GW|MW|million|billion|thousand)\b/i.test(after)) {
      return match;
    }
    const key = numberValue.toString();
    const unitDisplay = numberUnitMap.get(key);
    if (unitDisplay) {
      return unitDisplay;
    }
    missingUnit = true;
    return `${match} (~)`;
  });
  return { title: updatedTitle, missingUnit };
};

const hasBrokenTokens = (text: string) =>
  /\b(launch|build|ramp|start|expand|reduce|deploy|introduce|invest|produce)\s+(ed|ing)\b/i.test(text) ||
  /\b[a-z]{3,}\s+(?:m|n|r|l|t)ents\b/i.test(text) ||
  /\b[a-z]{3,}\s+ies\b/i.test(text);

const hasGenericObject = (objectText: string) =>
  /\b(it|this|that|initiative|strategy|plan|program|project)\b/i.test(objectText) || objectText.length < 12;

const canonicalizeDecision = (candidate: Candidate): CanonicalUnit => {
  const cleanedRaw = cleanText(candidate.rawText);
  const cleaned = repairTokenization(stripFillerPhrases(stripBoilerplatePrefix(cleanedRaw)));
  const actor = detectActorName(cleaned);
  const commitment = candidate.gate.commitmentVerb ?? detectCommitmentVerb(cleaned).verb;
  const modal = normalizeModal(commitment);
  const actionVerb = findActionVerb(cleaned) ?? commitment ?? "commit";
  const verbIndex = cleaned.toLowerCase().indexOf(actionVerb.toLowerCase());
  const afterVerb = verbIndex >= 0 ? cleaned.slice(verbIndex + actionVerb.length) : cleaned;
  const withoutLeadingTo = afterVerb.replace(/^\s*(?:to\s+)?/i, "");
  const objectPhrase = stripSubordinateClauses(stripTimeFromPhrase(withoutLeadingTo));
  const baseObject = objectPhrase.trim();
  const baseTitle = baseObject ? `${actor} ${modal} ${actionVerb} ${baseObject}` : `${actor} ${modal} ${actionVerb}`;
  const timeCue = pickBestTimeCue(candidate.dateMentions ?? [], cleanedRaw);
  const timeHintRaw = timeCue?.raw ?? null;
  const withTime = timeHintRaw ? `${baseTitle} (${timeHintRaw})` : baseTitle;
  const sourceText = cleanText(candidate.contextText ?? candidate.rawText);
  const unitInjection = injectUnitsIntoTitle(withTime, sourceText);
  const enforced = enforceTitleLength(unitInjection.title);
  const missingStructure = !actionVerb || !baseObject;

  const needsRewrite =
    enforced.status === "NeedsRewrite" ||
    unitInjection.missingUnit ||
    hasBrokenTokens(baseTitle) ||
    missingStructure ||
    hasGenericObject(baseObject);

  const updatedGate =
    needsRewrite && candidate.gate.bin === "Decision" && candidate.gate.optionalityScore < 0.7
      ? {
          ...candidate.gate,
          bin: "MaybeDecision" as const,
          reasonsExcluded: [...candidate.gate.reasonsExcluded, "needsRewrite"],
        }
      : candidate.gate;

  const timeBucket = timeBucketFromCue(timeHintRaw ?? undefined);
  const tokens = new Set(normalizeTokens(candidate.rawText));

  return {
    candidate: { ...candidate, gate: updatedGate },
    title: enforced.title,
    titleStatus: needsRewrite ? "NeedsRewrite" : "Ok",
    timeHintRaw,
    timingNormalized: normalizeTimingFromHint(timeHintRaw),
    timeCue,
    actionVerb,
    objectKey: extractObjectKey(baseTitle),
    timeBucket,
    tokens,
  };
};

const pickBestTitle = (units: CanonicalUnit[]) => {
  const hasTime = units.some((unit) => Boolean(unit.timeHintRaw));
  return units
    .slice()
    .sort((a, b) => {
      const scoreA =
        (a.candidate.gate.bin === "Decision" ? 1 : 0) +
        a.candidate.gate.optionalityScore +
        (a.titleStatus === "Ok" ? 0.2 : 0) +
        (hasTime && a.timeHintRaw ? 0.2 : 0);
      const scoreB =
        (b.candidate.gate.bin === "Decision" ? 1 : 0) +
        b.candidate.gate.optionalityScore +
        (b.titleStatus === "Ok" ? 0.2 : 0) +
        (hasTime && b.timeHintRaw ? 0.2 : 0);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.title.length - b.title.length;
    })[0];
};

export const extractCandidates = (textChunks: TextChunk[]): RawCandidate[] => {
  const rawCandidates: RawCandidate[] = [];
  textChunks.forEach((chunk) => {
    const { pageLines, paragraphText } = ingestPageText(chunk.text);
    const sentenceUnits = buildSentenceUnits(paragraphText);
    const units = sentenceUnits.length > 0 ? sentenceUnits : buildLineUnits(pageLines);

    units.forEach((unit, unitIndex) => {
      if (unit.length < 30 || unit.length > 280) return;
      const lineIndex = findLineIndexForUnit(pageLines, unit);
      const contextText = buildContextText(pageLines, unit, lineIndex);
      const sectionHint = findSectionHint(pageLines, lineIndex);
      const dateMentions = extractDateMentions(unit);
      const evidence: EvidenceAnchor = {
        docId: chunk.docId,
        fileName: chunk.fileName,
        page: chunk.pageNumber,
        excerpt: unit,
        contextText,
      };

      rawCandidates.push({
        id: `${chunk.docId}-p${chunk.pageNumber}-u${unitIndex}`,
        docId: chunk.docId,
        page: chunk.pageNumber,
        rawText: unit,
        contextText,
        sectionHint,
        knowsItIsTableNoise: looksLikeTableRow(unit),
        extractionScore: clamp(1 - digitRatio(unit)),
        dateMentions,
        evidence: [evidence],
      });
    });
  });
  return rawCandidates;
};

export const gateCandidates = (rawCandidates: RawCandidate[]) => {
  const keep: Candidate[] = [];
  const maybe: Candidate[] = [];
  const reject: Candidate[] = [];

  rawCandidates.forEach((candidate) => {
    const { bin, gate } = scoreGate(candidate);
    const entry: Candidate = { ...candidate, gate };
    if (bin === "Decision") {
      keep.push(entry);
    } else if (bin === "MaybeDecision") {
      maybe.push(entry);
    } else {
      reject.push(entry);
    }
  });

  return { keep, maybe, reject };
};

export const canonicalize = (candidate: Candidate): CanonicalDecision => {
  const unit = canonicalizeDecision(candidate);
  return {
    id: `canon-${candidate.id}`,
    docId: candidate.docId,
    title: unit.title,
    titleStatus: unit.titleStatus,
    timeHintRaw: unit.timeHintRaw ?? null,
    timingNormalized: unit.timingNormalized,
    gate: unit.candidate.gate,
    summary: undefined,
    domain: undefined,
    date: unit.timeCue
      ? {
          raw: unit.timeCue.raw,
          normalized: undefined,
          confidence: unit.timeCue.confidence,
        }
      : undefined,
    impact: 5,
    cost: 5,
    risk: 5,
    urgency: 5,
    confidence: 5,
    evidence: candidate.evidence,
    sources: {
      candidateIds: [candidate.id],
      mergeConfidence: 1,
      mergeReason: ["single candidate"],
    },
    tags: undefined,
  };
};

export const dedupe = (canonicals: CanonicalDecision[]): CanonicalDecision[] => {
  if (canonicals.length === 0) return [];
  const units: CanonicalUnit[] = canonicals.map((canonical) => {
    const candidate: Candidate = {
      id: canonical.sources.candidateIds[0] ?? canonical.id,
      docId: canonical.docId,
      page: canonical.evidence[0]?.page ?? 0,
      rawText: canonical.title,
      contextText: canonical.evidence[0]?.contextText,
      sectionHint: undefined,
      knowsItIsTableNoise: false,
      extractionScore: 0.5,
      dateMentions: canonical.timeHintRaw ? [canonical.timeHintRaw] : [],
      evidence: canonical.evidence,
      gate: canonical.gate ?? {
        bin: "Decision",
        optionalityScore: 0.6,
        commitmentVerb: null,
        commitmentStrength: 0,
        constraintSignals: {
          time: 0,
          capital: 0,
          exposure: 0,
          dependency: 0,
          reversalCost: 0,
          dateMentions: [],
        },
        reasonsIncluded: [],
        reasonsExcluded: [],
      },
    };
    const actionVerb = findActionVerb(canonical.title) ?? "commit";
    const objectKey = extractObjectKey(canonical.title);
    return {
      candidate,
      title: canonical.title,
      titleStatus: canonical.titleStatus ?? "Ok",
      timeHintRaw: canonical.timeHintRaw ?? null,
      timingNormalized: canonical.timingNormalized,
      timeCue: canonical.date?.raw ? { raw: canonical.date.raw, confidence: canonical.date.confidence } : undefined,
      actionVerb,
      objectKey,
      timeBucket: timeBucketFromCue(canonical.timeHintRaw ?? undefined),
      tokens: new Set(normalizeTokens(canonical.title)),
    };
  });

  const grouped = new Map<string, CanonicalUnit[]>();
  units.forEach((unit) => {
    const key = `${unit.actionVerb}|${unit.objectKey}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(unit);
  });

  const deduped: CanonicalDecision[] = [];
  grouped.forEach((group) => {
    const clusters: CanonicalUnit[][] = [];
    group.forEach((unit) => {
      let merged = false;
      for (const cluster of clusters) {
        const representative = cluster[0];
        const similarity = jaccardSimilarity(representative.tokens, unit.tokens);
        const shouldMerge = similarity >= 0.82 || (similarity >= 0.72 && representative.objectKey === unit.objectKey);
        if (shouldMerge) {
          cluster.push(unit);
          merged = true;
          break;
        }
      }
      if (!merged) clusters.push([unit]);
    });

    const suggestedMergeMap = new Map<string, string[]>();
    clusters.forEach((cluster, index) => {
      clusters.slice(index + 1).forEach((other) => {
        const similarity = jaccardSimilarity(cluster[0].tokens, other[0].tokens);
        if (similarity >= 0.72 && similarity < 0.82) {
          const leftId = `canon-${cluster[0].candidate.id}`;
          const rightId = `canon-${other[0].candidate.id}`;
          suggestedMergeMap.set(leftId, [...(suggestedMergeMap.get(leftId) ?? []), rightId]);
          suggestedMergeMap.set(rightId, [...(suggestedMergeMap.get(rightId) ?? []), leftId]);
        }
      });
    });

    clusters.forEach((cluster) => {
      const best = pickBestTitle(cluster);
      const candidateIds = cluster.map((item) => item.candidate.id);
      const evidenceMap = new Map<string, EvidenceAnchor>();
      cluster.forEach((item) => {
        item.candidate.evidence.forEach((anchor) => {
          const key = `${anchor.docId}-${anchor.page}-${anchor.excerpt}`;
          if (!evidenceMap.has(key)) evidenceMap.set(key, anchor);
        });
      });
      const similarities = cluster.slice(1).map((item) => jaccardSimilarity(best.tokens, item.tokens));
      const avgSimilarity =
        similarities.length > 0 ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length : 1;
      const hasMerge = cluster.length > 1;
      const mergeConfidence = hasMerge ? clamp(avgSimilarity + (best.timeBucket !== "unknown" ? 0.1 : 0)) : 1;
      const canonicalId = `canon-${best.candidate.id}`;
      const timeChoice = cluster
        .map((item) => item.timeCue)
        .filter((cue): cue is { raw: string; confidence: number } => Boolean(cue))
        .sort((a, b) => b.confidence - a.confidence)[0];

      deduped.push({
        id: canonicalId,
        docId: best.candidate.docId,
        title: best.title,
        titleStatus: best.titleStatus,
        timeHintRaw: best.timeHintRaw ?? null,
        timingNormalized: best.timingNormalized,
        gate: best.candidate.gate,
        summary: undefined,
        domain: undefined,
        date: timeChoice
          ? {
              raw: timeChoice.raw,
              normalized: undefined,
              confidence: timeChoice.confidence,
            }
          : undefined,
        impact: 5,
        cost: 5,
        risk: 5,
        urgency: 5,
        confidence: 5,
        evidence: Array.from(evidenceMap.values()),
        sources: {
          candidateIds,
          mergeConfidence,
          mergeReason: hasMerge
            ? buildMergeReasons(best.actionVerb, best.objectKey, best.timeBucket, avgSimilarity)
            : ["single candidate"],
          suggestedMergeIds: suggestedMergeMap.get(canonicalId),
        },
        tags: undefined,
      });
    });
  });

  return deduped;
};

export const buildRawCandidates = (docs: UploadedDoc[]): RawCandidate[] => {
  const chunks: TextChunk[] = docs.flatMap((doc) =>
    doc.pages.map((page) => ({
      docId: doc.id,
      fileName: doc.fileName,
      pageNumber: page.pageNumber,
      text: page.text,
    })),
  );
  return extractCandidates(chunks);
};

export const buildCanonicalDecisions = (
  rawCandidates: RawCandidate[],
): { canonicals: CanonicalDecision[]; diagnostics: DecisionGateDiagnostics } => {
  const gated = gateCandidates(rawCandidates);
  const canonicalDrafts = [...gated.keep, ...gated.maybe].map((candidate) => canonicalize(candidate));
  const canonicals = dedupe(canonicalDrafts);

  const diagnostics: DecisionGateDiagnostics = {
    total: rawCandidates.length,
    byBin: {
      Decision: gated.keep.length,
      MaybeDecision: gated.maybe.length,
      EvidenceOnly: 0,
      Rejected: gated.reject.length,
    },
    candidates: [...gated.keep, ...gated.maybe, ...gated.reject].map((entry) => ({
      id: entry.id,
      rawText: entry.rawText,
      bin: entry.gate.bin,
      optionalityScore: entry.gate.optionalityScore,
      reasonsIncluded: entry.gate.reasonsIncluded,
      reasonsExcluded: entry.gate.reasonsExcluded,
    })),
    evidenceOnlySamples: [],
    stages: {
      extracted: rawCandidates.length,
      kept: gated.keep.length,
      maybe: gated.maybe.length,
      rejected: gated.reject.length,
      deduped: canonicals.length,
    },
  };

  return { canonicals, diagnostics };
};
