export type DecisionStrength = "hard" | "medium" | "soft";

export type LocalDecisionCandidate = {
  id: string;
  strength: DecisionStrength;
  page: number;
  title: string;
  quote: string;
  matchedTrigger: string;
};

const HARD_TRIGGERS = [
  "launched",
  "completed",
  "deployed",
  "achieved",
  "reached",
  "delivered",
  "increased",
  "reduced",
  "built",
  "produced",
  "rolled out",
  "began",
  "started",
];

const MEDIUM_TRIGGERS = [
  "will",
  "scheduled",
  "on track",
  "begin",
  "starting",
  "expected to begin",
  "remain on track",
  "set to",
  "targeting",
  "planned",
  "aim to",
  "intend to",
];

const SOFT_TRIGGERS = [
  "expect",
  "prioritize",
  "focus",
  "investing in",
  "positioned to",
  "not pursuing",
  "deprioritize",
  "delaying",
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
    .replace(/\s+/g, " ")
    .replace(/[•\u2022]/g, ". ")
    .replace(/(^|\s)[-–]\s+/g, ". ")
    .trim();

  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?])\s+|;|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
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
  const slice = words.slice(sliceStart, sliceStart + 7).join(" ");
  const cleaned = cleanTitle(slice);
  if (cleaned) {
    return cleaned.length > 80 ? `${cleaned.slice(0, 77)}…` : cleaned;
  }
  const fallback = normalized.slice(0, 80);
  return fallback.length > 80 ? `${fallback.slice(0, 77)}…` : fallback;
};

export const extractDecisionCandidates = (
  pages: { page: number; text: string }[],
): LocalDecisionCandidate[] => {
  const candidates: LocalDecisionCandidate[] = [];
  const seen = new Set<string>();

  pages.forEach((page) => {
    const sentences = splitTextIntoSentences(page.text);
    sentences.forEach((sentence) => {
      if (countWords(sentence) < 8) return;
      const match = getStrength(sentence);
      if (!match) return;
      if (shouldIgnoreSentence(sentence, true)) return;
      const quote = sentence.length > 280 ? `${sentence.slice(0, 277)}…` : sentence;
      const id = `${page.page}-${hashSentence(sentence)}`;
      if (seen.has(id)) return;
      seen.add(id);
      candidates.push({
        id,
        strength: match.strength,
        page: page.page,
        title: generateTitle(sentence, match.trigger),
        quote,
        matchedTrigger: match.trigger,
      });
    });
  });

  return candidates;
};
