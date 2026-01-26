export type DecisionStrength = "hard" | "medium" | "soft";

export type LocalDecisionCandidate = {
  id: string;
  strength: DecisionStrength;
  page: number;
  title: string;
  quote: string;
  matchedTrigger: string;
  score: number;
  wordCount: number;
  isTableLike: boolean;
  isBoilerplate: boolean;
  isKpiOnly: boolean;
};

const HARD_TRIGGERS = [
  "launched",
  "completed",
  "deployed",
  "achieved",
  "delivered",
  "built",
  "produced",
  "rolled out",
  "commissioned",
  "executed",
  "reduced",
];

const MEDIUM_TRIGGERS = [
  "will",
  "scheduled",
  "on track",
  "begin",
  "began",
  "start",
  "starting",
  "expected to begin",
  "remain on track",
  "set to",
  "target",
  "targeting",
  "planned",
  "aim to",
  "intend to",
  "ramping",
];

const SOFT_TRIGGERS = [
  "expect",
  "prioritize",
  "focus",
  "investing in",
  "positioned to",
  "not pursuing",
  "deprioritize",
  "delay",
  "delaying",
  "defer",
  "deferring",
  "seeking to",
  "plan to",
];

const IGNORE_PREFIXES = [
  "we believe",
  "we think",
  "we see",
  "we note",
  "there are",
  "this reflects",
  "in addition",
  "overall",
  "however",
];

const FILLER_WORDS = new Set(["to", "the", "a", "an", "and", "of", "for", "in", "on", "with"]);

const BOILERPLATE_PHRASES = [
  "webcast",
  "replay",
  "forward-looking",
  "conference call",
  "safe harbor",
  "paperwork",
  "eligible",
];

const KPI_KEYWORDS = [
  "revenue",
  "gross margin",
  "operating margin",
  "net income",
  "earnings",
  "eps",
  "yoy",
  "qoq",
  "cash",
  "free cash flow",
  "asp",
];

const RESOURCE_CUES = [
  "capex",
  "investment",
  "investments",
  "ramp",
  "ramping",
  "production",
  "manufacturing",
  "manufacturing lines",
  "launch",
  "commission",
  "build",
  "expand",
  "deployments",
  "deployment",
  "factory",
  "megafactory",
];

const TIME_CUES = [
  "this quarter",
  "next year",
  "first half",
  "second half",
  "by end of",
  "by the end of",
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const makeTriggerRegex = (trigger: string) => new RegExp(`\\b${escapeRegExp(trigger)}\\b`, "i");

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

const hashSentence = (sentence: string) => {
  let hash = 5381;
  for (let index = 0; index < sentence.length; index += 1) {
    hash = (hash * 33) ^ sentence.charCodeAt(index);
  }
  return Math.abs(hash).toString(36);
};

const splitTextIntoSentences = (text: string) => {
  if (!text) return [];
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/[•\u2022]/g, "•")
    .trim();

  if (!normalized) return [];
  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const sentences: string[] = [];
  lines.forEach((line) => {
    const isBullet = /^[-–•]\s+/.test(line);
    if (isBullet) {
      sentences.push(line.replace(/^[-–•]\s+/, "").trim());
      return;
    }
    line
      .split(/(?<=[.!?])\s+|;/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .forEach((sentence) => sentences.push(sentence));
  });
  return sentences;
};

const findTrigger = (sentence: string, triggers: string[]) => {
  return triggers.find((trigger) => makeTriggerRegex(trigger).test(sentence)) ?? null;
};

const getStrength = (sentence: string) => {
  const hard = findTrigger(sentence, HARD_TRIGGERS);
  if (hard) return { strength: "hard" as const, trigger: hard };
  const medium = findTrigger(sentence, MEDIUM_TRIGGERS);
  if (medium) return { strength: "medium" as const, trigger: medium };
  const soft = findTrigger(sentence, SOFT_TRIGGERS);
  if (soft) return { strength: "soft" as const, trigger: soft };
  return null;
};

const containsTimeCue = (sentence: string) => {
  if (TIME_CUES.some((cue) => sentence.toLowerCase().includes(cue))) return true;
  return /\bq[1-4]\b/i.test(sentence) || /\b20(2[4-9]|3[0-9])\b/.test(sentence);
};

const containsResourceCue = (sentence: string) => {
  const lowered = sentence.toLowerCase();
  return RESOURCE_CUES.some((cue) => lowered.includes(cue));
};

const looksLikeSpacedHeading = (sentence: string) => /(?:\b[A-Z]\s){3,}[A-Z]\b/.test(sentence);

const isBoilerplateSentence = (sentence: string) => {
  const lowered = sentence.toLowerCase();
  return BOILERPLATE_PHRASES.some((phrase) => lowered.includes(phrase));
};

const extractNumbers = (sentence: string) => sentence.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [];

const looksLikeTableRow = (sentence: string) => {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  const numericTokens = tokens.filter((token) => /\d/.test(token));
  const numericRatio = tokens.length ? numericTokens.length / tokens.length : 0;
  const numberCount = extractNumbers(sentence).length;
  if (numericRatio > 0.25 || numberCount >= 4) return true;
  if (/\b(YoY|QoQ)\b/i.test(sentence) && numberCount >= 3) return true;
  return false;
};

const isKpiOnlySentence = (sentence: string, hasTrigger: boolean, hasResource: boolean) => {
  if (hasTrigger || hasResource) return false;
  const lowered = sentence.toLowerCase();
  return KPI_KEYWORDS.some((keyword) => lowered.includes(keyword));
};

const shouldIgnoreSentence = (sentence: string, hasTrigger: boolean) => {
  const lowered = sentence.trim().toLowerCase();
  const prefix = IGNORE_PREFIXES.find((value) => lowered.startsWith(value));
  if (!prefix) return false;
  if (prefix === "however") {
    return !hasTrigger;
  }
  return true;
};

const cleanTitle = (title: string) => {
  const words = title
    .split(/\s+/)
    .filter(Boolean)
    .filter((word, index) => !(index === 0 && FILLER_WORDS.has(word.toLowerCase())));
  const cleaned = words.join(" ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const trimTrailingClauses = (value: string) => {
  const lowered = value.toLowerCase();
  const breakers = [" as ", " driven by ", " due to ", " which ", " while ", " as we ", " in order to "];
  for (const breaker of breakers) {
    const index = lowered.indexOf(breaker);
    if (index > 0) return value.slice(0, index).trim();
  }
  return value.trim();
};

const generateTitle = (sentence: string, trigger: string) => {
  const normalized = sentence.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);
  const loweredWords = words.map((word) => word.toLowerCase());
  let sliceStart = 0;
  if (trigger === "will") {
    const index = loweredWords.indexOf("will");
    if (index >= 0 && index < words.length - 1) {
      sliceStart = index + 1;
    }
  } else {
    const triggerWords = trigger.split(" ");
    const triggerIndex = loweredWords.findIndex((_, idx) => {
      return triggerWords.every((word, offset) => loweredWords[idx + offset] === word);
    });
    if (triggerIndex >= 0) {
      sliceStart = triggerIndex;
    }
  }
  const slice = words.slice(sliceStart, sliceStart + 10).join(" ");
  const cleaned = cleanTitle(trimTrailingClauses(slice));
  if (cleaned) {
    return cleaned.length > 80 ? `${cleaned.slice(0, 77)}…` : cleaned;
  }
  const fallback = normalized.slice(0, 80);
  return fallback.length > 80 ? `${fallback.slice(0, 77)}…` : fallback;
};

const scoreSentence = (sentence: string) => {
  const wordCount = countWords(sentence);
  const lowered = sentence.toLowerCase();
  const match = getStrength(sentence);
  const hasTrigger = Boolean(match);
  const hasTimeCue = containsTimeCue(sentence);
  const hasResourceCue = containsResourceCue(sentence);
  const isBoilerplate = isBoilerplateSentence(sentence);
  const isTableLike = looksLikeTableRow(sentence) || looksLikeSpacedHeading(sentence);
  const isKpiOnly = isKpiOnlySentence(sentence, hasTrigger, hasResourceCue);

  if (isBoilerplate || looksLikeSpacedHeading(sentence)) {
    return {
      score: -10,
      wordCount,
      isTableLike,
      isBoilerplate: true,
      isKpiOnly,
      match,
      hasTimeCue,
      hasResourceCue,
    };
  }

  if (!hasTrigger && !hasTimeCue && !hasResourceCue) {
    return {
      score: -5,
      wordCount,
      isTableLike,
      isBoilerplate,
      isKpiOnly,
      match,
      hasTimeCue,
      hasResourceCue,
    };
  }

  let score = 0;
  if (match?.strength === "hard") score += 3;
  if (match?.strength === "medium") score += 2.2;
  if (match?.strength === "soft") score += 1.2;
  if (hasTimeCue) score += 1.4;
  if (hasResourceCue) score += 1.5;
  if (/\brecord\b/i.test(lowered)) score += 0.6;

  if (wordCount >= 8 && wordCount <= 28) score += 1;
  if (wordCount > 40) score -= 1.5;
  if (wordCount < 8) score -= 1.5;

  if (isTableLike) score -= 4;
  if (isKpiOnly) score -= 2.5;

  return {
    score,
    wordCount,
    isTableLike,
    isBoilerplate,
    isKpiOnly,
    match,
    hasTimeCue,
    hasResourceCue,
  };
};

export const extractDecisionCandidates = (
  pages: { page: number; text: string }[],
): LocalDecisionCandidate[] => {
  const candidates: LocalDecisionCandidate[] = [];
  const seen = new Set<string>();

  pages.forEach((page) => {
    const sentences = splitTextIntoSentences(page.text);
    sentences.forEach((sentence) => {
      const analysis = scoreSentence(sentence);
      const match = analysis.match ?? getStrength(sentence);
      const hasTrigger = Boolean(match);
      if (analysis.isBoilerplate) return;
      if (!hasTrigger && !analysis.hasTimeCue && !analysis.hasResourceCue) return;
      if (shouldIgnoreSentence(sentence, hasTrigger)) return;
      if (analysis.wordCount < 8 && match?.strength !== "hard" && match?.strength !== "medium") return;
      if (analysis.isTableLike && analysis.score < 0) return;
      const quote = sentence.length > 280 ? `${sentence.slice(0, 277)}…` : sentence;
      const id = `${page.page}-${hashSentence(sentence)}`;
      if (seen.has(id)) return;
      seen.add(id);
      candidates.push({
        id,
        strength: match?.strength ?? "soft",
        page: page.page,
        title: generateTitle(sentence, match?.trigger ?? "will"),
        quote,
        matchedTrigger: match?.trigger ?? "",
        score: analysis.score,
        wordCount: analysis.wordCount,
        isTableLike: analysis.isTableLike,
        isBoilerplate: analysis.isBoilerplate,
        isKpiOnly: analysis.isKpiOnly,
      });
    });
  });

  return candidates;
};
