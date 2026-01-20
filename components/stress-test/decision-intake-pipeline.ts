import type {
  CanonicalDecision,
  DecisionGateDiagnostics,
  DecisionQualityGate,
  EvidenceAnchor,
  RawCandidate,
  UploadedDoc,
} from "@/components/stress-test/decision-intake-types";
import { compileDecisionObject } from "@/lib/decisionCompiler";
import type { ConstraintTime } from "@/types/decisionCompiler";

type PageTextData = {
  pageTextRaw: string;
  pageLines: string[];
  paragraphText: string;
};

const COMMITMENT_VERBS = [
  "will",
  "plan to",
  "plans to",
  "expects to",
  "expect to",
  "target",
  "targets",
  "aims to",
  "aim to",
  "scheduled to",
  "begin",
  "ramp",
  "launch",
  "start production",
  "approve",
  "approved",
  "build",
  "expand",
  "reduce",
  "increase",
  "start",
  "stop",
  "delay",
  "enter",
  "exit",
  "invest",
  "hire",
  "deploy",
  "open",
  "discontinue",
  "acquire",
  "divest",
];

const METRIC_OUTCOME_TERMS = [
  "yoy",
  "qoq",
  "ebitda",
  "gross margin",
  "operating income",
  "operating profit",
  "net income",
  "revenue",
  "earnings per share",
  "eps",
  "cash flow",
  "operating cash flow",
  "free cash flow",
  "deliveries",
  "vehicle deliveries",
  "profit",
  "margin",
  "loss",
  "financial summary",
];

const WEAK_COMMITMENT_TERMS = ["may", "could", "might", "considering"];

const ACTION_TERMS = [
  "build",
  "launch",
  "ramp",
  "increase",
  "reduce",
  "expand",
  "start",
  "stop",
  "delay",
  "enter",
  "exit",
  "deploy",
  "open",
  "close",
  "restructure",
  "hire",
  "layoff",
  "capex",
  "headcount",
];

const FINANCIAL_FIELD_NAMES = [
  "operating cash flow",
  "net income attributable",
  "gross margin",
  "revenue",
  "earnings per share",
  "eps",
  "gaap",
  "non-gaap",
  "cash flows",
  "balance sheet",
  "income statement",
];

const DATE_PATTERNS = [
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{2,4})?\b/gi,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  /\bQ[1-4]\s?20\d{2}\b/gi,
  /\b[12]H\s?20\d{2}\b/gi,
  /\bFY\s?20\d{2}\b/gi,
  /\b(?:later this year|later this quarter|next quarter|next year|next month)\b/gi,
];

const STRONG_VERBS = [
  "launch",
  "ramp",
  "begin",
  "start production",
  "build",
  "reduce",
  "expand",
  "increase",
  "start",
  "stop",
  "delay",
  "enter",
  "exit",
  "invest",
  "hire",
  "deploy",
  "open",
  "close",
  "restructure",
  "approve",
  "produce",
];

const VERB_SYNONYMS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\broll\s?out\b/i, canonical: "launch" },
  { pattern: /\brelease\b/i, canonical: "launch" },
  { pattern: /\bintroduce\b/i, canonical: "launch" },
  { pattern: /\bscale(?:\s?up)?\b/i, canonical: "ramp" },
  { pattern: /\bkick\s?off\b/i, canonical: "start" },
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
  { pattern: /\bpricing\b/i, key: "pricing" },
  { pattern: /\bprices?\b/i, key: "pricing" },
  { pattern: /\benergy storage\b/i, key: "energy storage" },
  { pattern: /\bfull self-driving\b/i, key: "fsd (supervised)" },
  { pattern: /\bfsd\b/i, key: "fsd" },
  { pattern: /\bcapacity\b/i, key: "capacity" },
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

const DEFAULT_SCORE = 5;
const MAX_TITLE_LENGTH = 160;

const cleanLine = (line: string) => line.replace(/\s+/g, " ").trim();

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

const mostlyNumbersOrSymbols = (text: string) => {
  const letters = (text.match(/[a-z]/gi) ?? []).length;
  if (letters === 0) return true;
  const nonLetters = text.length - letters;
  return nonLetters / text.length > 0.6 && countDigits(text) >= 4;
};

const isAllCapsHeader = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  return trimmed === trimmed.toUpperCase() && /^[A-Z\s&-]+$/.test(trimmed);
};

const looksLikeTableRow = (text: string) => {
  const commaCount = (text.match(/,/g) ?? []).length;
  const separatorCount = (text.match(/[|•·]/g) ?? []).length;
  return (commaCount >= 4 && digitRatio(text) > 0.18) || separatorCount >= 4;
};

const containsFinancialFieldsOnly = (text: string) => {
  const lower = text.toLowerCase();
  const hasField = FINANCIAL_FIELD_NAMES.some((field) => lower.includes(field));
  if (!hasField) return false;
  const hasVerb = COMMITMENT_VERBS.some((verb) => lower.includes(verb));
  return !hasVerb;
};

const isTableNoise = (text: string) => {
  if (mostlyNumbersOrSymbols(text)) return true;
  if (isAllCapsHeader(text)) return true;
  if (looksLikeTableRow(text)) return true;
  if (containsFinancialFieldsOnly(text)) return true;
  return false;
};

const isMetricOutcome = (text: string) => {
  const lower = text.toLowerCase();
  const hasMetric = METRIC_OUTCOME_TERMS.some((term) => lower.includes(term)) || /\b(yoy|qoq)\b/i.test(text);
  if (!hasMetric) return false;
  const hasCommitment = detectCommitmentVerb(text).strength > 0;
  return !hasCommitment;
};

const detectCommitmentVerb = (text: string) => {
  const lowered = text.toLowerCase();
  const weakModalPresent = WEAK_COMMITMENT_TERMS.some((term) => lowered.includes(term));
  let bestIndex = Number.POSITIVE_INFINITY;
  let bestVerb: string | null = null;
  let strength = 0;

  const registerMatch = (verb: string, index: number, baseStrength: number) => {
    if (index < 0) return;
    if (index < bestIndex) {
      bestIndex = index;
      bestVerb = verb;
      strength = baseStrength;
    }
  };

  STRONG_VERBS.forEach((verb) => {
    const index = lowered.indexOf(verb);
    registerMatch(verb, index, 1);
  });

  VERB_SYNONYMS.forEach(({ pattern, canonical }) => {
    const match = pattern.exec(text);
    if (match) {
      registerMatch(canonical, match.index, 1);
    }
  });

  COMMITMENT_VERBS.forEach((verb) => {
    const index = lowered.indexOf(verb);
    if (index >= 0 && bestVerb === null) {
      bestVerb = verb;
      strength = 0.8;
      bestIndex = index;
    }
  });

  if (weakModalPresent && strength > 0) {
    strength = Math.min(strength, 0.45);
  }

  return {
    verb: bestVerb,
    strength,
  };
};

const detectConstraintSignals = (text: string) => {
  const lower = text.toLowerCase();
  const dateMentions = extractDateMentions(text);
  const time =
    dateMentions.length > 0 ||
    /\b(later this year|later this quarter|next quarter|next year|next month|in \d{4}|by \w+)/i.test(text)
      ? 1
      : 0;
  const capital = /\b(factory|capex|production|hiring|hire|headcount|pricing|spending|ramp|build|expand|invest)\b/i.test(
    text,
  )
    ? 1
    : 0;
  const exposure = /\b(guidance|outlook|expects|expect|forecast|target|will)\b/i.test(text) ? 1 : 0;
  const dependency = /\b(requires|in order to|dependent on|contingent on|after|before|once)\b/i.test(text) ? 1 : 0;
  const reversalCost =
    /\b(completed|construction finished|signed|launched|begun|started production|underway|already)\b/i.test(lower)
      ? 1
      : 0;

  return {
    time,
    capital,
    exposure,
    dependency,
    reversalCost,
    dateMentions,
  };
};

const optionalityScoreFromSignals = (commitmentStrength: number, signals: ReturnType<typeof detectConstraintSignals>) =>
  clamp(
    0.35 * commitmentStrength +
      0.2 * signals.time +
      0.2 * signals.capital +
      0.1 * signals.exposure +
      0.1 * signals.dependency +
      0.1 * signals.reversalCost,
  );

const hasCommitmentVerb = (text: string) => detectCommitmentVerb(text).strength > 0;

const hasActionObject = (text: string) => ACTION_TERMS.some((term) => text.toLowerCase().includes(term));

const hasTimeConstraint = (text: string) =>
  /\b(by|before|later this year|later this quarter|next quarter|next year|q[1-4]|[12]h\s?20\d{2}|fy\s?20\d{2})\b/i.test(
    text,
  );

const isDisclaimer = (text: string) => /\b(may|might|could)\b/i.test(text);

const isPurePastFact = (text: string) =>
  /\b(was|were|reported|delivered|achieved|completed|grew|declined|decreased|increased)\b/i.test(text) &&
  !hasCommitmentVerb(text);

const extractDateMentions = (text: string) => {
  const matches = DATE_PATTERNS.flatMap((pattern) => text.match(pattern) ?? []);
  return Array.from(new Set(matches));
};

const findActionVerb = (text: string) => {
  const lowered = text.toLowerCase();
  let bestIndex = Number.POSITIVE_INFINITY;
  let bestVerb: string | null = null;
  STRONG_VERBS.forEach((verb) => {
    const index = lowered.indexOf(verb);
    if (index >= 0 && index < bestIndex) {
      bestIndex = index;
      bestVerb = verb;
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
  if (/\b(?:later this year|later this quarter|next quarter|next year|next month)\b/i.test(hint)) {
    return { precision: "relative" as const };
  }
  return { precision: "unknown" as const };
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

const timeBucketFromConstraint = (constraintTime: ConstraintTime | null) => {
  if (!constraintTime?.normalized) return "unknown";
  const normalized = constraintTime.normalized;
  if (normalized.type === "quarter") return `Q${normalized.quarter} ${normalized.year}`;
  if (normalized.type === "half") return `${normalized.half}H ${normalized.year}`;
  if (normalized.type === "fiscalYear") return `FY${normalized.year}`;
  if (normalized.type === "year") return `${normalized.year}`;
  if (normalized.type === "date") return normalized.value;
  if (normalized.type === "relative") return normalized.label;
  return "unknown";
};

const normalizeTokens = (text: string) => {
  const replaced = VERB_SYNONYMS.reduce((acc, entry) => acc.replace(entry.pattern, entry.canonical), text);
  return replaced
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

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const scoreCandidate = (text: string) => {
  let score = 0;
  const tableNoise = isTableNoise(text);
  const tooNumeric = digitRatio(text) > 0.28 || containsFinancialFieldsOnly(text);

  if (hasCommitmentVerb(text)) score += 0.35;
  if (hasTimeConstraint(text)) score += 0.2;
  if (hasActionObject(text)) score += 0.2;
  if (tableNoise) score -= 0.25;
  if (tooNumeric) score -= 0.15;
  if (isDisclaimer(text)) score -= 0.1;
  if (isPurePastFact(text)) score -= 0.2;

  score = clamp(score);
  if (tableNoise) score = Math.min(score, 0.35);
  return { score, tableNoise };
};

const runDecisionQualityGate = (candidate: RawCandidate, decision: ReturnType<typeof compileDecisionObject>): DecisionQualityGate => {
  const { rawText } = candidate;
  const reasonsIncluded: string[] = [];
  const reasonsExcluded: string[] = [];
  const tableNoise = candidate.knowsItIsTableNoise;
  const metricOutcome = isMetricOutcome(rawText);
  const commitment = detectCommitmentVerb(rawText);
  const signals = detectConstraintSignals(rawText);
  const optionalityScore = optionalityScoreFromSignals(commitment.strength, signals);

  if (commitment.verb) reasonsIncluded.push(`commitmentVerb:${commitment.verb}`);
  if (signals.time) reasonsIncluded.push(`time:${signals.dateMentions[0] ?? "hint"}`);
  if (signals.capital) reasonsIncluded.push("capital");
  if (signals.exposure) reasonsIncluded.push("exposure");
  if (signals.dependency) reasonsIncluded.push("dependency");
  if (signals.reversalCost) reasonsIncluded.push("reversalCost");

  if (tableNoise) reasonsExcluded.push("tableNoise");
  if (metricOutcome) reasonsExcluded.push("metricOutcome");
  if (!commitment.verb) reasonsExcluded.push("noCommitmentVerb");
  if (optionalityScore < 0.45) reasonsExcluded.push("lowOptionalityScore");

  const futureActionImplied = signals.time > 0 || signals.capital > 0;
  const passesCommitmentGate = commitment.strength > 0 || (signals.reversalCost > 0 && futureActionImplied);

  let bin: DecisionQualityGate["bin"] = "Rejected";
  if (decision.triage === "KEEP") {
    bin = "Decision";
  } else if (decision.triage === "MAYBE") {
    bin = "MaybeDecision";
  } else if (decision.triage === "DROP") {
    bin = decision.triage_reason.includes("state/reporting") ? "EvidenceOnly" : "Rejected";
  } else if (metricOutcome) {
    bin = "EvidenceOnly";
  } else if (!tableNoise && passesCommitmentGate) {
    if (optionalityScore >= 0.55) {
      bin = "Decision";
    } else if (optionalityScore >= 0.45) {
      bin = "MaybeDecision";
    }
  }

  return {
    bin,
    optionalityScore,
    commitmentVerb: commitment.verb,
    commitmentStrength: commitment.strength,
    constraintSignals: signals,
    reasonsIncluded,
    reasonsExcluded,
    triage: decision.triage,
    triageReason: decision.triage_reason,
  };
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

export const buildRawCandidates = (docs: UploadedDoc[]): RawCandidate[] => {
  const rawCandidates: RawCandidate[] = [];
  docs.forEach((doc) => {
    doc.pages.forEach((page) => {
      const { pageLines, paragraphText } = ingestPageText(page.text);
      const sentenceUnits = buildSentenceUnits(paragraphText);
      const units = sentenceUnits.length > 0 ? sentenceUnits : buildLineUnits(pageLines);

      units.forEach((unit, unitIndex) => {
        if (unit.length < 30 || unit.length > 280) return;
        const { score, tableNoise } = scoreCandidate(unit);
        const lineIndex = findLineIndexForUnit(pageLines, unit);
        const contextText = buildContextText(pageLines, unit, lineIndex);
        const sectionHint = findSectionHint(pageLines, lineIndex);
        const dateMentions = extractDateMentions(unit);
        const evidence: EvidenceAnchor = {
          docId: doc.id,
          fileName: doc.fileName,
          page: page.pageNumber,
          excerpt: unit,
        };

        rawCandidates.push({
          id: `${doc.id}-p${page.pageNumber}-u${unitIndex}`,
          docId: doc.id,
          page: page.pageNumber,
          rawText: unit,
          contextText,
          sectionHint,
          knowsItIsTableNoise: tableNoise,
          extractionScore: score,
          dateMentions,
          evidence: [evidence],
        });
      });
    });
  });
  return rawCandidates;
};

export const buildCanonicalDecisions = (
  rawCandidates: RawCandidate[],
): { canonicals: CanonicalDecision[]; diagnostics: DecisionGateDiagnostics } => {
  const gatedCandidates = rawCandidates.map((candidate) => {
    const compiledDecision = compileDecisionObject({
      text: candidate.rawText,
      evidenceAnchors: candidate.evidence,
      tableNoise: candidate.knowsItIsTableNoise,
    });
    const gate = runDecisionQualityGate(candidate, compiledDecision);
    return { candidate, gate, decision: compiledDecision };
  });

  const diagnostics: DecisionGateDiagnostics = {
    total: gatedCandidates.length,
    byBin: {
      Decision: gatedCandidates.filter((entry) => entry.gate.bin === "Decision").length,
      MaybeDecision: gatedCandidates.filter((entry) => entry.gate.bin === "MaybeDecision").length,
      EvidenceOnly: gatedCandidates.filter((entry) => entry.gate.bin === "EvidenceOnly").length,
      Rejected: gatedCandidates.filter((entry) => entry.gate.bin === "Rejected").length,
    },
    candidates: gatedCandidates.map((entry) => ({
      id: entry.candidate.id,
      rawText: entry.candidate.rawText,
      bin: entry.gate.bin,
      optionalityScore: entry.gate.optionalityScore,
      reasonsIncluded: entry.gate.reasonsIncluded,
      reasonsExcluded: entry.gate.reasonsExcluded,
    })),
    evidenceOnlySamples: gatedCandidates
      .filter((entry) => entry.gate.bin === "EvidenceOnly")
      .slice(0, 4)
      .map((entry) => ({
        id: entry.candidate.id,
        rawText: entry.candidate.rawText,
        reasonsExcluded: entry.gate.reasonsExcluded,
      })),
  };

  const candidateUnits = gatedCandidates
    .filter((entry) => entry.gate.bin === "Decision" || entry.gate.bin === "MaybeDecision")
    .map(({ candidate, gate, decision }) => {
      const actionVerb = decision.action || findActionVerb(decision.canonical_text) || gate.commitmentVerb || "commit";
      const objectKey = extractObjectKey(decision.object || decision.canonical_text);
      const timeBucket = timeBucketFromConstraint(decision.constraint_time ?? null);
      const tokens = new Set(normalizeTokens(decision.canonical_text));
      return {
        candidate,
        gate,
        title: decision.canonical_text,
        titleStatus: decision.canonical_text.length > MAX_TITLE_LENGTH ? "NeedsRewrite" : "Ok",
        timeHintRaw: decision.constraint_time?.raw ?? null,
        timingNormalized: decision.constraint_time?.normalized
          ? normalizeTimingFromHint(decision.constraint_time.raw)
          : normalizeTimingFromHint(undefined),
        actionVerb,
        objectKey,
        timeBucket,
        timeCue: decision.constraint_time?.raw ? { raw: decision.constraint_time.raw, confidence: 0.8 } : undefined,
        tokens,
        decision,
      };
    });

  const grouped = new Map<string, typeof candidateUnits>();
  candidateUnits.forEach((unit) => {
    const key = `${unit.actionVerb}|${unit.objectKey}|${unit.timeBucket !== "unknown" ? unit.timeBucket : ""}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(unit);
  });

  const canonicals: CanonicalDecision[] = [];
  grouped.forEach((units) => {
    const clusters: Array<typeof units> = [];
    units.forEach((unit) => {
      let merged = false;
      for (const cluster of clusters) {
        const representative = cluster[0];
        const similarity = jaccardSimilarity(representative.tokens, unit.tokens);
        if (similarity >= 0.72) {
          cluster.push(unit);
          merged = true;
          break;
        }
      }
      if (!merged) clusters.push([unit]);
    });

    const clusterMeta = clusters.map((cluster) => {
      const sortedByScore = [...cluster].sort(
        (a, b) =>
          Number(Boolean(b.decision.constraint_time)) - Number(Boolean(a.decision.constraint_time)) ||
          a.title.length - b.title.length ||
          b.decision.confidence_of_extraction - a.decision.confidence_of_extraction ||
          b.gate.optionalityScore - a.gate.optionalityScore ||
          b.candidate.extractionScore - a.candidate.extractionScore,
      );
      const best = sortedByScore[0];
      return {
        cluster,
        best,
        representative: cluster[0],
        canonicalId: best.decision.id,
      };
    });

    const suggestedMergeMap = new Map<string, string[]>();
    clusterMeta.forEach((entry, index) => {
      clusterMeta.slice(index + 1).forEach((other) => {
        const similarity = jaccardSimilarity(entry.representative.tokens, other.representative.tokens);
        if (similarity >= 0.58 && similarity < 0.72) {
          suggestedMergeMap.set(entry.canonicalId, [
            ...(suggestedMergeMap.get(entry.canonicalId) ?? []),
            other.canonicalId,
          ]);
          suggestedMergeMap.set(other.canonicalId, [
            ...(suggestedMergeMap.get(other.canonicalId) ?? []),
            entry.canonicalId,
          ]);
        }
      });
    });

    clusterMeta.forEach(({ cluster, best, canonicalId }) => {
      const candidateIds = cluster.map((item) => item.candidate.id);
      const evidenceMap = new Map<string, EvidenceAnchor>();
      cluster.forEach((item) => {
        item.candidate.evidence.forEach((anchor) => {
          const key = `${anchor.page}-${anchor.excerpt}`;
          if (!evidenceMap.has(key)) evidenceMap.set(key, anchor);
        });
      });
      const timeChoice = cluster
        .map((item) => item.timeCue)
        .filter((cue): cue is { raw: string; confidence: number } => Boolean(cue))
        .sort((a, b) => b.confidence - a.confidence)[0];
      const similarities = cluster.slice(1).map((item) => jaccardSimilarity(best.tokens, item.tokens));
      const avgSimilarity =
        similarities.length > 0 ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length : 1;
      const hasMerge = cluster.length > 1;
      const mergeConfidence = hasMerge ? clamp(avgSimilarity + (best.timeBucket !== "unknown" ? 0.1 : 0)) : 1;
      canonicals.push({
        id: canonicalId,
        docId: best.candidate.docId,
        title: best.title,
        decision: best.decision,
        titleStatus: best.titleStatus,
        timeHintRaw: best.timeHintRaw ?? null,
        timingNormalized: best.timingNormalized,
        gate: best.gate,
        summary: undefined,
        domain: undefined,
        date: timeChoice
          ? {
              raw: timeChoice.raw,
              normalized: undefined,
              confidence: timeChoice.confidence,
            }
          : undefined,
        impact: DEFAULT_SCORE,
        cost: DEFAULT_SCORE,
        risk: DEFAULT_SCORE,
        urgency: DEFAULT_SCORE,
        confidence: DEFAULT_SCORE,
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

  return { canonicals, diagnostics };
};
