"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { PDFPageProxy, TextItem } from "pdfjs-dist/types/src/display/api";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type QualityTier = "A" | "B" | "C";
type CandidateBucket = "high" | "possible" | "signal";
type ExtractorConfidence = "low" | "medium" | "high";
type CandidateStatus = "unreviewed" | "kept" | "signal" | "ignored";
type CandidateType = "Commitment" | "Allocation" | "Constraint" | "Direction" | "ExecutionCheckpoint";
type CategoryBucket = "Product" | "Capex" | "Platform" | "Ops" | "Other";

interface DocumentInput {
  id: string;
  file?: File;
  label: string;
  sourceType: "pdf" | "text";
}

interface DocumentProgress extends DocumentInput {
  status: "pending" | "processing" | "done" | "error";
  processedPages: number;
  totalPages: number;
  qualityTier?: QualityTier;
  qualityReason?: string;
  limitApplied?: string;
  error?: string;
  candidateCount: number;
}

interface DecisionCandidate {
  id: string;
  docId: string;
  docLabel: string;
  pageNumber: number;
  extractedSentence: string;
  triggers: string[];
  decisionScore: number;
  extractorConfidence: ExtractorConfidence;
  candidateType: CandidateType;
  categoryBucket: CategoryBucket;
  timeAnchors: string[];
  entities: string[];
  bucket: CandidateBucket;
  status: CandidateStatus;
  signature: string;
  supportingCount: number;
}

const contextOptions = [
  "Investor update",
  "Board memo",
  "Strategy deck",
  "Internal memo",
  "Other",
];

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
  "investments",
  "deploy",
  "expand",
  "commission",
  "prepare",
  "transition",
  "complete",
];

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

const tradeoffTerms = ["less than expected", "more capex efficient", "at the cost of", "tradeoff", "in order to"];

const beliefTerms = ["expect", "believe", "anticipate", "forecast", "estimate", "may", "could", "uncertain"];

const constraintTerms = ["must", "required", "limit", "cannot", "constrained", "cap", "budget", "restrict"];

const directionTerms = ["strategy", "focus", "priority", "shift", "reposition", "direction"];

const executionTerms = ["milestone", "phase", "checkpoint", "deliver", "complete", "by end of", "by end"];

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

const timeAnchorRegex =
  /\b(20\d{2}|Q[1-4]|later this year|next year|starting in|by end of|by end)\b/gi;

const MAX_PDF_FILES = 5;
const MAX_PAGES_PER_DOC = 30;
const MAX_PROCESSING_MS = 15000;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const getQualityTier = (text: string, lines: string[]): { tier: QualityTier; reason: string } => {
  const charCount = text.replace(/\s/g, "").length;
  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  if (charCount < 200 || tokenCount < 40) {
    return {
      tier: "C",
      reason: "Very little extractable text detected (likely scan or image-heavy).",
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

const scoreCandidate = (text: string, strictMode: boolean) => {
  const lower = text.toLowerCase();
  const triggers: string[] = [];

  const hasCommitment = commitmentVerbs.some((term) => lower.includes(term));
  if (hasCommitment) triggers.push("Commitment verb");

  const timeAnchors = Array.from(new Set(lower.match(timeAnchorRegex) ?? [])).map((anchor) => anchor);
  if (timeAnchors.length > 0) triggers.push("Time anchor");

  const hasResource = resourceTerms.some((term) => lower.includes(term));
  if (hasResource) triggers.push("Resource/capex");

  const hasTradeoff = tradeoffTerms.some((term) => lower.includes(term));
  if (hasTradeoff) triggers.push("Tradeoff");

  const hasConstraint = constraintTerms.some((term) => lower.includes(term));
  if (hasConstraint) triggers.push("Constraint language");

  const hasDirection = directionTerms.some((term) => lower.includes(term));
  if (hasDirection) triggers.push("Direction language");

  const hasExecution = executionTerms.some((term) => lower.includes(term));
  if (hasExecution) triggers.push("Execution checkpoint");

  const hasBelief = beliefTerms.some((term) => lower.includes(term));
  if (hasBelief) triggers.push("Belief/forecast language");

  const hasConditional = /(if|when|assuming|subject to|contingent|unless)\b/.test(lower);
  if (hasConditional) triggers.push("Conditional");

  let score = 0;
  if (hasCommitment) score += 35;
  if (timeAnchors.length > 0) score += 15;
  if (hasResource) score += 12;
  if (hasTradeoff) score += 8;
  if (hasConstraint) score += 10;
  if (hasDirection) score += 8;
  if (hasExecution) score += 10;
  if (hasConditional) score += strictMode ? 2 : 8;
  if (hasBelief) score -= 25;

  const decisionScore = Math.max(0, Math.min(100, score));

  const candidateType: CandidateType = hasConstraint
    ? "Constraint"
    : hasResource
      ? "Allocation"
      : hasExecution
        ? "ExecutionCheckpoint"
        : hasDirection
          ? "Direction"
          : "Commitment";

  const isSignal = hasBelief && !(hasCommitment || hasResource || timeAnchors.length > 0);

  const extractorConfidence: ExtractorConfidence =
    decisionScore >= 75 && !isSignal ? "high" : decisionScore >= 55 && !isSignal ? "medium" : "low";

  const bucket: CandidateBucket = isSignal ? "signal" : decisionScore >= 70 ? "high" : "possible";

  return {
    triggers,
    decisionScore,
    candidateType,
    bucket,
    extractorConfidence,
    timeAnchors,
    hasBelief,
    hasCommitment,
    hasResource,
    hasConditional,
  };
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
  return Array.from(new Set([...capitalized, ...dictionaryMatches])).slice(0, 6);
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
    if (/[.!?;:]$/.test(current)) {
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

const buildCsv = (candidates: DecisionCandidate[], timestamp: string) => {
  const headers = [
    "docId",
    "docLabel",
    "pageNumber",
    "extractedSentence",
    "candidateType",
    "categoryBucket",
    "decisionScore",
    "extractorConfidence",
    "triggers",
    "timeAnchors",
    "entities",
    "timestamp",
  ];
  const rows = candidates.map((candidate) => [
    candidate.docId,
    candidate.docLabel,
    candidate.pageNumber,
    candidate.extractedSentence,
    candidate.candidateType,
    candidate.categoryBucket,
    candidate.decisionScore,
    candidate.extractorConfidence,
    candidate.triggers.join("|"),
    candidate.timeAnchors.join("|"),
    candidate.entities.join("|"),
    timestamp,
  ]);
  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
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

export default function DecisionCandidateIntake() {
  const [context, setContext] = useState(contextOptions[0]);
  const [strictMode, setStrictMode] = useState(true);
  const [mergeAcrossDocs, setMergeAcrossDocs] = useState(false);
  const [documentInputs, setDocumentInputs] = useState<DocumentInput[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [documents, setDocuments] = useState<DocumentProgress[]>([]);
  const [candidates, setCandidates] = useState<DecisionCandidate[]>([]);
  const [statusLine, setStatusLine] = useState("Idle");
  const [overallProgress, setOverallProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());
  const [signalIds, setSignalIds] = useState<Set<string>>(new Set());
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const cancelRef = useRef({ cancelled: false, runId: 0 });

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, MAX_PDF_FILES);
    setDocumentInputs(
      selected.map((file) => ({
        id: crypto.randomUUID(),
        file,
        label: file.name,
        sourceType: "pdf",
      })),
    );
  }, []);

  const handleLabelChange = useCallback((id: string, value: string) => {
    setDocumentInputs((prev) => prev.map((doc) => (doc.id === id ? { ...doc, label: value } : doc)));
  }, []);

  const handleClear = useCallback(() => {
    cancelRef.current.cancelled = true;
    cancelRef.current.runId += 1;
    setDocumentInputs([]);
    setPasteText("");
    setDocuments([]);
    setCandidates([]);
    setKeptIds(new Set());
    setSignalIds(new Set());
    setIgnoredIds(new Set());
    setStatusLine("Idle");
    setOverallProgress(0);
    setIsProcessing(false);
  }, []);

  const addCandidates = useCallback(
    (incoming: DecisionCandidate[], allowMergeAcrossDocs: boolean) => {
      setCandidates((prev) => {
        const updated = [...prev];
        incoming.forEach((candidate) => {
          const match = updated.find((existing) => {
            if (!allowMergeAcrossDocs && existing.docId !== candidate.docId) return false;
            if (existing.signature === candidate.signature) return true;
            return tokenOverlapRatio(existing.extractedSentence, candidate.extractedSentence) > 0.85;
          });
          if (match) {
            if (candidate.decisionScore > match.decisionScore) {
              match.extractedSentence = candidate.extractedSentence;
              match.decisionScore = candidate.decisionScore;
              match.extractorConfidence = candidate.extractorConfidence;
              match.triggers = candidate.triggers;
              match.bucket = candidate.bucket;
              match.pageNumber = candidate.pageNumber;
            }
            match.supportingCount += 1;
            return;
          }
          updated.push(candidate);
        });
        return updated;
      });
    },
    [],
  );

  const updateDocument = useCallback((id: string, updates: Partial<DocumentProgress>) => {
    setDocuments((prev) => prev.map((doc) => (doc.id === id ? { ...doc, ...updates } : doc)));
  }, []);

  const processTextSource = useCallback(
    async (doc: DocumentProgress, runId: number, docIndex: number, totalDocs: number) => {
      updateDocument(doc.id, { status: "processing", processedPages: 1, totalPages: 1 });
      setStatusLine(`Parsing document ${docIndex + 1}/${totalDocs} — page 1/1`);
      setOverallProgress(Math.round(((docIndex + 1) / totalDocs) * 100));
      const lines = pasteText.split(/\n+/);
      const normalizedLines = lines.map((line) => normalizeWhitespace(line));
      const dehyphenated = dehyphenate(normalizedLines.join("\n"));
      const paragraphs = reconstructParagraphs(dehyphenated.split(/\n+/));
      const normalized = normalizeWhitespace(dehyphenated);
      const chunks = splitIntoChunks(paragraphs.join("\n"));
      const quality = getQualityTier(normalized, lines);
      updateDocument(doc.id, { qualityTier: quality.tier, qualityReason: quality.reason });

      const extracted: DecisionCandidate[] = [];
      chunks.forEach((chunk, index) => {
        const trimmed = normalizeWhitespace(chunk);
        if (!trimmed) return;
        const scoring = scoreCandidate(trimmed, strictMode);
        if (strictMode && scoring.bucket !== "signal" && scoring.decisionScore < 45 && !scoring.hasCommitment) {
          return;
        }
        const entities = getEntities(trimmed);
        const signature = buildSignature(trimmed, entities, scoring.timeAnchors);
        extracted.push({
          id: `${doc.id}-${index}-${crypto.randomUUID()}`,
          docId: doc.id,
          docLabel: doc.label,
          pageNumber: 1,
          extractedSentence: trimmed,
          triggers: scoring.triggers,
          decisionScore: scoring.decisionScore,
          extractorConfidence: scoring.extractorConfidence,
          candidateType: scoring.candidateType,
          categoryBucket: getCategoryBucket(trimmed),
          timeAnchors: scoring.timeAnchors,
          entities,
          bucket: scoring.bucket,
          status: "unreviewed",
          signature,
          supportingCount: 1,
        });
      });

      addCandidates(extracted, mergeAcrossDocs);
      updateDocument(doc.id, { status: "done", candidateCount: extracted.length });

      if (cancelRef.current.cancelled || cancelRef.current.runId !== runId) return;
    },
    [addCandidates, mergeAcrossDocs, pasteText, strictMode, updateDocument],
  );

  const processPdf = useCallback(
    async (doc: DocumentProgress, runId: number, docIndex: number, totalDocs: number) => {
      if (!doc.file) return;
      updateDocument(doc.id, { status: "processing", processedPages: 0 });
      const start = performance.now();
      const arrayBuffer = await doc.file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      const totalPages = Math.min(pdf.numPages, MAX_PAGES_PER_DOC);
      updateDocument(doc.id, {
        totalPages,
        limitApplied: pdf.numPages > MAX_PAGES_PER_DOC ? "30 page limit reached." : undefined,
      });
      const lineCounts = new Map<string, number>();
      const repeatedLines = new Set<string>();
      let candidateCount = 0;
      let pageProcessed = 0;

      for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
        if (cancelRef.current.cancelled || cancelRef.current.runId !== runId) return;
        const elapsed = performance.now() - start;
        if (elapsed > MAX_PROCESSING_MS) {
          updateDocument(doc.id, { limitApplied: "15s time limit reached." });
          break;
        }

        const page = await pdf.getPage(pageIndex);
        const { text, lines } = await parsePdfPage(page);
        pageProcessed += 1;
        const quality = getQualityTier(text, lines);
        updateDocument(doc.id, {
          processedPages: pageProcessed,
          qualityTier: quality.tier,
          qualityReason: quality.reason,
        });
        setStatusLine(`Parsing document ${docIndex + 1}/${totalDocs} — page ${pageIndex}/${totalPages}`);
        const overall = Math.round(((docIndex + pageIndex / totalPages) / totalDocs) * 100);
        setOverallProgress(overall);

        lines.forEach((line) => {
          const normalizedLine = normalizeWhitespace(line);
          if (!normalizedLine) return;
          lineCounts.set(normalizedLine, (lineCounts.get(normalizedLine) ?? 0) + 1);
          if ((lineCounts.get(normalizedLine) ?? 0) / pageProcessed > 0.3) {
            repeatedLines.add(normalizedLine);
          }
        });

        const filteredLines = lines
          .map((line) => normalizeWhitespace(line))
          .filter((line) => line && !repeatedLines.has(line));
        const dehyphenated = dehyphenate(filteredLines.join("\n"));
        const paragraphs = reconstructParagraphs(dehyphenated.split(/\n+/));
        const chunks = splitIntoChunks(paragraphs.join("\n"));
        const extracted: DecisionCandidate[] = [];

        chunks.forEach((chunk, index) => {
          const trimmed = normalizeWhitespace(chunk);
          if (!trimmed) return;
          const scoring = scoreCandidate(trimmed, strictMode);
          if (strictMode && scoring.bucket !== "signal" && scoring.decisionScore < 45 && !scoring.hasCommitment) {
            return;
          }
          const entities = getEntities(trimmed);
          const signature = buildSignature(trimmed, entities, scoring.timeAnchors);
          extracted.push({
            id: `${doc.id}-${pageIndex}-${index}-${crypto.randomUUID()}`,
            docId: doc.id,
            docLabel: doc.label,
            pageNumber: pageIndex,
            extractedSentence: trimmed,
            triggers: scoring.triggers,
            decisionScore: scoring.decisionScore,
            extractorConfidence: scoring.extractorConfidence,
            candidateType: scoring.candidateType,
            categoryBucket: getCategoryBucket(trimmed),
            timeAnchors: scoring.timeAnchors,
            entities,
            bucket: scoring.bucket,
            status: "unreviewed",
            signature,
            supportingCount: 1,
          });
        });

        candidateCount += extracted.length;
        addCandidates(extracted, mergeAcrossDocs);
      }

      updateDocument(doc.id, { status: "done", processedPages: pageProcessed, candidateCount });
    },
    [addCandidates, mergeAcrossDocs, strictMode, updateDocument],
  );

  const handleExtract = useCallback(async () => {
    if (isProcessing) return;
    const runId = cancelRef.current.runId + 1;
    cancelRef.current = { cancelled: false, runId };
    setIsProcessing(true);
    setCandidates([]);
    setKeptIds(new Set());
    setSignalIds(new Set());
    setIgnoredIds(new Set());
    setStatusLine("Preparing documents...");
    setOverallProgress(0);

    const inputs = [
      ...documentInputs,
      ...(pasteText.trim()
        ? [
            {
              id: crypto.randomUUID(),
              label: "Pasted text",
              sourceType: "text" as const,
            },
          ]
        : []),
    ];

    if (inputs.length === 0) {
      setStatusLine("Add PDFs or paste text to begin.");
      setIsProcessing(false);
      return;
    }

    const progressDocs: DocumentProgress[] = inputs.map((input) => ({
      ...input,
      status: "pending",
      processedPages: 0,
      totalPages: input.sourceType === "pdf" ? 0 : 1,
      candidateCount: 0,
    }));

    setDocuments(progressDocs);

    for (let index = 0; index < progressDocs.length; index += 1) {
      const doc = progressDocs[index];
      if (cancelRef.current.cancelled || cancelRef.current.runId !== runId) return;
      setStatusLine(`Parsing document ${index + 1}/${progressDocs.length}`);
      if (doc.sourceType === "text") {
        await processTextSource(doc, runId, index, progressDocs.length);
      } else {
        try {
          await processPdf(doc, runId, index, progressDocs.length);
        } catch (error) {
          updateDocument(doc.id, { status: "error", error: (error as Error).message ?? "Failed to parse PDF." });
        }
      }
    }

    setStatusLine("Extraction complete.");
    setOverallProgress(100);
    setIsProcessing(false);
  }, [documentInputs, isProcessing, pasteText, processPdf, processTextSource, updateDocument]);

  const keptCandidates = useMemo(
    () => candidates.filter((candidate) => keptIds.has(candidate.id)),
    [candidates, keptIds],
  );

  const highConfidence = candidates.filter((candidate) => candidate.bucket === "high");
  const possibleCandidates = candidates.filter((candidate) => candidate.bucket === "possible");
  const signalCandidates = candidates.filter((candidate) => candidate.bucket === "signal");

  const keptCount = keptCandidates.length;
  const candidateCount = candidates.length;

  const handleCandidateAction = useCallback((id: string, action: CandidateStatus) => {
    setKeptIds((prev) => {
      const next = new Set(prev);
      if (action === "kept") next.add(id);
      else next.delete(id);
      return next;
    });
    setSignalIds((prev) => {
      const next = new Set(prev);
      if (action === "signal") next.add(id);
      else next.delete(id);
      return next;
    });
    setIgnoredIds((prev) => {
      const next = new Set(prev);
      if (action === "ignored") next.add(id);
      else next.delete(id);
      return next;
    });

    if (action === "kept") {
      setSignalIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setIgnoredIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }

    if (action === "signal") {
      setKeptIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setIgnoredIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }

    if (action === "ignored") {
      setKeptIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSignalIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleExportJson = useCallback(() => {
    const timestamp = new Date().toISOString();
    const payload = {
      exportedAt: timestamp,
      context,
      keptDecisions: keptCandidates.map((candidate) => ({
        docId: candidate.docId,
        docLabel: candidate.docLabel,
        pageNumber: candidate.pageNumber,
        extractedSentence: candidate.extractedSentence,
        candidateType: candidate.candidateType,
        categoryBucket: candidate.categoryBucket,
        decisionScore: candidate.decisionScore,
        extractorConfidence: candidate.extractorConfidence,
        triggers: candidate.triggers,
        timeAnchors: candidate.timeAnchors,
        entities: candidate.entities,
        supportingCount: candidate.supportingCount,
      })),
    };
    createDownload(JSON.stringify(payload, null, 2), "kept-decisions.json", "application/json");
  }, [context, keptCandidates]);

  const handleExportCsv = useCallback(() => {
    const timestamp = new Date().toISOString();
    const csv = buildCsv(keptCandidates, timestamp);
    createDownload(csv, "kept-decisions.csv", "text/csv");
  }, [keptCandidates]);

  const summary = useMemo(() => {
    const byType: Record<CandidateType, number> = {
      Commitment: 0,
      Allocation: 0,
      Constraint: 0,
      Direction: 0,
      ExecutionCheckpoint: 0,
    };
    const byCategory: Record<CategoryBucket, number> = {
      Product: 0,
      Capex: 0,
      Platform: 0,
      Ops: 0,
      Other: 0,
    };
    keptCandidates.forEach((candidate) => {
      byType[candidate.candidateType] += 1;
      byCategory[candidate.categoryBucket] += 1;
    });
    return { byType, byCategory };
  }, [keptCandidates]);

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm dark:bg-black/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Document Intake → Decision Candidates</h2>
          <p className="text-xs text-muted-foreground">
            Process PDF pages or pasted text to surface decision candidates. Human confirmation is required before
            anything counts as a decision.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Processed in your browser. Nothing is stored. Refresh = gone.
          </p>
        </div>
        <Badge variant="outline" className="text-[11px]">
          V1 client-only extractor
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4 rounded-xl border border-border/50 bg-muted/10 p-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Intake panel
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Upload PDFs (max 5)</label>
                <Input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(event) => handleFiles(event.target.files)}
                />
                <p className="text-[11px] text-muted-foreground">Each PDF processes up to 30 pages or 15 seconds.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Context</label>
                <Select value={context} onValueChange={(value) => setContext(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select context" />
                  </SelectTrigger>
                  <SelectContent>
                    {contextOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>Strict/Broad mode</span>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[11px]", strictMode ? "text-foreground" : "text-muted-foreground")}>
                      Strict
                    </span>
                    <Switch checked={!strictMode} onCheckedChange={(checked) => setStrictMode(!checked)} />
                    <span className={cn("text-[11px]", !strictMode ? "text-foreground" : "text-muted-foreground")}>
                      Broad
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>Merge across documents</span>
                  <Switch checked={mergeAcrossDocs} onCheckedChange={setMergeAcrossDocs} />
                </div>
              </div>
            </div>
          </div>

          {documentInputs.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-border/60 bg-white/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Document labels
              </p>
              <div className="space-y-2">
                {documentInputs.map((doc) => (
                  <div key={doc.id} className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <span className="text-[11px] text-muted-foreground sm:w-24">PDF</span>
                    <Input
                      value={doc.label}
                      onChange={(event) => handleLabelChange(doc.id, event.target.value)}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Paste text (first-class)</label>
            <Textarea
              placeholder="Paste a memo, summary, or decision brief text here."
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              className="min-h-[140px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleExtract} disabled={isProcessing}>
              Extract Decision Candidates
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={isProcessing && documents.length === 0}>
              Clear
            </Button>
            <div className="text-[11px] text-muted-foreground">
              {documentInputs.length} PDFs · {pasteText.trim() ? "Pasted text ready" : "No text pasted"}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Live processing
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Batch progress</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{statusLine}</p>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Candidates found</Badge>
              <span className="font-semibold text-foreground">{candidateCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Kept decisions</Badge>
              <span className="font-semibold text-foreground">{keptCount}</span>
            </div>
          </div>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-lg border border-border/60 bg-white/80 px-3 py-2 text-[11px] text-muted-foreground"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">{doc.label}</p>
                    <p>
                      {doc.status === "processing"
                        ? `Parsing page ${doc.processedPages}/${doc.totalPages || 1}`
                        : doc.status === "done"
                          ? "Completed"
                          : doc.status === "error"
                            ? "Error"
                            : "Pending"}
                    </p>
                    {doc.limitApplied ? <p className="text-[10px] text-amber-600">{doc.limitApplied}</p> : null}
                  </div>
                  {doc.qualityTier ? (
                    <Badge variant="outline">Tier {doc.qualityTier}</Badge>
                  ) : (
                    <Badge variant="outline">Tier -</Badge>
                  )}
                </div>
                {doc.qualityReason ? <p className="mt-1 text-[10px]">{doc.qualityReason}</p> : null}
                {doc.error ? <p className="mt-1 text-[10px] text-rose-600">{doc.error}</p> : null}
                {doc.status === "done" && doc.candidateCount === 0 ? (
                  <p className="mt-1 text-[10px] text-amber-700">
                    No candidates found. Check document quality or paste text for a cleaner extract.
                  </p>
                ) : null}
              </div>
            ))}
            {documents.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Upload PDFs or paste text to start extraction.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Decision Candidates</h3>
            <p className="text-[11px] text-muted-foreground">
              Confidence is heuristic only. Review each candidate before keeping.
            </p>
          </div>
          {keptCandidates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleExportJson}>
                Export kept decisions (JSON)
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportCsv}>
                Export kept decisions (CSV)
              </Button>
            </div>
          ) : null}
        </div>

        {candidateCount === 0 && documents.length > 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">No decision candidates found yet.</p>
            <p>
              Check PDF quality (scanned/image-heavy text often yields Tier C). Try pasting text directly for a cleaner
              extract.
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          <CandidateSection
            title="High confidence"
            subtitle="High-confidence commitments, constraints, or allocations."
            candidates={highConfidence}
            keptIds={keptIds}
            signalIds={signalIds}
            ignoredIds={ignoredIds}
            onAction={handleCandidateAction}
            defaultOpen
          />
          <CandidateSection
            title="Possible candidates"
            subtitle="Potential decision candidates that need review."
            candidates={possibleCandidates}
            keptIds={keptIds}
            signalIds={signalIds}
            ignoredIds={ignoredIds}
            onAction={handleCandidateAction}
          />
          <CandidateSection
            title="Signals (belief/outlook)"
            subtitle="Signals are belief statements and outlooks, not confirmed decisions."
            candidates={signalCandidates}
            keptIds={keptIds}
            signalIds={signalIds}
            ignoredIds={ignoredIds}
            onAction={handleCandidateAction}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-4">
          <h4 className="text-sm font-semibold text-foreground">Kept Decisions</h4>
          {keptCandidates.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No kept decisions yet. Use ✅ Keep to confirm.</p>
          ) : (
            <div className="space-y-2">
              {keptCandidates.map((candidate) => (
                <div key={candidate.id} className="rounded-lg border border-border/60 bg-white/80 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">{candidate.extractedSentence}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {candidate.docLabel} · Page {candidate.pageNumber} · {candidate.candidateType}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {keptCandidates.length >= 3 ? (
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Session Summary</h4>
              <p className="text-[11px] text-muted-foreground">
                These are signals. Interpretation requires context. Guided analysis begins here.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <Badge variant="outline">Total kept: {keptCandidates.length}</Badge>
            </div>
            <div className="space-y-2 text-[11px] text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground">By candidate type</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(summary.byType).map(([label, value]) => (
                    <Badge key={label} variant="outline">
                      {label}: {value}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground">By category</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(summary.byCategory).map(([label, value]) => (
                    <Badge key={label} variant="outline">
                      {label}: {value}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <Button asChild>
              <a href="/contact">Book a diagnostic session</a>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-[11px] text-muted-foreground">
            Keep at least 3 decision candidates to see the Session Summary and consultation CTA.
          </div>
        )}
      </div>
    </section>
  );
}

function CandidateSection({
  title,
  subtitle,
  candidates,
  keptIds,
  signalIds,
  ignoredIds,
  onAction,
  defaultOpen = false,
}: {
  title: string;
  subtitle: string;
  candidates: DecisionCandidate[];
  keptIds: Set<string>;
  signalIds: Set<string>;
  ignoredIds: Set<string>;
  onAction: (id: string, action: CandidateStatus) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <Badge variant="outline">{candidates.length}</Badge>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          {candidates.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No candidates in this section yet.</p>
          ) : null}
          {candidates.map((candidate) => (
            <div key={candidate.id} className="rounded-lg border border-border/60 bg-white/90 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{candidate.extractedSentence}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {candidate.docLabel} · Page {candidate.pageNumber}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline">{candidate.candidateType}</Badge>
                  <Badge variant="outline">{candidate.categoryBucket}</Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {candidate.triggers.map((trigger) => (
                  <Badge key={trigger} variant="secondary">
                    {trigger}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>
                  Decision Score: <span className="font-semibold text-foreground">{candidate.decisionScore}</span>
                </span>
                <span>
                  Extractor Confidence:{" "}
                  <span className="font-semibold text-foreground">{candidate.extractorConfidence}</span>
                </span>
                {candidate.supportingCount > 1 ? (
                  <span className="text-[10px] text-muted-foreground">
                    Merged ×{candidate.supportingCount}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={keptIds.has(candidate.id) ? "default" : "outline"}
                  onClick={() => onAction(candidate.id, "kept")}
                >
                  ✅ Keep
                </Button>
                <Button
                  size="sm"
                  variant={signalIds.has(candidate.id) ? "default" : "outline"}
                  onClick={() => onAction(candidate.id, "signal")}
                >
                  🟡 Mark as Signal
                </Button>
                <Button
                  size="sm"
                  variant={ignoredIds.has(candidate.id) ? "destructive" : "outline"}
                  onClick={() => onAction(candidate.id, "ignored")}
                >
                  🚫 Ignore
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
