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
  "increased",
  "reduced",
  "built",
  "produced",
  "started",
  "commissioned",
];

const MEDIUM_TRIGGERS = [
  "will",
  "scheduled",
  "on track",
  "planned",
  "begin",
  "ramp",
  "remain on track",
  "set to",
  "targeting",
];

const SOFT_TRIGGERS = [
  "expect",
  "aim",
  "prioritize",
  "investing in",
  "focusing on",
];

const ACTOR_TOKENS = [
  "we",
  "our",
  "tesla",
  "the company",
  "model",
  "factory",
  "megafactory",
  "fsd",
  "semi",
  "cybertruck",
  "cybercab",
  "robotaxi",
  "optimus",
  "energy",
  "powerwall",
  "megapack",
  "cortex",
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

const BOILERPLATE_PHRASES = ["webcast", "replay", "conference call", "paperwork", "additional information"];

const FINANCE_KEYWORDS = [
  "revenue",
  "gross profit",
  "cash",
  "investments",
  "gaap",
  "non-gaap",
  "eps",
  "yoy",
  "qoq",
  "margin",
  "financial summary",
];

const ELIGIBILITY_KEYWORDS = [
  "eligible",
  "not all",
  "customers or finance options",
  "transferred to end customers",
];

const TIME_CUES = [
  "this quarter",
  "next year",
  "first half",
  "second half",
  "by end of",
  "by the end of",
  "later this year",
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
    if (!endsSentence && nextLooksContinuation && !looksLikeSpacedHeading(line)) {
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

const containsActorToken = (sentence: string) => {
  const lowered = sentence.toLowerCase();
  return ACTOR_TOKENS.some((token) => {
    if (token.includes(" ")) {
      return lowered.includes(token);
    }
    return new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(sentence);
  });
};

const hasVerb = (sentence: string) => {
  return /\b(is|are|was|were|be|been|being|have|has|had|will|shall|should|would|can|could|may|might|must|launch(?:ed)?|complete(?:d)?|deploy(?:ed)?|increase(?:d)?|reduce(?:d)?|build(?:t)?|produce(?:d)?|start(?:ed)?|begin|began|ramp(?:ed|ing)?|expect|plan(?:ned)?|aim|target(?:ing)?|schedule(?:d)?|commission(?:ed)?|deliver(?:ed)?|achieve(?:d)?)\b/i.test(
    sentence,
  );
};

const looksLikeSpacedHeading = (sentence: string) => /(?:\b[A-Z]\s){3,}[A-Z]\b/.test(sentence);

const isBoilerplateSentence = (sentence: string) => {
  const lowered = sentence.toLowerCase();
  return BOILERPLATE_PHRASES.some((phrase) => lowered.includes(phrase));
};

const extractNumbers = (sentence: string) => sentence.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [];

const digitRatio = (sentence: string) => {
  const digits = sentence.match(/\d/g)?.length ?? 0;
  const total = sentence.replace(/\s/g, "").length || 1;
  return digits / total;
};

const looksLikeTableRow = (sentence: string) => {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  const numericTokens = tokens.filter((token) => /\d/.test(token));
  const numericRatio = tokens.length ? numericTokens.length / tokens.length : 0;
  const numberCount = extractNumbers(sentence).length;
  const repeatedColumns = /(?:\d+(?:[.,]\d+)?%?\s+){2,}\d+/.test(sentence);
  const commaCount = (sentence.match(/,/g) ?? []).length;
  const percentCount = (sentence.match(/%/g) ?? []).length;
  if (digitRatio(sentence) > 0.25) return true;
  if (numericRatio > 0.25 || numberCount >= 4) return true;
  if (repeatedColumns) return true;
  if (commaCount >= 3 || percentCount >= 2) return true;
  if (/\b(YoY|QoQ)\b/i.test(sentence) && numberCount >= 3) return true;
  return false;
};

const hasFinanceKeywords = (sentence: string) => {
  const lowered = sentence.toLowerCase();
  return FINANCE_KEYWORDS.some((keyword) => lowered.includes(keyword));
};

const hasWebcastKeywords = (sentence: string) => {
  const lowered = sentence.toLowerCase();
  return BOILERPLATE_PHRASES.some((keyword) => lowered.includes(keyword));
};

const hasEligibilityKeywords = (sentence: string) => {
  const lowered = sentence.toLowerCase();
  return ELIGIBILITY_KEYWORDS.some((keyword) => lowered.includes(keyword));
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
  const slice = words.slice(sliceStart, sliceStart + 12).join(" ");
  const cleaned = cleanTitle(trimTrailingClauses(slice))
    .replace(/^we\s+/i, "")
    .replace(/^our\s+/i, "");
  if (cleaned) {
    return cleaned.length > 80 ? `${cleaned.slice(0, 77)}…` : cleaned;
  }
  const fallback = normalized.slice(0, 80);
  return fallback.length > 80 ? `${fallback.slice(0, 77)}…` : fallback;
};

const extractTitle = (sentence: string, trigger: string) => {
  const title = generateTitle(sentence, trigger);
  const wordCount = countWords(title);
  if (wordCount < 4) return "";
  return title;
};

const namedInitiativeScore = (sentence: string) => {
  const initiatives = [
    "megafactory",
    "robotaxi",
    "cybercab",
    "fsd",
    "semi",
    "optimus",
    "cortex",
    "powerwall",
    "megapack",
  ];
  const lowered = sentence.toLowerCase();
  return initiatives.some((name) => lowered.includes(name)) ? 3 : 0;
};

const executionVerbScore = (sentence: string) => {
  return /\b(launched|completed|deployed|started|commissioned)\b/i.test(sentence) ? 2 : 0;
};

const scoreSentence = (sentence: string) => {
  const wordCount = countWords(sentence);
  const match = getStrength(sentence);
  const hasTimeCue = containsTimeCue(sentence);
  const isTableLike = looksLikeTableRow(sentence) || looksLikeSpacedHeading(sentence);
  const isBoilerplate = isBoilerplateSentence(sentence) || hasWebcastKeywords(sentence);
  const isKpiOnly = hasFinanceKeywords(sentence);
  let score = 0;
  if (hasTimeCue) score += 3;
  score += namedInitiativeScore(sentence);
  score += executionVerbScore(sentence);
  if (isTableLike) score -= 3;
  if (isKpiOnly) score -= 3;

  return {
    score,
    wordCount,
    isTableLike,
    isBoilerplate,
    isKpiOnly,
    match,
    hasTimeCue,
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
      const normalized = sentence.replace(/\s+/g, " ").trim();
      if (!normalized) return;
      const wordCount = countWords(normalized);
      if (wordCount < 9 || normalized.length < 45) return;
      if (normalized.endsWith("…") || normalized.endsWith("...")) return;
      if (!hasVerb(normalized)) return;
      if (looksLikeTableRow(normalized) || looksLikeSpacedHeading(normalized)) return;
      if (hasFinanceKeywords(normalized)) return;
      if (hasWebcastKeywords(normalized)) return;
      if (hasEligibilityKeywords(normalized)) return;
      const analysis = scoreSentence(normalized);
      const match = analysis.match ?? getStrength(normalized);
      const hasTrigger = Boolean(match);
      if (!hasTrigger) return;
      if (!containsActorToken(normalized)) return;
      if (shouldIgnoreSentence(normalized, hasTrigger)) return;
      const title = extractTitle(normalized, match?.trigger ?? "will");
      if (!title) return;
      const quote = normalized.length > 280 ? `${normalized.slice(0, 277)}…` : normalized;
      const id = `${page.page}-${hashSentence(normalized)}`;
      if (seen.has(id)) return;
      seen.add(id);
      candidates.push({
        id,
        strength: match?.strength ?? "soft",
        page: page.page,
        title,
        quote,
        matchedTrigger: match?.trigger ?? "",
        score: analysis.score,
        wordCount,
        isTableLike: analysis.isTableLike,
        isBoilerplate: analysis.isBoilerplate,
        isKpiOnly: analysis.isKpiOnly,
      });
    });
  });

  return candidates;
};
