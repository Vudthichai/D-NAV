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

const TRIGGERS = [
  { label: "launched", regex: /\blaunch(?:ed|ing)?\b/i, score: 4, strength: "hard" as const },
  { label: "completed", regex: /\bcomplete(?:d|ing)?\b/i, score: 4, strength: "hard" as const },
  { label: "deployed", regex: /\bdeploy(?:ed|ing)?\b/i, score: 4, strength: "hard" as const },
  { label: "built", regex: /\bbuilt\b|\bbuild(?:ing)?\b/i, score: 3, strength: "hard" as const },
  { label: "rolled out", regex: /\broll(?:ed)? out\b/i, score: 3, strength: "hard" as const },
  { label: "started", regex: /\bstart(?:ed|ing)?\b/i, score: 3, strength: "hard" as const },
  { label: "begin", regex: /\bbegin(?:ning)?\b|\bbegan\b/i, score: 3, strength: "medium" as const },
  { label: "implemented", regex: /\bimplement(?:ed|ing)?\b/i, score: 3, strength: "hard" as const },
  { label: "ramping", regex: /\bramp(?:ed|ing)?\b/i, score: 2, strength: "medium" as const },
  { label: "commission", regex: /\bcommission(?:ed|ing)?\b/i, score: 3, strength: "medium" as const },
  { label: "will", regex: /\bwill\b/i, score: 2, strength: "medium" as const },
  { label: "scheduled", regex: /\bscheduled\b/i, score: 3, strength: "medium" as const },
  { label: "on track", regex: /\bon track\b/i, score: 2, strength: "medium" as const },
  { label: "planned", regex: /\bplanned\b/i, score: 2, strength: "medium" as const },
  { label: "set to", regex: /\bset to\b/i, score: 2, strength: "medium" as const },
  { label: "targeting", regex: /\btargeting\b/i, score: 2, strength: "medium" as const },
  { label: "expand", regex: /\bexpand(?:ed|ing)?\b/i, score: 2, strength: "medium" as const },
  { label: "prioritize", regex: /\bprioriti[sz]e\b/i, score: 3, strength: "soft" as const },
  { label: "focus", regex: /\bfocus(?:ed|ing)? on\b/i, score: 2, strength: "soft" as const },
  { label: "investing in", regex: /\binvest(?:ing)? in\b/i, score: 3, strength: "soft" as const },
  { label: "continue to pursue", regex: /\bcontinue to pursue\b/i, score: 3, strength: "soft" as const },
  { label: "strategy", regex: /\bstrategy\b/i, score: 2, strength: "soft" as const },
  { label: "approach", regex: /\bapproach\b/i, score: 2, strength: "soft" as const },
  { label: "enable", regex: /\benable(?:s|d|ing)?\b/i, score: 2, strength: "soft" as const },
  { label: "before investing in", regex: /\bbefore investing in\b/i, score: 2, strength: "soft" as const },
  { label: "will manage", regex: /\bwill manage\b/i, score: 2, strength: "soft" as const },
  { label: "delivered", regex: /\bdelivered\b/i, score: 2, strength: "medium" as const },
  { label: "introduce", regex: /\bintroduc(?:e|ed|ing)\b/i, score: 2, strength: "medium" as const },
  { label: "expect", regex: /\bexpect\b/i, score: 1, strength: "soft" as const },
];

const ACTOR_TOKENS = [
  "we",
  "our",
  "tesla",
  "the company",
  "company",
  "management",
  "leadership",
  "board",
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
  "furthermore",
];

const FILLER_WORDS = new Set(["to", "the", "a", "an", "and", "of", "for", "in", "on", "with", "we", "our"]);

const BOILERPLATE_PHRASES = [
  "webcast",
  "replay",
  "conference call",
  "paperwork",
  "additional information",
  "depends on a variety of factors",
];

const FINANCE_KEYWORDS = [
  "revenue",
  "cash",
  "gross margin",
  "gross profit",
  "operating income",
  "gaap",
  "non-gaap",
  "deliveries",
  "production",
  "margin",
  "financial summary",
  "quarter-end",
];

const METRIC_ONLY_KEYWORDS = ["record quarter", "achieved", "reached", "increased", "decreased"];

const ELIGIBILITY_KEYWORDS = ["eligible", "not all vehicles", "customers or finance options", "transferred to end customers"];

const NEGATIVE_KEYWORDS = [
  "webcast",
  "replay",
  "paperwork",
  "eligible",
  "depends on a variety of factors",
  "table",
  "q1-2024",
  "q2-2024",
  "yoy",
  "gwh",
  "quarter-end",
];

const NOISE_LAUNCH_KEYWORDS = [
  "weather",
  "precipitation",
  "forecast",
  "temperature",
  "app store",
  "ios",
  "android",
  "siriusxm",
  "podcast",
  "radio",
  "streaming",
];

const PRODUCT_OPERATIONS_KEYWORDS = [
  "factory",
  "production",
  "manufacturing",
  "plant",
  "line",
  "lines",
  "ramp",
  "ramping",
  "deployment",
  "deploy",
  "commission",
  "commissioning",
  "facility",
  "capex",
  "capacity",
  "rollout",
  "roll out",
  "introduce",
  "release",
  "platform",
  "vehicle",
  "fleet",
  "build",
  "expansion",
  "expand",
];

const TIME_CUES = [
  "this quarter",
  "next year",
  "first half",
  "second half",
  "by end of",
  "by the end of",
  "later this year",
  "early",
  "late",
  "by",
  "in",
  "planned for",
  "scheduled",
  "on track",
];

const TIME_REGEXES = [
  /\bq[1-4]\s?20\d{2}\b/i,
  /\bh[12]\s?20\d{2}\b/i,
  /\b20\d{2}\b/,
  /\bby (the )?end of 20\d{2}\b/i,
  /\bby end of 20\d{2}\b/i,
  /\bby 20\d{2}\b/i,
  /\bin q[1-4]\s?20\d{2}\b/i,
  /\bin h[12]\s?20\d{2}\b/i,
  /\bin 20\d{2}\b/i,
  /\blater (this|next) year\b/i,
  /\bearly 20\d{2}\b/i,
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const getTriggerMatch = (sentence: string) => {
  const matches = TRIGGERS.filter((trigger) => trigger.regex.test(sentence));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.score - a.score)[0];
};

const containsTimeCue = (sentence: string) => {
  if (TIME_CUES.some((cue) => sentence.toLowerCase().includes(cue))) return true;
  return TIME_REGEXES.some((regex) => regex.test(sentence));
};

const containsActorToken = (sentence: string) => {
  const lowered = sentence.toLowerCase();
  const hasToken = ACTOR_TOKENS.some((token) => {
    if (token.includes(" ")) {
      return lowered.includes(token);
    }
    return new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(sentence);
  });
  if (hasToken) return true;
  return /(?:^|[\s(])([A-Z][a-z0-9&.-]+(?:\s+[A-Z][a-z0-9&.-]+){0,2})(?:\b|[,\s)]).{0,18}\b(will|plans|plan|expects|expected|launch|build|deploy|begin|start)\b/.test(
    sentence,
  );
};

const hasCommitmentVerb = (sentence: string) => {
  return /\b(launch(?:ed|ing)?|begin(?:ning)?|began|start(?:ed|ing)?|build(?:ing)?|deploy(?:ed|ing)?|complete(?:d|ing)?|roll(?:ed)? out|implement(?:ed|ing)?|ramp(?:ed|ing)?|commission(?:ed|ing)?|schedule(?:d)?|planned|on track|set to|targeting|prioriti[sz]e|focus(?:ed|ing)? on|invest(?:ing)? in|continue to pursue|enable(?:s|d|ing)?|will manage|introduce|expand(?:ed|ing)?|roll out|pursue)\b/i.test(
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
  const pipeColumns = (sentence.match(/\|/g) ?? []).length >= 2;
  const tabColumns = (sentence.match(/\t/g) ?? []).length >= 2;
  const multiSpaceColumns = (sentence.match(/ {2,}/g) ?? []).length >= 2;
  const separatorColumns = (sentence.match(/[-–—]{2,}/g) ?? []).length >= 1;
  const commaCount = (sentence.match(/,/g) ?? []).length;
  const percentCount = (sentence.match(/%/g) ?? []).length;
  if (digitRatio(sentence) > 0.2) return true;
  if (numericRatio > 0.25 || numberCount >= 4) return true;
  if (repeatedColumns) return true;
  if (pipeColumns || tabColumns || multiSpaceColumns || separatorColumns) return true;
  if (commaCount >= 3 || percentCount >= 2) return true;
  if (/\b(YoY|QoQ)\b/i.test(sentence) && numberCount >= 3) return true;
  return false;
};

const hasFinanceKeywords = (sentence: string) => {
  const lowered = sentence.toLowerCase();
  return FINANCE_KEYWORDS.some((keyword) => lowered.includes(keyword));
};

const hasNegativeKeywords = (sentence: string) => {
  const lowered = sentence.toLowerCase();
  return NEGATIVE_KEYWORDS.some((keyword) => lowered.includes(keyword));
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
  const words = title.split(/\s+/).filter(Boolean);
  let startIndex = 0;
  while (startIndex < words.length && FILLER_WORDS.has(words[startIndex].toLowerCase())) {
    startIndex += 1;
  }
  const cleaned = words.slice(startIndex).join(" ").replace(/\s+/g, " ").trim();
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

const detectEntity = (sentence: string) => {
  const entityMatches = sentence.match(
    /\b([A-Z][a-z0-9&.-]+(?:\s+(?:[A-Z][a-z0-9&.-]+|&))+|[A-Z][a-z0-9&.-]+)\b/g,
  );
  if (!entityMatches) return null;
  const filtered = entityMatches.filter(
    (token) => !["In", "On", "By", "As", "The", "A", "An", "We", "Our"].includes(token),
  );
  return filtered.length > 0 ? filtered[0] : null;
};

const stripLeadingFillers = (sentence: string) => {
  return sentence
    .replace(/^(in\s+q[1-4]\s+\d{4},?\s*)/i, "")
    .replace(/^(in\s+h[12]\s+\d{4},?\s*)/i, "")
    .replace(/^(in\s+\d{4},?\s*)/i, "")
    .replace(/^(furthermore,?\s*)/i, "")
    .replace(/^(we expect,?\s*)/i, "")
    .replace(/^(we believe,?\s*)/i, "")
    .replace(/^(we will,?\s*)/i, "")
    .replace(/^(overall,?\s*)/i, "")
    .trim();
};

const extractTimeQualifier = (sentence: string) => {
  const matches = TIME_REGEXES.map((regex) => sentence.match(regex)?.[0]).filter(Boolean);
  return matches.length > 0 ? matches[0] : null;
};

const ensureTrailingPeriod = (value: string) => (value.endsWith(".") ? value : `${value}.`);

const normalizeTitle = (sentence: string, trigger: string, useTesla: boolean) => {
  const normalized = stripLeadingFillers(sentence.replace(/\s+/g, " ").trim());
  const timeQualifier = extractTimeQualifier(normalized);
  const lowered = normalized.toLowerCase();
  const triggerIndex = lowered.indexOf(trigger.toLowerCase());
  const startIndex = triggerIndex >= 0 ? triggerIndex : 0;
  const fragment = trimTrailingClauses(normalized.slice(startIndex));
  const subject = useTesla ? "Tesla" : detectEntity(normalized) ?? "Company";
  const payload = cleanTitle(fragment).replace(/^we\s+/i, "").replace(/^our\s+/i, "");
  const base = payload ? `${subject} ${payload}` : `${subject} ${cleanTitle(normalized)}`;
  const withTime = timeQualifier && !base.toLowerCase().includes(timeQualifier.toLowerCase()) ? `${base} ${timeQualifier}` : base;
  const capped = withTime.length > 110 ? `${withTime.slice(0, 107).trimEnd()}…` : withTime;
  return ensureTrailingPeriod(capped);
};

const scoreSentence = (sentence: string, trigger: string, hasAction: boolean, hasTime: boolean) => {
  let score = 0;
  if (hasTime) score += 4;
  const triggerMatch = TRIGGERS.find((item) => item.label === trigger);
  if (triggerMatch) score += triggerMatch.score;
  if (hasAction) score += 2;
  if (PRODUCT_OPERATIONS_KEYWORDS.some((keyword) => sentence.toLowerCase().includes(keyword))) score += 2;
  if (/\b(will|scheduled|planned|on track)\b/i.test(sentence)) score += 2;
  if (/\b(will begin|scheduled|planned|on track|launch)\b/i.test(sentence)) score += 2;
  if (/\bexpect\b/i.test(sentence) && !hasAction) score -= 2;
  if (/\bachieved\b/i.test(sentence)) score -= 2;
  if (digitRatio(sentence) > 0.1 && !hasAction) score -= 3;
  return score;
};

const isNoisyLaunchSentence = (sentence: string, hasActor: boolean) => {
  const lowered = sentence.toLowerCase();
  if (!/\blaunch(?:ed|ing)?\b/.test(lowered)) return false;
  if (!NOISE_LAUNCH_KEYWORDS.some((keyword) => lowered.includes(keyword))) return false;
  const hasProductContext = PRODUCT_OPERATIONS_KEYWORDS.some((keyword) => lowered.includes(keyword));
  return !(hasProductContext && hasActor);
};

const normalizeSentenceKey = (sentence: string) =>
  sentence
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const extractDecisionCandidates = (
  pages: { page: number; text: string }[],
): LocalDecisionCandidate[] => {
  const candidates: LocalDecisionCandidate[] = [];
  const seen = new Set<string>();
  const seenNormalized: string[] = [];
  const isTeslaDoc = pages.some((page) => /\btesla\b|\btsla\b/i.test(page.text));

  pages.forEach((page) => {
    const sentences = splitTextIntoSentences(page.text);
    sentences.forEach((sentence) => {
      const normalized = sentence.replace(/\s+/g, " ").trim();
      if (!normalized) return;
      const wordCount = countWords(normalized);
      if (wordCount < 10) return;
      if (normalized.endsWith("…") || normalized.endsWith("...")) return;
      if (digitRatio(normalized) > 0.12) return;
      const numberCount = extractNumbers(normalized).length;
      if (numberCount >= 3) return;
      if (/(?:\b20\d{2}\b\s+){3,}\b20\d{2}\b/.test(normalized)) return;
      if (looksLikeTableRow(normalized) || looksLikeSpacedHeading(normalized)) return;
      const triggerMatch = getTriggerMatch(normalized);
      if (!triggerMatch) return;
      const hasTrigger = Boolean(triggerMatch);
      if (shouldIgnoreSentence(normalized, hasTrigger)) return;
      if (hasWebcastKeywords(normalized)) return;
      if (hasEligibilityKeywords(normalized)) return;
      const hasActor = containsActorToken(normalized);
      if (isNoisyLaunchSentence(normalized, hasActor)) return;
      const hasTimeCue = containsTimeCue(normalized);
      const hasAction = hasCommitmentVerb(normalized);
      const hasDirection = /\b(prioriti[sz]e|focus|strategy|approach|continue to pursue|invest(?:ing)? in|enable)\b/i.test(
        normalized,
      );
      if (
        hasNegativeKeywords(normalized) &&
        !(hasAction || hasDirection || hasTimeCue || (triggerMatch.label === "expect" && /\bgrow|increase|expand\b/i.test(normalized)))
      ) {
        return;
      }
      if (hasFinanceKeywords(normalized) && !(hasAction || hasDirection)) return;
      if (METRIC_ONLY_KEYWORDS.some((keyword) => normalized.toLowerCase().includes(keyword)) && !hasAction) return;
      if (!hasActor) return;
      if (
        !hasAction &&
        !hasDirection &&
        !hasTimeCue &&
        !(triggerMatch.label === "expect" && /\bgrow|increase|expand\b/i.test(normalized))
      ) {
        return;
      }
      if (triggerMatch.label === "expect" && !(hasAction || hasTimeCue || /\bgrow|increase|expand\b/i.test(normalized))) {
        return;
      }
      if (triggerMatch.label === "delivered" && hasFinanceKeywords(normalized)) return;
      if (digitRatio(normalized) > 0.1 && !hasAction) return;
      const matchedTrigger = normalized.match(triggerMatch.regex)?.[0] ?? triggerMatch.label;
      const title = normalizeTitle(normalized, matchedTrigger, isTeslaDoc);
      if (!title) return;
      const titleKey = `${page.page}-${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
      if (seen.has(titleKey)) return;
      const normalizedKey = normalizeSentenceKey(normalized);
      if (seenNormalized.some((key) => key === normalizedKey || key.startsWith(normalizedKey) || normalizedKey.startsWith(key))) {
        return;
      }
      seen.add(titleKey);
      seenNormalized.push(normalizedKey);
      const quote = normalized.length > 260 ? `${normalized.slice(0, 257)}…` : normalized;
      const score = scoreSentence(normalized, triggerMatch.label, hasAction, hasTimeCue);
      candidates.push({
        id: `${page.page}-${hashSentence(normalized)}`,
        strength: triggerMatch.strength,
        page: page.page,
        title,
        quote,
        matchedTrigger: triggerMatch.label,
        score,
        wordCount,
        isTableLike: looksLikeTableRow(normalized),
        isBoilerplate: isBoilerplateSentence(normalized),
        isKpiOnly: hasFinanceKeywords(normalized),
      });
    });
  });

  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.page - b.page;
  });
};
