"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { PDFPageProxy, TextItem } from "pdfjs-dist/types/src/display/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type QualityTier = "A" | "B" | "C";
type CandidateType = "Commitment" | "Conditional" | "Status" | "BeliefOutlook";
type CategoryBucket = "Product" | "Capex" | "Platform" | "Ops" | "Other";

type DocumentStatus = "pending" | "processing" | "paused" | "done" | "error";

type DocumentSourceType = "pdf" | "text";

interface DocumentProgress {
  id: string;
  label: string;
  sourceType: DocumentSourceType;
  file?: File;
  status: DocumentStatus;
  processedPages: number;
  totalPages: number;
  qualityTier?: QualityTier;
  qualityReason?: string;
  pauseMessage?: string;
  error?: string;
  candidateCount: number;
}

interface CandidateMetrics {
  impact: string;
  cost: string;
  risk: string;
  urgency: string;
  confidence: string;
}

interface DecisionCandidate {
  id: string;
  docId: string;
  docLabel: string;
  pageNumber: number;
  decisionText: string;
  triggers: string[];
  decisionScore: number;
  candidateType: CandidateType;
  category: CategoryBucket;
  timeAnchors: string[];
  kept: boolean;
  metrics: CandidateMetrics;
  signature: string;
}

const commitmentVerbs = [
  "will",
  "plan",
  "planned",
  "launch",
  "launched",
  "begin",
  "start",
  "ramp",
  "invest",
  "investment",
  "investments",
  "deploy",
  "expand",
  "commission",
  "prepare",
  "transition",
  "complete",
];

const directionVerbs = ["prioritize", "focus", "deprioritize", "pursue"];

const constraintPhrases = ["must", "before", "after", "dependent on", "requires"];

const timeAnchorRegex =
  /\b(20\d{2}|Q[1-4]|later this year|by end of|by end|starting in)\b/gi;

const resourceTerms = [
  "capex",
  "capacity",
  "production",
  "factory",
  "construction",
  "manufacturing",
  "headcount",
  "compute",
];

const tradeoffTerms = ["less than expected", "more capex efficient", "at the cost of", "in order to"];

const beliefTerms = ["expect", "believe", "anticipate", "forecast", "estimate", "may", "could", "uncertain"];

const categoryBuckets: Array<{ bucket: CategoryBucket; terms: string[] }> = [
  { bucket: "Product", terms: ["product", "feature", "release", "roadmap", "launch", "customer"] },
  { bucket: "Capex", terms: ["capex", "factory", "construction", "plant", "capacity", "manufacturing", "equipment"] },
  { bucket: "Platform", terms: ["platform", "infrastructure", "compute", "data center", "cloud", "architecture"] },
  { bucket: "Ops", terms: ["operations", "ops", "hiring", "headcount", "supply chain", "logistics", "workflow"] },
];

const stopWords = new Set([
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "for",
  "with",
  "on",
  "by",
  "at",
  "a",
  "an",
  "is",
  "are",
  "be",
  "as",
  "we",
  "our",
  "this",
  "that",
  "from",
  "it",
  "they",
  "their",
]);

const AUTO_PAUSE_MS = 40000;
const MEMORY_PRESSURE_THRESHOLD = 0.82;

const tableNoiseTerms = [
  "yoy",
  "installed",
  "vehicle capacity",
  "production rate",
  "annual",
  "utilization",
  "volume",
  "throughput",
  "units",
  "rate",
];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const dehyphenate = (text: string) => text.replace(/(\w)-\n(\w)/g, "$1$2");

const reconstructParagraphs = (lines: string[]) => {
  const paragraphs: string[] = [];
  let current = "";
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (!current) {
      current = trimmed;
      return;
    }
    if (/[.!?;]$/.test(current)) {
      paragraphs.push(current);
      current = trimmed;
    } else {
      current = `${current} ${trimmed}`;
    }
  });
  if (current) paragraphs.push(current);
  return paragraphs;
};

const splitIntoChunks = (text: string) => {
  const bullets = text
    .split(/\n+/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      if (/^(\u2022|•|\*|-|\d+\.)\s+/.test(trimmed)) {
        return [trimmed.replace(/^(\u2022|•|\*|-|\d+\.)\s+/, "")];
      }
      return [trimmed];
    })
    .join(" ");

  const pieces = bullets
    .split(/(?<=[.!?;])\s+/)
    .map((piece) => piece.trim())
    .filter(Boolean);

  const output: string[] = [];
  pieces.forEach((piece) => {
    if (piece.includes(",") && commitmentVerbs.some((term) => piece.toLowerCase().includes(term))) {
      output.push(
        ...piece
          .split(/,\s+/)
          .map((chunk) => chunk.trim())
          .filter(Boolean),
      );
    } else {
      output.push(piece);
    }
  });

  return output;
};

const hasVerbSignal = (lower: string) =>
  commitmentVerbs.some((term) => lower.includes(term)) ||
  directionVerbs.some((term) => lower.includes(term)) ||
  constraintPhrases.some((term) => lower.includes(term));

const analyzeChunk = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  const digits = (text.match(/\d/g) ?? []).length;
  const digitRatio = digits / Math.max(letters + digits, 1);
  const yearTokens = lower.match(/\b20\d{2}\b/g) ?? [];
  const allCapsTokens = words.filter((word) => /^[A-Z0-9&-]+$/.test(word) && /[A-Z]/.test(word));
  const allCapsRatio = allCapsTokens.length / Math.max(words.length, 1);
  const tableLike = digitRatio > 0.35 || yearTokens.length >= 3;
  const headingLike =
    (allCapsRatio > 0.6 && words.length <= 12) ||
    (words.length <= 8 && text === text.toUpperCase());
  const hasVerb = hasVerbSignal(lower);
  const tableNoise = tableNoiseTerms.some((term) => lower.includes(term));

  return {
    wordCount: words.length,
    digitRatio,
    yearTokens,
    tableLike,
    headingLike,
    hasVerb,
    tableNoise,
  };
};

const getQualityTier = (text: string, lines: string[]): { tier: QualityTier; reason: string } => {
  const charCount = text.replace(/\s/g, "").length;
  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  if (charCount < 200 || tokenCount < 40) {
    return {
      tier: "C",
      reason: "This appears image-based; paste text recommended.",
    };
  }

  const averageLineLength = lines.length > 0 ? lines.join("").length / lines.length : 0;
  const newlineDensity = lines.length / Math.max(text.length, 1);
  if (averageLineLength < 42 || newlineDensity > 0.06) {
    return {
      tier: "B",
      reason: "Layout-heavy text detected (multi-column or dense formatting).",
    };
  }

  return { tier: "A", reason: "Clean continuous text detected." };
};

const normalizeTextForSignature = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !stopWords.has(token));

const buildSignature = (text: string, entities: string[], timeAnchors: string[]) => {
  const tokens = normalizeTextForSignature(text);
  const tokenKey = tokens.slice(0, 6).join("-");
  const entity = entities[0]?.toLowerCase() ?? "";
  const timeAnchor = timeAnchors[0]?.toLowerCase() ?? "";
  return `${entity}|${timeAnchor}|${tokenKey}`;
};

const tokenOverlapRatio = (a: string, b: string) => {
  const setA = new Set(normalizeTextForSignature(a));
  const setB = new Set(normalizeTextForSignature(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection += 1;
  });
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
};

const getCategoryBucket = (text: string): CategoryBucket => {
  const lower = text.toLowerCase();
  const match = categoryBuckets.find((bucket) => bucket.terms.some((term) => lower.includes(term)));
  return match?.bucket ?? "Other";
};

const getEntities = (text: string) => {
  const dictionary = ["AI", "GPU", "ERP", "CRM", "API", "SOC", "ISO"];
  const capitalized = Array.from(
    new Set(
      (text.match(/\b[A-Z][a-zA-Z0-9&-]{2,}(?:\s+[A-Z][a-zA-Z0-9&-]{2,})*/g) ?? []).map((entity) =>
        entity.trim(),
      ),
    ),
  );
  const dictionaryMatches = dictionary.filter((term) => text.includes(term));
  return Array.from(new Set([...capitalized, ...dictionaryMatches])).slice(0, 4);
};

const parsePdfPage = async (page: PDFPageProxy) => {
  const content = await page.getTextContent();
  const lines: string[] = [];
  let line = "";
  content.items.forEach((item) => {
    const textItem = item as TextItem;
    line += textItem.str;
    if (textItem.hasEOL) {
      lines.push(line);
      line = "";
    } else {
      line += " ";
    }
  });
  if (line.trim()) lines.push(line);
  const text = normalizeWhitespace(lines.join("\n"));
  return { text, lines };
};

const scoreCandidate = (text: string) => {
  const lower = text.toLowerCase();
  const triggers: string[] = [];
  const analysis = analyzeChunk(text);

  if (analysis.wordCount < 6 && !analysis.hasVerb) {
    return {
      triggers,
      decisionScore: 0,
      candidateType: "Status" as CandidateType,
      timeAnchors: [],
      hasCommitment: false,
      hasResource: false,
      isCandidate: false,
      isSignal: false,
      analysis,
    };
  }

  const hasCommitment = commitmentVerbs.some((term) => lower.includes(term));
  if (hasCommitment) triggers.push("Commitment verb");

  const hasDirection = directionVerbs.some((term) => lower.includes(term));
  if (hasDirection) triggers.push("Direction verb");

  const hasConstraint = constraintPhrases.some((term) => lower.includes(term));
  if (hasConstraint) triggers.push("Constraint");

  const hasRequiredVerb = hasCommitment || hasDirection || hasConstraint;

  const timeAnchors = Array.from(new Set(lower.match(timeAnchorRegex) ?? [])).map((anchor) => anchor);
  if (timeAnchors.length > 0) triggers.push("Time anchor");

  const hasResource = resourceTerms.some((term) => lower.includes(term));
  if (hasResource) triggers.push("Resource/capex");

  const hasTradeoff = tradeoffTerms.some((term) => lower.includes(term));
  if (hasTradeoff) triggers.push("Tradeoff");

  const hasConditional = /(if|when|assuming|subject to|contingent|unless)\b/.test(lower);
  if (hasConditional) triggers.push("Conditional");

  const hasBelief = beliefTerms.some((term) => lower.includes(term));
  if (hasBelief) triggers.push("Belief/forecast language");

  const beliefPenalty = hasBelief && !(hasCommitment && (timeAnchors.length > 0 || hasResource));

  let score = 0;
  if (hasCommitment) score += 35;
  if (timeAnchors.length > 0) score += 15;
  if (hasResource) score += 12;
  if (hasTradeoff) score += 8;
  if (hasConditional) score += 8;
  if (hasRequiredVerb && timeAnchors.length > 0) score += 10;
  if (hasRequiredVerb && hasTradeoff) score += 8;
  if (hasRequiredVerb && (hasResource || timeAnchors.length > 0) && hasConditional) score += 6;

  if (analysis.tableNoise && !analysis.hasVerb) score -= 30;
  if (analysis.tableLike) score -= 45;
  if (analysis.headingLike) score -= 35;
  if (beliefPenalty) score -= 25;

  const decisionScore = Math.max(0, Math.min(100, score));

  const isSignal = beliefPenalty && !hasCommitment && !hasResource && timeAnchors.length === 0;

  const candidateType: CandidateType = isSignal
    ? "BeliefOutlook"
    : hasConditional
      ? "Conditional"
      : hasCommitment || hasResource
        ? "Commitment"
        : "Status";

  return {
    triggers,
    decisionScore,
    candidateType,
    timeAnchors,
    hasCommitment,
    hasResource,
    isCandidate: hasRequiredVerb,
    isSignal,
    analysis,
  };
};

const createDownload = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const yieldToMain = () =>
  new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    requestAnimationFrame(() => resolve());
  });

const emptyMetrics = (): CandidateMetrics => ({
  impact: "",
  cost: "",
  risk: "",
  urgency: "",
  confidence: "",
});

export default function DecisionCandidateIntake() {
  const [documents, setDocuments] = useState<DocumentProgress[]>([]);
  const [candidates, setCandidates] = useState<DecisionCandidate[]>([]);
  const [signalCandidates, setSignalCandidates] = useState<DecisionCandidate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState("Idle");
  const [isExpanded, setIsExpanded] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [showSignals, setShowSignals] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingDocsRef = useRef<DocumentProgress[]>([]);
  const processingRef = useRef(false);
  const cancelRef = useRef({ cancelled: false, runId: 0 });
  const pauseRef = useRef({ paused: false });
  const docStartTimesRef = useRef(new Map<string, number>());
  const perDocLineCounts = useRef(new Map<string, { counts: Map<string, number>; repeated: Set<string> }>());

  const updateDocument = useCallback((id: string, updates: Partial<DocumentProgress>) => {
    setDocuments((prev) => prev.map((doc) => (doc.id === id ? { ...doc, ...updates } : doc)));
  }, []);

  const updateCandidate = useCallback((id: string, updates: Partial<DecisionCandidate>) => {
    setCandidates((prev) => prev.map((candidate) => (candidate.id === id ? { ...candidate, ...updates } : candidate)));
  }, []);

  const addCandidates = useCallback((incoming: DecisionCandidate[]) => {
    setCandidates((prev) => {
      const updated = [...prev];
      incoming.forEach((candidate) => {
        const match = updated.find((existing) => {
          if (existing.docId !== candidate.docId) return false;
          if (existing.signature === candidate.signature) return true;
          return tokenOverlapRatio(existing.decisionText, candidate.decisionText) > 0.85;
        });
        if (match) {
          if (candidate.decisionScore > match.decisionScore) {
            match.decisionText = candidate.decisionText;
            match.decisionScore = candidate.decisionScore;
            match.triggers = candidate.triggers;
            match.pageNumber = candidate.pageNumber;
            match.candidateType = candidate.candidateType;
            match.timeAnchors = candidate.timeAnchors;
          }
          return;
        }
        updated.push(candidate);
      });
      return updated;
    });
  }, []);

  const addSignals = useCallback((incoming: DecisionCandidate[]) => {
    setSignalCandidates((prev) => [...prev, ...incoming]);
  }, []);

  const triggerPause = useCallback((reason: string) => {
    pauseRef.current.paused = true;
    setIsPaused(true);
    setPauseReason(reason);
    setIsProcessing(false);
    processingRef.current = false;
  }, []);

  const processTextSource = useCallback(
    async (doc: DocumentProgress, runId: number) => {
      updateDocument(doc.id, { status: "processing", processedPages: 1, totalPages: 1 });
      setStatusLine(`Parsing ${doc.label} — memo`);
      const lines = pasteText.split(/\n+/).map((line) => normalizeWhitespace(line));
      const dehyphenated = dehyphenate(lines.join("\n"));
      const paragraphs = reconstructParagraphs(dehyphenated.split(/\n+/));
      const normalized = normalizeWhitespace(dehyphenated);
      const chunks = splitIntoChunks(paragraphs.join("\n"));
      const quality = getQualityTier(normalized, lines);
      updateDocument(doc.id, { qualityTier: quality.tier, qualityReason: quality.reason });

      const extracted: DecisionCandidate[] = [];
      const signals: DecisionCandidate[] = [];
      chunks.forEach((chunk, index) => {
        const trimmed = normalizeWhitespace(chunk);
        if (!trimmed) return;
        const scoring = scoreCandidate(trimmed);
        if (scoring.isSignal) {
          const entities = getEntities(trimmed);
          const signature = buildSignature(trimmed, entities, scoring.timeAnchors);
          signals.push({
            id: `${doc.id}-memo-signal-${index}-${crypto.randomUUID()}`,
            docId: doc.id,
            docLabel: doc.label,
            pageNumber: 1,
            decisionText: trimmed,
            triggers: scoring.triggers,
            decisionScore: scoring.decisionScore,
            candidateType: scoring.candidateType,
            category: getCategoryBucket(trimmed),
            timeAnchors: scoring.timeAnchors,
            kept: false,
            metrics: emptyMetrics(),
            signature,
          });
          return;
        }
        if (!scoring.isCandidate) return;
        if (scoring.decisionScore < 20 && !scoring.hasCommitment && !scoring.hasResource) return;
        const entities = getEntities(trimmed);
        const signature = buildSignature(trimmed, entities, scoring.timeAnchors);
        extracted.push({
          id: `${doc.id}-memo-${index}-${crypto.randomUUID()}`,
          docId: doc.id,
          docLabel: doc.label,
          pageNumber: 1,
          decisionText: trimmed,
          triggers: scoring.triggers,
          decisionScore: scoring.decisionScore,
          candidateType: scoring.candidateType,
          category: getCategoryBucket(trimmed),
          timeAnchors: scoring.timeAnchors,
          kept: false,
          metrics: emptyMetrics(),
          signature,
        });
      });

      addCandidates(extracted);
      addSignals(signals);
      updateDocument(doc.id, { status: "done", candidateCount: extracted.length });

      if (cancelRef.current.cancelled || cancelRef.current.runId !== runId) return;
    },
    [addCandidates, addSignals, pasteText, updateDocument],
  );

  const processPdfRange = useCallback(
    async (doc: DocumentProgress, runId: number, startPage: number) => {
      if (!doc.file) return;
      updateDocument(doc.id, { status: "processing" });
      docStartTimesRef.current.set(doc.id, docStartTimesRef.current.get(doc.id) ?? Date.now());
      const arrayBuffer = await doc.file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      const lineCache = perDocLineCounts.current.get(doc.id) ?? {
        counts: new Map<string, number>(),
        repeated: new Set<string>(),
      };
      perDocLineCounts.current.set(doc.id, lineCache);

      updateDocument(doc.id, {
        totalPages,
        pauseMessage: undefined,
      });

      let candidateCount = doc.candidateCount;

      for (let pageIndex = startPage; pageIndex <= totalPages; pageIndex += 1) {
        if (cancelRef.current.cancelled || cancelRef.current.runId !== runId) return;
        if (pauseRef.current.paused) {
          updateDocument(doc.id, {
            status: "paused",
            processedPages: pageIndex - 1,
            pauseMessage: `Parsing paused at page ${pageIndex - 1}/${totalPages}. Continue?`,
          });
          return;
        }
        const page = await pdf.getPage(pageIndex);
        const { text, lines } = await parsePdfPage(page);
        const quality = getQualityTier(text, lines);
        updateDocument(doc.id, {
          processedPages: pageIndex,
          qualityTier: quality.tier,
          qualityReason: quality.reason,
        });
        setStatusLine(`Parsing ${doc.label} — page ${pageIndex}/${totalPages}`);

        lines.forEach((line) => {
          const normalizedLine = normalizeWhitespace(line);
          if (!normalizedLine) return;
          lineCache.counts.set(normalizedLine, (lineCache.counts.get(normalizedLine) ?? 0) + 1);
          if ((lineCache.counts.get(normalizedLine) ?? 0) / pageIndex > 0.3) {
            lineCache.repeated.add(normalizedLine);
          }
        });

        const filteredLines = lines
          .map((line) => normalizeWhitespace(line))
          .filter((line) => line && !lineCache.repeated.has(line));
        const dehyphenated = dehyphenate(filteredLines.join("\n"));
        const paragraphs = reconstructParagraphs(dehyphenated.split(/\n+/));
        const chunks = splitIntoChunks(paragraphs.join("\n"));
        const extracted: DecisionCandidate[] = [];
        const signals: DecisionCandidate[] = [];

        chunks.forEach((chunk, index) => {
          const trimmed = normalizeWhitespace(chunk);
          if (!trimmed) return;
          const scoring = scoreCandidate(trimmed);
          if (scoring.isSignal) {
            const entities = getEntities(trimmed);
            const signature = buildSignature(trimmed, entities, scoring.timeAnchors);
            signals.push({
              id: `${doc.id}-${pageIndex}-signal-${index}-${crypto.randomUUID()}`,
              docId: doc.id,
              docLabel: doc.label,
              pageNumber: pageIndex,
              decisionText: trimmed,
              triggers: scoring.triggers,
              decisionScore: scoring.decisionScore,
              candidateType: scoring.candidateType,
              category: getCategoryBucket(trimmed),
              timeAnchors: scoring.timeAnchors,
              kept: false,
              metrics: emptyMetrics(),
              signature,
            });
            return;
          }
          if (!scoring.isCandidate) return;
          if (scoring.decisionScore < 20 && !scoring.hasCommitment && !scoring.hasResource) return;
          const entities = getEntities(trimmed);
          const signature = buildSignature(trimmed, entities, scoring.timeAnchors);
          extracted.push({
            id: `${doc.id}-${pageIndex}-${index}-${crypto.randomUUID()}`,
            docId: doc.id,
            docLabel: doc.label,
            pageNumber: pageIndex,
            decisionText: trimmed,
            triggers: scoring.triggers,
            decisionScore: scoring.decisionScore,
            candidateType: scoring.candidateType,
            category: getCategoryBucket(trimmed),
            timeAnchors: scoring.timeAnchors,
            kept: false,
            metrics: emptyMetrics(),
            signature,
          });
        });

        candidateCount += extracted.length;
        addCandidates(extracted);
        addSignals(signals);
        updateDocument(doc.id, { candidateCount });
        const elapsed = Date.now() - (docStartTimesRef.current.get(doc.id) ?? Date.now());
        const memory = typeof performance !== "undefined" ? (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory : undefined;
        const memoryPressure =
          memory && memory.jsHeapSizeLimit > 0 ? memory.usedJSHeapSize / memory.jsHeapSizeLimit > MEMORY_PRESSURE_THRESHOLD : false;
        if (elapsed > AUTO_PAUSE_MS || memoryPressure) {
          const reason = memoryPressure ? "Memory pressure detected" : "Parsing time threshold reached";
          triggerPause(reason);
          updateDocument(doc.id, {
            status: "paused",
            pauseMessage: `Parsing paused at page ${pageIndex}/${totalPages}. Continue?`,
          });
          return;
        }
        await yieldToMain();
      }

      updateDocument(doc.id, {
        status: "done",
        processedPages: totalPages,
        pauseMessage: undefined,
      });
    },
    [addCandidates, addSignals, triggerPause, updateDocument],
  );

  const runQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (pauseRef.current.paused) return;
    processingRef.current = true;
    setIsProcessing(true);
    const runId = cancelRef.current.runId;

    while (pendingDocsRef.current.length > 0) {
      const nextDoc = pendingDocsRef.current.shift();
      if (!nextDoc) continue;
      if (pauseRef.current.paused) break;
      if (cancelRef.current.cancelled || cancelRef.current.runId !== runId) break;
      try {
        if (nextDoc.sourceType === "text") {
          await processTextSource(nextDoc, runId);
        } else {
          await processPdfRange(nextDoc, runId, nextDoc.processedPages + 1);
        }
      } catch (error) {
        updateDocument(nextDoc.id, { status: "error", error: (error as Error).message ?? "Failed to parse PDF." });
      }
    }

    processingRef.current = false;
    setIsProcessing(false);
  }, [processPdfRange, processTextSource, updateDocument]);

  const enqueueDocs = useCallback(
    (docs: DocumentProgress[]) => {
      cancelRef.current.cancelled = false;
      pendingDocsRef.current.push(...docs);
      runQueue();
    },
    [runQueue],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const pdfFiles = Array.from(files).filter((file) => file.type === "application/pdf" || file.name.endsWith(".pdf"));
      if (pdfFiles.length === 0) return;

      const newDocs = pdfFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        label: file.name,
        sourceType: "pdf" as const,
        status: "pending" as const,
        processedPages: 0,
        totalPages: 0,
        candidateCount: 0,
      }));

      setDocuments((prev) => [...prev, ...newDocs]);
      enqueueDocs(newDocs);
    },
    [enqueueDocs],
  );

  const handlePasteExtract = useCallback(() => {
    if (!pasteText.trim()) return;
    const memoDoc: DocumentProgress = {
      id: crypto.randomUUID(),
      label: "Pasted memo",
      sourceType: "text",
      status: "pending",
      processedPages: 0,
      totalPages: 1,
      candidateCount: 0,
    };
    setDocuments((prev) => [...prev, memoDoc]);
    enqueueDocs([memoDoc]);
  }, [enqueueDocs, pasteText]);

  const handleClear = useCallback(() => {
    cancelRef.current.cancelled = true;
    cancelRef.current.runId += 1;
    pendingDocsRef.current = [];
    processingRef.current = false;
    pauseRef.current.paused = false;
    docStartTimesRef.current.clear();
    perDocLineCounts.current.clear();
    setDocuments([]);
    setCandidates([]);
    setSignalCandidates([]);
    setPasteText("");
    setExpandedIds(new Set());
    setShowAll(false);
    setShowSignals(false);
    setStatusLine("Idle");
    setIsProcessing(false);
    setIsPaused(false);
    setPauseReason(null);
  }, []);

  const handleCancelProcessing = useCallback(() => {
    if (!isProcessing && !isPaused) return;
    cancelRef.current.cancelled = true;
    cancelRef.current.runId += 1;
    pendingDocsRef.current = [];
    processingRef.current = false;
    pauseRef.current.paused = false;
    setIsProcessing(false);
    setIsPaused(false);
    setPauseReason(null);
    setStatusLine("Parsing cancelled");
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.status === "processing" || doc.status === "pending"
          ? { ...doc, status: "paused", pauseMessage: `Parsing paused at page ${doc.processedPages}/${doc.totalPages || 1}. Continue?` }
          : doc,
      ),
    );
  }, [isPaused, isProcessing]);

  const handlePauseProcessing = useCallback(() => {
    if (!isProcessing) return;
    triggerPause("Paused by user");
    setStatusLine("Parsing paused");
  }, [isProcessing, triggerPause]);

  const handleResumeProcessing = useCallback(() => {
    if (!isPaused) return;
    pauseRef.current.paused = false;
    setIsPaused(false);
    setPauseReason(null);
    setStatusLine("Resuming parsing");
    const pausedDocs = documents
      .filter((doc) => doc.status === "paused")
      .map((doc) => ({ ...doc, status: "pending" as const, pauseMessage: undefined }));
    if (pausedDocs.length > 0) {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.status === "paused" ? { ...doc, status: "pending", pauseMessage: undefined } : doc,
        ),
      );
      enqueueDocs(pausedDocs);
      return;
    }
    runQueue();
  }, [documents, enqueueDocs, isPaused, runQueue]);

  const handleParseMore = useCallback(
    (doc: DocumentProgress) => {
      if (doc.sourceType !== "pdf") return;
      const updated = { ...doc, status: "pending" as const, pauseMessage: undefined };
      setDocuments((prev) => prev.map((item) => (item.id === doc.id ? updated : item)));
      pauseRef.current.paused = false;
      setIsPaused(false);
      setPauseReason(null);
      enqueueDocs([updated]);
    },
    [enqueueDocs],
  );

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleKeep = useCallback(
    (id: string, checked: boolean) => {
      updateCandidate(id, { kept: checked });
    },
    [updateCandidate],
  );

  const handleMetricChange = useCallback((id: string, key: keyof CandidateMetrics, value: string) => {
    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              metrics: {
                ...candidate.metrics,
                [key]: value,
              },
            }
          : candidate,
      ),
    );
  }, []);

  const handleCategoryChange = useCallback(
    (id: string, value: CategoryBucket) => {
      updateCandidate(id, { category: value });
    },
    [updateCandidate],
  );

  const keptCandidates = useMemo(() => candidates.filter((candidate) => candidate.kept), [candidates]);

  const visibleCandidates = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => b.decisionScore - a.decisionScore);
    return showAll ? sorted : sorted.slice(0, 50);
  }, [candidates, showAll]);

  const overallProgress = useMemo(() => {
    const totals = documents.reduce(
      (acc, doc) => {
        if (doc.totalPages > 0) {
          acc.total += doc.totalPages;
          acc.processed += Math.min(doc.processedPages, doc.totalPages);
        }
        return acc;
      },
      { processed: 0, total: 0 },
    );
    if (totals.total === 0) return 0;
    return Math.round((totals.processed / totals.total) * 100);
  }, [documents]);

  const keptCount = keptCandidates.length;

  const handleExportJson = useCallback(() => {
    const timestamp = new Date().toISOString();
    const payload = keptCandidates.map((candidate) => ({
      docLabel: candidate.docLabel,
      docId: candidate.docId,
      pageNumber: candidate.pageNumber,
      decisionText: candidate.decisionText,
      category: candidate.category,
      impact: candidate.metrics.impact,
      cost: candidate.metrics.cost,
      risk: candidate.metrics.risk,
      urgency: candidate.metrics.urgency,
      confidence: candidate.metrics.confidence,
      decisionScore: candidate.decisionScore,
      triggers: candidate.triggers,
      timestamp,
    }));
    createDownload(JSON.stringify({ exportedAt: timestamp, keptDecisions: payload }, null, 2), "kept-decisions.json", "application/json");
  }, [keptCandidates]);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const hasDocs = documents.length > 0;

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm dark:bg-black/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          Document Intake
          <Badge variant="outline" className="text-[10px]">
            Browser-only
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => setIsExpanded((prev) => !prev)}>
          {isExpanded ? "Collapse" : "Import PDF / memo"}
        </Button>
      </div>

      {isExpanded ? (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-muted/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">PDF intake</p>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose files
              </Button>
            </div>
            <div
              role="button"
              tabIndex={0}
              className="rounded-lg border border-border/60 bg-white/70 px-4 py-6 text-center text-[11px] text-muted-foreground transition hover:border-primary/60"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              Drag and drop PDFs here, or click to browse.
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
            {hasDocs ? (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const progress = doc.totalPages > 0 ? Math.round((doc.processedPages / doc.totalPages) * 100) : 0;
                  const canParseMore =
                    doc.sourceType === "pdf" &&
                    doc.status === "paused" &&
                    doc.totalPages > 0 &&
                    doc.processedPages < doc.totalPages;
                  return (
                    <div
                      key={doc.id}
                      className="rounded-lg border border-border/60 bg-white/80 px-3 py-2 text-[11px] text-muted-foreground"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-foreground">{doc.label}</p>
                          <p>
                            {doc.status === "processing"
                              ? `Parsing page ${doc.processedPages}/${doc.totalPages || 1}`
                              : doc.status === "done"
                                ? `Processed ${doc.processedPages}/${doc.totalPages || 1} pages`
                                : doc.status === "paused"
                                  ? `Paused at ${doc.processedPages}/${doc.totalPages || 1} pages`
                                  : doc.status === "error"
                                    ? "Error"
                                    : "Queued"}
                          </p>
                          {doc.pauseMessage ? <p className="text-[10px] text-amber-600">{doc.pauseMessage}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            Tier {doc.qualityTier ?? "-"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{progress}%</span>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {doc.error ? <p className="mt-1 text-[10px] text-rose-600">{doc.error}</p> : null}
                      {canParseMore ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 px-2 text-[10px] font-semibold uppercase tracking-wide"
                          onClick={() => handleParseMore(doc)}
                          disabled={isProcessing}
                        >
                          Parse more pages
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">No PDFs added yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Memo intake</p>
              <Button size="sm" variant="ghost" onClick={() => setShowPaste((prev) => !prev)}>
                {showPaste ? "Hide" : "Show"}
              </Button>
            </div>
            {showPaste ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  placeholder="Paste a memo or decision brief text here."
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  className="min-h-[140px]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={handlePasteExtract} disabled={!pasteText.trim() || isProcessing}>
                    Parse memo
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-[11px] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Batch progress</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/30">
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{pauseReason ?? statusLine}</span>
              <div className="flex items-center gap-2">
                {isProcessing ? (
                  <Button size="sm" variant="outline" onClick={handlePauseProcessing}>
                    Pause
                  </Button>
                ) : null}
                {isPaused ? (
                  <Button size="sm" variant="outline" onClick={handleResumeProcessing}>
                    Resume
                  </Button>
                ) : null}
                {(isProcessing || isPaused) ? (
                  <Button size="sm" variant="ghost" onClick={handleCancelProcessing}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground">
              {isProcessing ? "Parsing in progress…" : isPaused ? "Paused" : "Idle"}
            </div>
            <Button size="sm" variant="outline" onClick={handleClear}>
              Clear intake
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Extracted decisions (candidates)</h3>
          </div>
          {keptCount > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleExportJson}>
                Export kept decisions
              </Button>
            </div>
          ) : null}
        </div>

        {candidates.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-white/80 px-3 py-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">No decision candidates yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[minmax(160px,1.4fr)_minmax(120px,0.6fr)_repeat(5,minmax(70px,0.4fr))_minmax(70px,0.3fr)] gap-2 rounded-full border border-border/40 bg-muted/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Decision</span>
              <span>Category</span>
              <span className="text-center">Impact</span>
              <span className="text-center">Cost</span>
              <span className="text-center">Risk</span>
              <span className="text-center">Urgency</span>
              <span className="text-center">Confidence</span>
              <span className="text-center">Keep</span>
            </div>
            {visibleCandidates.map((candidate) => {
              const expanded = expandedIds.has(candidate.id);
              return (
                <div
                  key={candidate.id}
                  className="grid grid-cols-[minmax(160px,1.4fr)_minmax(120px,0.6fr)_repeat(5,minmax(70px,0.4fr))_minmax(70px,0.3fr)] items-center gap-2 rounded-xl border border-border/50 bg-white/90 px-4 py-2 text-[11px] text-muted-foreground"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(candidate.id)}
                    className={cn("min-w-0 text-left text-[11px] text-foreground", expanded ? "" : "truncate")}
                  >
                    <span className="font-semibold">{candidate.decisionText}</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {candidate.docLabel} · Page {candidate.pageNumber} · Score {candidate.decisionScore}
                    </span>
                  </button>
                  <Select
                    value={candidate.category}
                    onValueChange={(value) => handleCategoryChange(candidate.id, value as CategoryBucket)}
                  >
                    <SelectTrigger className="h-8 w-full text-[11px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(["Product", "Capex", "Platform", "Ops", "Other"] as CategoryBucket[]).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {["impact", "cost", "risk", "urgency", "confidence"].map((field) => (
                    <Input
                      key={field}
                      value={candidate.metrics[field as keyof CandidateMetrics]}
                      onChange={(event) => handleMetricChange(candidate.id, field as keyof CandidateMetrics, event.target.value)}
                      placeholder="-"
                      className="h-8 text-center text-[11px]"
                      disabled={!candidate.kept}
                    />
                  ))}
                  <div className="flex items-center justify-center">
                    <Switch checked={candidate.kept} onCheckedChange={(checked) => handleToggleKeep(candidate.id, checked)} />
                  </div>
                </div>
              );
            })}
            {candidates.length > 50 ? (
              <Button size="sm" variant="outline" onClick={() => setShowAll((prev) => !prev)}>
                {showAll ? "Show fewer" : "Show more"}
              </Button>
            ) : null}
          </div>
        )}

        {signalCandidates.length > 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold text-foreground"
              onClick={() => setShowSignals((prev) => !prev)}
            >
              <span>Signals (hidden by default)</span>
              <span>{showSignals ? "Hide" : `Show ${signalCandidates.length}`}</span>
            </button>
            {showSignals ? (
              <div className="mt-2 space-y-1">
                {signalCandidates.slice(0, 10).map((signal) => (
                  <div key={signal.id} className="text-[11px] text-muted-foreground">
                    {signal.decisionText} · {signal.docLabel} · Page {signal.pageNumber}
                  </div>
                ))}
                {signalCandidates.length > 10 ? (
                  <div className="text-[10px] text-muted-foreground">
                    Showing first 10 signals.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {keptCount > 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
            {keptCount} kept decision{keptCount === 1 ? "" : "s"} ready for export.
          </div>
        ) : null}
      </div>

    </section>
  );
}
