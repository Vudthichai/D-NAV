export type DecisionType = "Executed" | "Committed" | "Strategic";

export type EvidenceSource = {
  quote: string;
  page: number;
};

export type DecisionCandidate = {
  id: string;
  title: string;
  quote: string;
  page: number;
  type: DecisionType;
  score: number;
  key: string;
  actor: string;
  verb: string;
  object: string;
  timeframe?: string | null;
  sources: EvidenceSource[];
  meta?: {
    digitRatio: number;
    isTableLike: boolean;
    isBoilerplate: boolean;
    hasNoiseKeywords: boolean;
    hasProductKeyword: boolean;
  };
};

type RawDecisionCandidate = {
  id: string;
  page: number;
  sentence: string;
  window: string;
  actor: string;
  verb: string;
  verbPhrase: string;
  object: string | null;
  timeframe: string | null;
  quote: string;
  meta: DecisionCandidate["meta"];
};

const ACTION_VERBS = [
  { label: "launched", regex: /\blaunch(?:ed|ing)?\b/i, phrase: "launched" },
  { label: "completed", regex: /\bcomplete(?:d|ing)?\b/i, phrase: "completed" },
  { label: "began", regex: /\b(began|begin(?:ning)?)\b/i, phrase: "began" },
  { label: "start", regex: /\bstart(?:ed|ing)?\b/i, phrase: "started" },
  { label: "will", regex: /\bwill\b/i, phrase: "will" },
  { label: "planned", regex: /\bplanned\b/i, phrase: "plans" },
  { label: "scheduled", regex: /\bscheduled\b/i, phrase: "scheduled" },
  { label: "on track", regex: /\bon track\b/i, phrase: "is on track to" },
  { label: "deployed", regex: /\bdeploy(?:ed|ing)?\b/i, phrase: "deployed" },
  { label: "commissioned", regex: /\bcommission(?:ed|ing)?\b/i, phrase: "commissioned" },
  { label: "ramping", regex: /\bramp(?:ed|ing)?\b/i, phrase: "is ramping" },
  { label: "investing", regex: /\binvest(?:ing)?\b/i, phrase: "is investing in" },
  { label: "build", regex: /\bbuild(?:s|ing)?\b/i, phrase: "is building" },
  { label: "pursue", regex: /\bpursue\b/i, phrase: "is pursuing" },
];

const PRODUCT_KEYWORDS = [
  "Megafactory",
  "Gigafactory",
  "Model",
  "Cybercab",
  "Cortex",
  "FSD",
  "Semi",
  "Powerwall",
  "Megapack",
  "Optimus",
  "Cybertruck",
  "Robotaxi",
  "Dojo",
  "Supercharger",
  "Energy",
  "Battery",
];

const NOISE_KEYWORDS = [
  "precipitation",
  "forecast",
  "weather",
  "temperature",
  "siriusxm",
  "podcast",
  "radio",
  "streaming",
  "app store",
  "ios",
  "android",
];

const BOILERPLATE_PATTERNS = [
  "paperwork correctly completed",
  "webcast replay",
  "conference call",
  "definitions",
  "additional information",
  "forward-looking statements",
];

const TABLE_HINTS = ["|", "%", "\t", "–", "—"];

const TIME_PATTERNS = [
  /\bq[1-4]\s?20\d{2}\b/i,
  /\bh[12]\s?20\d{2}\b/i,
  /\b20\d{2}\b/, 
  /\bby (the )?end of 20\d{2}\b/i,
  /\bby 20\d{2}\b/i,
  /\bin q[1-4]\s?20\d{2}\b/i,
  /\bin h[12]\s?20\d{2}\b/i,
  /\bin 20\d{2}\b/i,
  /\bthis quarter\b/i,
  /\bnext year\b/i,
  /\bfirst half of 20\d{2}\b/i,
  /\bsecond half of 20\d{2}\b/i,
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
  if (!text) return [] as string[];
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/([a-zA-Z])\-\n([a-zA-Z])/g, "$1$2")
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
    if (!endsSentence && nextLooksContinuation) {
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

const digitRatio = (sentence: string) => {
  const digits = sentence.match(/\d/g)?.length ?? 0;
  const total = sentence.replace(/\s/g, "").length || 1;
  return digits / total;
};

const looksLikeTableRow = (sentence: string) => {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  const numericTokens = tokens.filter((token) => /\d/.test(token));
  const numericRatio = tokens.length ? numericTokens.length / tokens.length : 0;
  const numberCount = sentence.match(/\b\d+(?:[.,]\d+)?%?\b/g)?.length ?? 0;
  const commaCount = (sentence.match(/,/g) ?? []).length;
  const percentCount = (sentence.match(/%/g) ?? []).length;
  if (digitRatio(sentence) > 0.2) return true;
  if (numericRatio > 0.3 || numberCount >= 4) return true;
  if (TABLE_HINTS.some((hint) => sentence.includes(hint)) && numberCount >= 3) return true;
  if (commaCount >= 3 || percentCount >= 2) return true;
  return false;
};

const findActor = (pages: { page: number; text: string }[]) => {
  const joined = pages.slice(0, 2).map((page) => page.text).join(" ");
  if (/\btesla\b|\btsla\b/i.test(joined)) return "Tesla";
  const match = joined.match(/\b([A-Z][a-z0-9&.-]+(?:\s+[A-Z][a-z0-9&.-]+){0,2})\b/);
  return match?.[1] ?? "Company";
};

const matchVerb = (sentence: string) => {
  for (const verb of ACTION_VERBS) {
    if (verb.regex.test(sentence)) return verb;
  }
  return null;
};

const extractTimeframe = (text: string) => {
  const match = TIME_PATTERNS.map((regex) => text.match(regex)?.[0]).find(Boolean);
  if (!match) return null;
  if (/^q[1-4]/i.test(match)) return match.toUpperCase();
  if (/^h[12]/i.test(match)) return match.toUpperCase();
  if (match.toLowerCase().includes("this quarter")) return "this quarter";
  if (match.toLowerCase().includes("next year")) return "next year";
  const normalized = match.replace(/\s+/g, " ").trim();
  if (/^20\d{2}$/.test(normalized)) return `in ${normalized}`;
  if (!/^(in|by|for|this|next)\b/i.test(normalized)) return `in ${normalized}`;
  return normalized;
};

const normalizeKey = (value: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractObjectPhrase = (text: string, verbIndex: number) => {
  const afterVerb = text.slice(verbIndex).replace(/^[^a-zA-Z0-9]+/, "");
  for (const keyword of PRODUCT_KEYWORDS) {
    const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i");
    const match = afterVerb.match(regex);
    if (match) {
      const start = afterVerb.indexOf(match[0]);
      const tail = afterVerb.slice(start);
      const words = tail.split(/\s+/).filter(Boolean);
      const phraseWords: string[] = [];
      words.some((word, index) => {
        if (index === 0) {
          phraseWords.push(word);
          return false;
        }
        if (/^[A-Z0-9]/.test(word) || /^(Model|Gigafactory|Megafactory)$/i.test(word)) {
          phraseWords.push(word.replace(/[.,;:]+$/, ""));
          return false;
        }
        return true;
      });
      return phraseWords.join(" ").trim();
    }
  }

  const capitalMatch = afterVerb.match(/\b([A-Z][a-z0-9&.-]+(?:\s+[A-Z0-9][a-z0-9&.-]+){0,4})\b/);
  if (capitalMatch) return capitalMatch[1];

  const fallbackMatch = afterVerb.match(
    /\b(production lines?|factory|plant|facility|project|site|platform|fleet|line|lines|program)\b[^.;:]{0,60}/i,
  );
  if (fallbackMatch) {
    return fallbackMatch[0].replace(/[.,;:]+$/, "").trim();
  }

  return null;
};

const truncateQuote = (sentence: string, maxLength = 220) => {
  if (sentence.length <= maxLength) return sentence.trim();
  const clipped = sentence.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  if (lastSpace > 0) return `${clipped.slice(0, lastSpace)}…`;
  return `${clipped}…`;
};

const classifyType = (verb: string, window: string): DecisionType => {
  const lowered = `${verb} ${window}`.toLowerCase();
  if (/\b(completed|launched|deployed|commissioned|delivered)\b/.test(lowered)) return "Executed";
  if (/\b(will|scheduled|planned|on track|begin|began|start|ramp)\b/.test(lowered)) return "Committed";
  if (/\b(expect|aim|manage|prioriti[sz]e)\b/.test(lowered)) return "Strategic";
  return "Committed";
};

export const extractCandidatesFromPdfText = (pages: { page: number; text: string }[]) => {
  const actor = findActor(pages);
  const candidates: RawDecisionCandidate[] = [];

  pages.forEach((page) => {
    const sentences = splitTextIntoSentences(page.text);
    sentences.forEach((sentence, index) => {
      const cleaned = sentence.replace(/\s+/g, " ").trim();
      if (cleaned.length < 40) return;
      const verb = matchVerb(cleaned);
      if (!verb) return;

      const nextSentence = sentences[index + 1]?.trim();
      const window = nextSentence && nextSentence.length < 180 ? `${cleaned} ${nextSentence}` : cleaned;
      const match = window.match(verb.regex);
      const verbIndex = match?.index ?? 0;
      const object = extractObjectPhrase(window, Math.max(verbIndex, 0));
      const timeframe = extractTimeframe(window);
      const quote = truncateQuote(cleaned.length > 60 ? cleaned : window);
      const lowered = window.toLowerCase();
      const hasProductKeyword = PRODUCT_KEYWORDS.some((keyword) => lowered.includes(keyword.toLowerCase()));
      const hasNoiseKeywords = NOISE_KEYWORDS.some((keyword) => lowered.includes(keyword));
      const meta = {
        digitRatio: digitRatio(window),
        isTableLike: looksLikeTableRow(window),
        isBoilerplate: BOILERPLATE_PATTERNS.some((pattern) => lowered.includes(pattern)),
        hasNoiseKeywords,
        hasProductKeyword,
      };

      candidates.push({
        id: `${page.page}-${hashSentence(window)}`,
        page: page.page,
        sentence: cleaned,
        window,
        actor,
        verb: verb.label,
        verbPhrase: verb.phrase,
        object,
        timeframe,
        quote,
        meta,
      });
    });
  });

  return candidates;
};

export const canonicalizeCandidate = (candidate: RawDecisionCandidate): DecisionCandidate | null => {
  if (!candidate.object) return null;
  const timeframe = candidate.timeframe;
  const titleBase = `${candidate.actor} ${candidate.verbPhrase} ${candidate.object}`.replace(/\s+/g, " ").trim();
  const title = `${titleBase}${timeframe ? ` ${timeframe}` : ""}`.replace(/\s+/g, " ").trim();
  if (!title) return null;
  return {
    id: candidate.id,
    title: title.endsWith(".") ? title : `${title}.`,
    quote: candidate.quote,
    page: candidate.page,
    type: classifyType(candidate.verb, candidate.window),
    score: 0,
    key: "",
    actor: candidate.actor,
    verb: candidate.verbPhrase,
    object: candidate.object,
    timeframe,
    sources: [{ quote: candidate.quote, page: candidate.page }],
    meta: candidate.meta,
  };
};

export const passesQualityGate = (candidate: DecisionCandidate) => {
  const titleWordCount = countWords(candidate.title);
  const objectNormalized = normalizeKey(candidate.object);
  if (titleWordCount < 6) return false;
  if (candidate.quote.length < 40) return false;
  if (candidate.meta?.isTableLike || (candidate.meta?.digitRatio ?? 0) > 0.2) return false;
  if (candidate.meta?.isBoilerplate) return false;
  if (candidate.meta?.hasNoiseKeywords && !candidate.meta?.hasProductKeyword) return false;
  if (/^(20\d{2}|q[1-4]\s?20\d{2}|h[12]\s?20\d{2})$/i.test(objectNormalized)) return false;
  if (/\bplanned for\b/i.test(candidate.title) && !candidate.title.match(/\b\w+\s+planned for\b/i)) return false;
  return true;
};

const buildDedupeKey = (candidate: DecisionCandidate) => {
  return [candidate.actor, candidate.object, candidate.verb, candidate.timeframe]
    .map((value) => normalizeKey(value ?? ""))
    .join("-");
};

const mergeSources = (existing: EvidenceSource[], incoming: EvidenceSource[]) => {
  const merged = [...existing];
  incoming.forEach((source) => {
    const key = `${source.page}-${source.quote}`;
    if (!merged.some((item) => `${item.page}-${item.quote}` === key)) {
      merged.push(source);
    }
  });
  return merged.slice(0, 2);
};

const chooseBestCandidate = (current: DecisionCandidate, incoming: DecisionCandidate) => {
  const currentHasTime = /\b(in|by|for)\b/i.test(current.title);
  const incomingHasTime = /\b(in|by|for)\b/i.test(incoming.title);
  if (incomingHasTime && !currentHasTime) return incoming;
  if (incoming.score !== current.score) return incoming.score > current.score ? incoming : current;
  if (incoming.title.length !== current.title.length) {
    return incoming.title.length > current.title.length ? incoming : current;
  }
  return current;
};

export const dedupeCandidates = (candidates: DecisionCandidate[]) => {
  const map = new Map<string, DecisionCandidate>();
  candidates.forEach((candidate) => {
    const key = buildDedupeKey(candidate);
    const nextCandidate = { ...candidate, key };
    const existing = map.get(key);
    if (!existing) {
      map.set(key, nextCandidate);
      return;
    }
    const winner = chooseBestCandidate(existing, nextCandidate);
    const sources = mergeSources(existing.sources, nextCandidate.sources);
    map.set(key, { ...winner, sources });
  });
  return [...map.values()];
};

const scoreCandidate = (candidate: DecisionCandidate) => {
  let score = 0;
  if (candidate.timeframe) score += 3;
  if (/\b(plans|planned|scheduled|on track|will)\b/i.test(candidate.verb)) score += 3;
  if (PRODUCT_KEYWORDS.some((keyword) => candidate.title.includes(keyword))) score += 2;
  if (/\bexpect\b/i.test(candidate.title) && !/\b(in|by|for)\b/i.test(candidate.title)) score -= 5;
  if (candidate.meta?.digitRatio && candidate.meta.digitRatio > 0.12) score -= 10;
  return score;
};

export const scoreAndRankCandidates = (candidates: DecisionCandidate[]) => {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate) }))
    .sort((a, b) => b.score - a.score || a.page - b.page);
};

export const extractDecisionCandidates = (pages: { page: number; text: string }[]) => {
  const rawCandidates = extractCandidatesFromPdfText(pages);
  const canonicalized = rawCandidates
    .map((candidate) => canonicalizeCandidate(candidate))
    .filter((candidate): candidate is DecisionCandidate => Boolean(candidate))
    .filter((candidate) => passesQualityGate(candidate));
  const deduped = dedupeCandidates(canonicalized);
  return scoreAndRankCandidates(deduped);
};
