import type { CanonicalDecision, EvidenceAnchor, RawCandidate, UploadedDoc } from "@/components/stress-test/decision-intake-types";

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
  "aims to",
  "aim to",
  "scheduled to",
  "begin",
  "ramp",
  "launch",
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
];

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
];

const BOILERPLATE_PREFIXES: RegExp[] = [
  /^(?:the\s+)?company\s+(?:will|expects to|expect to|plans to|plan to|aims to|aim to|intends to|intend to)\s+/i,
  /^tesla\s+(?:will|expects to|expect to|plans to|plan to|aims to|aim to|intends to|intend to)\s+/i,
  /^(?:we|management|board|team)\s+(?:will|expect to|expects to|plan to|plans to|aim to|aims to|intend to|intends to)\s+/i,
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
const MAX_TITLE_LENGTH = 90;

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

const hasCommitmentVerb = (text: string) =>
  COMMITMENT_VERBS.some((verb) => text.toLowerCase().includes(verb));

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

const pickBestTimeCue = (dateMentions: string[], text: string) => {
  const candidates = dateMentions.length > 0 ? dateMentions : extractDateMentions(text);
  if (candidates.length === 0) return undefined;
  const normalized = candidates.map((value) => value.trim());
  const scoreTimeCue = (cue: string) => {
    if (/\bQ[1-4]\s?20\d{2}\b/i.test(cue)) return 5;
    if (/\b[12]H\s?20\d{2}\b/i.test(cue)) return 4;
    if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i.test(cue)) return 4;
    if (/\bFY\s?20\d{2}\b/i.test(cue)) return 3;
    if (/\b20\d{2}\b/.test(cue)) return 2;
    return 1;
  };
  const best = normalized.reduce((acc, cue) => (scoreTimeCue(cue) > scoreTimeCue(acc) ? cue : acc), normalized[0]);
  const confidence = Math.min(1, 0.5 + scoreTimeCue(best) * 0.1);
  return { raw: best, confidence };
};

const normalizeProductNouns = (text: string) =>
  text
    .replace(/\bfull self-driving\s*\(supervised\)/gi, "FSD (Supervised)")
    .replace(/\bfull self-driving\b/gi, "FSD")
    .replace(/\bmegafactory shanghai\b/gi, "Megafactory Shanghai")
    .replace(/\bmore affordable models\b/gi, "more affordable models");

const stripBoilerplatePrefix = (text: string) => {
  let trimmed = text.trim();
  BOILERPLATE_PREFIXES.forEach((pattern) => {
    trimmed = trimmed.replace(pattern, "");
  });
  return trimmed.trim();
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

const stripTimeFromPhrase = (text: string) =>
  text
    .replace(/\bby\b[^,;.]+/gi, "")
    .replace(/\b(?:in|during|through)\s+Q[1-4]\s?20\d{2}\b/gi, "")
    .replace(/\b(?:in|during|through)\s+[12]H\s?20\d{2}\b/gi, "")
    .replace(/\b(?:in|during|through)\s+FY\s?20\d{2}\b/gi, "")
    .replace(/\b(?:in|during|through)\s+20\d{2}\b/gi, "")
    .replace(/\b(?:later this year|later this quarter|next quarter|next year|next month)\b/gi, "");

const trimTitle = (title: string) => {
  if (title.length <= MAX_TITLE_LENGTH) return title.trim();
  let trimmed = title.replace(/\s*\([^)]*\)/g, "").trim();
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  const clauseIndex = trimmed.search(/[;,]/);
  if (clauseIndex > 0) {
    trimmed = trimmed.slice(0, clauseIndex).trim();
  }
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_TITLE_LENGTH).trim();
};

const canonicalizeTitle = (rawText: string, dateMentions: string[]) => {
  const cleaned = stripBoilerplatePrefix(rawText);
  const verb = findActionVerb(cleaned) ?? "Launch";
  const verbIndex = cleaned.toLowerCase().indexOf(verb.toLowerCase());
  const afterVerb = verbIndex >= 0 ? cleaned.slice(verbIndex + verb.length) : cleaned;
  const withoutLeadingTo = afterVerb.replace(/^\s*(?:to\s+)?/i, "");
  const objectPhrase = stripTimeFromPhrase(withoutLeadingTo).split(/[.;]/)[0] ?? "";
  const baseObject = normalizeProductNouns(objectPhrase).trim();
  const action = `${verb.charAt(0).toUpperCase()}${verb.slice(1)}`;
  const baseTitle = baseObject ? `${action} ${baseObject}` : action;
  const timeCue = pickBestTimeCue(dateMentions, rawText);
  const withTime = timeCue?.raw ? `${baseTitle} (${timeCue.raw})` : baseTitle;
  return {
    title: trimTitle(withTime),
    timeCue,
  };
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
  if (hMatch) return hMatch[0].toUpperCase().replace(/\s+/g, " ");
  const yearMatch = timeCue.match(/\b20\d{2}\b/);
  if (yearMatch) return yearMatch[0];
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

export const buildCanonicalDecisions = (rawCandidates: RawCandidate[]): CanonicalDecision[] => {
  const candidateUnits = rawCandidates.map((candidate) => {
    const { title, timeCue } = canonicalizeTitle(candidate.rawText, candidate.dateMentions ?? []);
    const actionVerb = findActionVerb(title) ?? "launch";
    const objectKey = extractObjectKey(title);
    const timeBucket = timeBucketFromCue(timeCue?.raw);
    const tokens = new Set(normalizeTokens(candidate.rawText));
    return {
      candidate,
      title,
      actionVerb,
      objectKey,
      timeBucket,
      timeCue,
      tokens,
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

    clusters.forEach((cluster) => {
      const sortedByScore = [...cluster].sort(
        (a, b) => b.candidate.extractionScore - a.candidate.extractionScore || a.title.length - b.title.length,
      );
      const best = sortedByScore[0];
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
        id: `canon-${best.candidate.id}`,
        docId: best.candidate.docId,
        title: best.title,
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
        },
        tags: undefined,
      });
    });
  });

  return canonicals;
};
