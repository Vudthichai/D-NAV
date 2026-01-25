import { cleanPdfPages, normalizeWhitespace, type PdfPageText } from "@/lib/decisionExtract/cleanText";
import { segmentDecisionCandidates } from "@/lib/decisionExtract/segment";
import { passesDecisionCandidateFilters, scoreDecisionCandidate } from "@/lib/decisionExtract/scoreDecision";
import type { DecisionCandidate, DecisionSource } from "@/lib/types/decision";

const DEFAULT_SCORE = 5;

type CandidateWithScore = DecisionCandidate & {
  score: number;
};

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const normalizeForDedup = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const shouldDropForLength = (value: string) => {
  const length = value.length;
  return length < 40 || length > 240;
};

const generateTitle = (value: string) => {
  const match =
    value.match(
      /\b(will|plan to|expect to|aim to|target|prepare to|commit to|discontinue|launch|ramp|begin|start|expand|build|deploy|introduce|scale|invest|allocate|approve|commence|transition|reduce|increase|continue|on track to|remain on track to)\b([^,.]{0,80})/i,
    ) ?? null;
  const raw = match ? `${match[1]}${match[2]}` : value;
  const words = raw.trim().split(/\s+/).slice(0, 10);
  const title = words.join(" ").replace(/[,.]$/, "");
  return title.charAt(0).toUpperCase() + title.slice(1);
};

const buildCandidate = (text: string, source: DecisionSource, score: number): CandidateWithScore => {
  const normalized = normalizeWhitespace(text);
  return {
    id: `decision-${hashString(normalized.toLowerCase())}`,
    decision: generateTitle(normalized),
    evidence: normalized,
    sources: [source],
    extractConfidence: Math.min(1, Math.max(0, score / 8)),
    impact: DEFAULT_SCORE,
    cost: DEFAULT_SCORE,
    risk: DEFAULT_SCORE,
    urgency: DEFAULT_SCORE,
    confidence: DEFAULT_SCORE,
    keep: true,
    score,
  };
};

const mergeSources = (existing: DecisionSource[], incoming: DecisionSource[]) => {
  const merged = [...existing];
  for (const source of incoming) {
    const already = merged.some(
      (entry) =>
        entry.fileName === source.fileName &&
        entry.pageNumber === source.pageNumber &&
        entry.excerpt === source.excerpt,
    );
    if (!already) {
      merged.push(source);
    }
  }
  return merged;
};

export const extractDecisionCandidatesFromPages = (pages: PdfPageText[]): DecisionCandidate[] => {
  const grouped = new Map<string, PdfPageText[]>();
  for (const page of pages) {
    const key = page.fileName ?? "unknown";
    const entry = grouped.get(key) ?? [];
    entry.push(page);
    grouped.set(key, entry);
  }

  const candidates: CandidateWithScore[] = [];

  for (const [, group] of grouped.entries()) {
    const cleanedPages = cleanPdfPages(group);
    const segments = segmentDecisionCandidates(cleanedPages);
    for (const segment of segments) {
      if (shouldDropForLength(segment.text)) continue;
      if (!passesDecisionCandidateFilters(segment.text)) continue;
      const score = scoreDecisionCandidate(segment.text);

      candidates.push(
        buildCandidate(segment.text, {
          fileName: segment.fileName,
          pageNumber: segment.pageNumber,
          excerpt: segment.rawExcerpt,
        }, score),
      );
    }
  }

  const deduped = new Map<string, CandidateWithScore>();
  for (const candidate of candidates) {
    const normalized = normalizeForDedup(candidate.evidence);
    let merged = false;
    for (const [key, existing] of deduped.entries()) {
      const longer = existing.evidence.length >= candidate.evidence.length ? existing : candidate;
      const shorter = longer === existing ? candidate : existing;
      if (longer.evidence.includes(shorter.evidence)) {
        const lengthDiff = Math.abs(longer.evidence.length - shorter.evidence.length) / longer.evidence.length;
        if (lengthDiff < 0.4) {
          const winner = longer.score >= shorter.score ? longer : shorter;
          winner.sources = mergeSources(longer.sources, shorter.sources);
          deduped.set(key, winner);
          merged = true;
          break;
        }
      }
    }
    if (!merged && !deduped.has(normalized)) {
      deduped.set(normalized, candidate);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.evidence.length - b.evidence.length))
    .map(({ score, ...rest }) => rest);
};

export const extractDecisionCandidatesFromText = (text: string, fileName = "Pasted text"): DecisionCandidate[] => {
  const pages: PdfPageText[] = [
    {
      fileName,
      pageNumber: 1,
      text,
    },
  ];
  return extractDecisionCandidatesFromPages(pages);
};
