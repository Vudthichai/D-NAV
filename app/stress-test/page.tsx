"use client";

import StressTestCalculator, {
  StressTestCalculatorHandle,
  type StressTestDecisionSnapshot,
} from "@/components/stress-test/StressTestCalculator";
import { useDefinitionsPanel } from "@/components/definitions/DefinitionsPanelProvider";
import { Button } from "@/components/ui/button";
import { AccentSliver } from "@/components/ui/AccentSliver";
import { Callout } from "@/components/ui/Callout";
import { MetricDistribution, type MetricDistributionSegment } from "@/components/reports/MetricDistribution";
import { getSessionActionInsight } from "@/lib/sessionActionInsight";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  localExtractDecisionCandidates,
  type DecisionCandidateDraft,
  type PageText,
} from "@/lib/decisionExtract/localExtract";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ExtractedPage {
  pageNumber: number;
  text: string;
  charCount: number;
}

type LocalDecisionCandidate = DecisionCandidateDraft;

interface SessionDecision {
  id: string;
  decisionTitle: string;
  decisionDetail?: string;
  category: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
  r: number;
  p: number;
  s: number;
  dnav: number;
  sourceFile?: string;
  sourcePage?: number;
  excerpt?: string;
  sourceType?: "manual" | "intake";
  createdAt: number;
}

const SESSION_DECISIONS_KEY = "dnav:stressTest:sessionDecisions";

const LOCAL_EXTRACTION_NOTICE = "Local extraction (fast). Edit before saving.";
const CATEGORY_OPTIONS: Array<DecisionCandidateDraft["category"]> = [
  "Operations",
  "Finance",
  "Product",
  "Hiring",
  "Legal",
  "Strategy",
  "Sales/Go-to-market",
  "Other",
];

const isSessionDecisionSnapshot = (value: unknown): value is SessionDecision => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SessionDecision>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.decisionTitle === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.r === "number" &&
    typeof candidate.p === "number" &&
    typeof candidate.s === "number" &&
    typeof candidate.dnav === "number"
  );
};

export default function StressTestPage() {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [extractedPages, setExtractedPages] = useState<ExtractedPage[]>([]);
  const [pagesRead, setPagesRead] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [decisionCandidates, setDecisionCandidates] = useState<LocalDecisionCandidate[]>([]);
  const [sessionExtractedDecisions, setSessionExtractedDecisions] = useState<LocalDecisionCandidate[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractStage, setExtractStage] = useState<"idle" | "finding" | "refining" | "done">("idle");
  const [refineNotice, setRefineNotice] = useState<string | null>(null);
  const [autoExtractPending, setAutoExtractPending] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [toastNotice, setToastNotice] = useState<{
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [sessionDecisions, setSessionDecisions] = useState<SessionDecision[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.sessionStorage.getItem(SESSION_DECISIONS_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      return Array.isArray(parsed) ? parsed.filter(isSessionDecisionSnapshot) : [];
    } catch (error) {
      console.error("Failed to load stress test session decisions.", error);
      return [];
    }
  });
  const calculatorRef = useRef<StressTestCalculatorHandle>(null);
  const [isSessionAnalysisOpen, setIsSessionAnalysisOpen] = useState(false);
  const sessionAnalysisRef = useRef<HTMLDivElement>(null);
  const [editingDecision, setEditingDecision] = useState<SessionDecision | null>(null);
  const [editDraft, setEditDraft] = useState<{
    id: string;
    decisionTitle: string;
    category: string;
    impact: number;
    cost: number;
    risk: number;
    urgency: number;
    confidence: number;
  } | null>(null);

  const { openDefinitions } = useDefinitionsPanel();

  useEffect(() => {
    if (!toastNotice) return;
    const timeout = window.setTimeout(() => setToastNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toastNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionDecisions.length === 0) {
        window.sessionStorage.removeItem(SESSION_DECISIONS_KEY);
      } else {
        window.sessionStorage.setItem(SESSION_DECISIONS_KEY, JSON.stringify(sessionDecisions));
      }
    } catch (error) {
      console.error("Failed to persist stress test session decisions.", error);
    }
  }, [sessionDecisions]);

  const TOP_PICK_LIMIT = 15;

  const handleSaveSessionDecision = useCallback((decision: StressTestDecisionSnapshot) => {
    const title = decision.name?.trim() || "Untitled decision";
    const sessionDecision: SessionDecision = {
      id: decision.id,
      decisionTitle: title,
      decisionDetail: "",
      category: decision.category,
      impact: decision.impact,
      cost: decision.cost,
      risk: decision.risk,
      urgency: decision.urgency,
      confidence: decision.confidence,
      r: decision.return,
      p: decision.pressure,
      s: decision.stability,
      dnav: decision.dnav,
      sourceType: "manual",
      createdAt: decision.createdAt,
    };
    setSessionDecisions((prev) => [sessionDecision, ...prev]);
  }, []);

  const decisionCount = sessionDecisions.length;
  const progressCount = Math.min(decisionCount, 10);
  const canOpenSessionAnalysis = decisionCount >= 10;

  const sessionStats = useMemo(() => {
    if (sessionDecisions.length === 0) {
      return {
        avgImpact: 0,
        avgCost: 0,
        avgRisk: 0,
        avgUrgency: 0,
        avgConfidence: 0,
        avgReturn: 0,
        avgPressure: 0,
        avgStability: 0,
        avgDnav: 0,
      };
    }

    const totals = sessionDecisions.reduce(
      (acc, decision) => {
        acc.impact += decision.impact;
        acc.cost += decision.cost;
        acc.risk += decision.risk;
        acc.urgency += decision.urgency;
        acc.confidence += decision.confidence;
        acc.return += decision.r;
        acc.pressure += decision.p;
        acc.stability += decision.s;
        acc.dnav += decision.dnav;
        return acc;
      },
      { impact: 0, cost: 0, risk: 0, urgency: 0, confidence: 0, return: 0, pressure: 0, stability: 0, dnav: 0 },
    );

    const count = sessionDecisions.length;
    return {
      avgImpact: totals.impact / count,
      avgCost: totals.cost / count,
      avgRisk: totals.risk / count,
      avgUrgency: totals.urgency / count,
      avgConfidence: totals.confidence / count,
      avgReturn: totals.return / count,
      avgPressure: totals.pressure / count,
      avgStability: totals.stability / count,
      avgDnav: totals.dnav / count,
    };
  }, [sessionDecisions]);

  const sessionBuckets = useMemo(() => {
    const buckets = {
      return: { Positive: 0, Neutral: 0, Negative: 0 },
      pressure: { Pressured: 0, Neutral: 0, Calm: 0 },
      stability: { Stable: 0, Neutral: 0, Fragile: 0 },
    };

    sessionDecisions.forEach((decision) => {
      if (decision.r > 0) buckets.return.Positive += 1;
      else if (decision.r < 0) buckets.return.Negative += 1;
      else buckets.return.Neutral += 1;

      if (decision.p > 0) buckets.pressure.Pressured += 1;
      else if (decision.p < 0) buckets.pressure.Calm += 1;
      else buckets.pressure.Neutral += 1;

      if (decision.s > 0) buckets.stability.Stable += 1;
      else if (decision.s < 0) buckets.stability.Fragile += 1;
      else buckets.stability.Neutral += 1;
    });

    return buckets;
  }, [sessionDecisions]);

  const sessionDistributions = useMemo(() => {
    const total = sessionDecisions.length;
    const toPct = (value: number) => (total > 0 ? (value / total) * 100 : 0);

    const returnSegments: MetricDistributionSegment[] = [
      { label: "Positive", value: toPct(sessionBuckets.return.Positive), colorClass: "bg-emerald-500" },
      { label: "Neutral", value: toPct(sessionBuckets.return.Neutral), colorClass: "bg-muted" },
      { label: "Negative", value: toPct(sessionBuckets.return.Negative), colorClass: "bg-rose-500" },
    ];

    const pressureSegments: MetricDistributionSegment[] = [
      { label: "Pressured", value: toPct(sessionBuckets.pressure.Pressured), colorClass: "bg-amber-500" },
      { label: "Neutral", value: toPct(sessionBuckets.pressure.Neutral), colorClass: "bg-muted" },
      { label: "Calm", value: toPct(sessionBuckets.pressure.Calm), colorClass: "bg-sky-500" },
    ];

    const stabilitySegments: MetricDistributionSegment[] = [
      { label: "Stable", value: toPct(sessionBuckets.stability.Stable), colorClass: "bg-emerald-600" },
      { label: "Neutral", value: toPct(sessionBuckets.stability.Neutral), colorClass: "bg-muted" },
      { label: "Fragile", value: toPct(sessionBuckets.stability.Fragile), colorClass: "bg-rose-500" },
    ];

    return {
      returnSegments,
      pressureSegments,
      stabilitySegments,
      pressurePressuredPct: toPct(sessionBuckets.pressure.Pressured),
      stabilityFragilePct: toPct(sessionBuckets.stability.Fragile),
    };
  }, [sessionBuckets, sessionDecisions.length]);

  const sessionDirective = useMemo(
    () =>
      getSessionActionInsight({
        avgReturn: sessionStats.avgReturn,
        avgPressure: sessionStats.avgPressure,
        avgStability: sessionStats.avgStability,
        avgRisk: sessionStats.avgRisk,
        avgConfidence: sessionStats.avgConfidence,
      }),
    [
      sessionStats.avgConfidence,
      sessionStats.avgPressure,
      sessionStats.avgReturn,
      sessionStats.avgRisk,
      sessionStats.avgStability,
    ],
  );

  const sessionActionOutput = useMemo(() => {
    if (sessionDecisions.length === 0) {
      return {
        callout: "Action Insight will appear once a few decisions are logged.",
        invitation: "Log one decision to surface a pressure pattern.",
        note: null,
      };
    }

    if (sessionStats.avgUrgency - sessionStats.avgConfidence >= 1) {
      return {
        callout: "Urgency is leading confidence across the session.",
        invitation: "Left unchecked, this pattern scales risk faster than impact.",
        note: null,
      };
    }

    if (sessionStats.avgReturn > 0 && sessionStats.avgStability < 0.5) {
      return {
        callout: "Returns lead, but stability is lagging across the session.",
        invitation: "Left unchecked, this pattern compounds risk faster than resilience.",
        note: null,
      };
    }

    if (sessionStats.avgImpact - sessionStats.avgConfidence >= 1) {
      return {
        callout: "Impact is leading, while confidence is lagging across the session.",
        invitation: "Left unchecked, this pattern stretches execution beyond evidence.",
        note: null,
      };
    }

    if (sessionStats.avgReturn <= 0 || sessionStats.avgPressure > 1) {
      return {
        callout: "Pressure is rising while return is muted across the session.",
        invitation: "Left unchecked, this pattern limits upside while drag compounds.",
        note: null,
      };
    }

    return {
      callout: "Confidence, pressure, and return are aligned across the session.",
      invitation: "Left unchecked, this pattern can drift if urgency spikes.",
      note: "Aligned signals can still hide emerging pressure without guided review.",
    };
  }, [
    sessionDecisions.length,
    sessionStats.avgConfidence,
    sessionStats.avgImpact,
    sessionStats.avgPressure,
    sessionStats.avgReturn,
    sessionStats.avgStability,
    sessionStats.avgUrgency,
  ]);

  const formatCompact = useCallback((value: number, digits = 0) => {
    if (!Number.isFinite(value)) return "0";
    return value.toFixed(digits);
  }, []);

  const formatSignal = useCallback((value: number) => {
    if (!Number.isFinite(value)) return "0";
    const formatted = value.toFixed(1).replace(/\.0$/, "");
    if (value > 0) return `+${formatted}`;
    return formatted;
  }, []);

  const handleClearSession = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.confirm("Clear saved session decisions?")) return;
    setSessionDecisions([]);
    setIsSessionAnalysisOpen(false);
    calculatorRef.current?.resetSavedState();
    try {
      window.sessionStorage.removeItem(SESSION_DECISIONS_KEY);
    } catch (error) {
      console.error("Failed to clear stress test session decisions.", error);
    }
  }, []);

  const handleToggleSessionAnalysis = useCallback(() => {
    const nextOpen = !isSessionAnalysisOpen;
    setIsSessionAnalysisOpen(nextOpen);
    if (nextOpen) {
      requestAnimationFrame(() => {
        sessionAnalysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [isSessionAnalysisOpen]);

  const handleExportSessionCsv = useCallback(() => {
    if (typeof window === "undefined") return;
    const headers = [
      "Decision",
      "Impact",
      "Cost",
      "Risk",
      "Urgency",
      "Confidence",
      "SourceFile",
      "Page",
    ];
    const escapeCell = (value: string | number | undefined) => {
      const text = value === undefined || value === null ? "" : String(value);
      const escaped = text.replace(/"/g, '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    };
    const rows = sessionDecisions.map((decision) => [
      decision.decisionTitle,
      decision.impact,
      decision.cost,
      decision.risk,
      decision.urgency,
      decision.confidence,
      decision.sourceFile ?? "",
      decision.sourcePage ?? "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dnav-session-decisions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [sessionDecisions]);

  const handlePdfUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFileName(file?.name ?? null);
    setExtractedPages([]);
    setPagesRead(0);
    setTotalChars(0);
    setDecisionCandidates([]);
    setSessionExtractedDecisions([]);
    setExtractError(null);
    setShowAllCandidates(false);
    if (!file) return;
    if (file.type !== "application/pdf") {
      setExtractError("Please upload a PDF file.");
      return;
    }

    setIsReadingPdf(true);
    try {
      const pdfjsLib = (await import("pdfjs-dist")) as typeof import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const buffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      const pages: ExtractedPage[] = [];
      let charCount = 0;

      for (let index = 1; index <= pdf.numPages; index += 1) {
        const page = await pdf.getPage(index);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => {
            if (!("str" in item)) return "";
            const suffix = (item as { hasEOL?: boolean }).hasEOL ? "\n" : " ";
            return `${item.str}${suffix}`;
          })
          .join("")
          .replace(/[ \t]+\n/g, "\n")
          .replace(/[ \t]{2,}/g, " ")
          .replace(/\n{2,}/g, "\n")
          .trim();
        const pageCharCount = text.length;
        pages.push({ pageNumber: index, text, charCount: pageCharCount });
        charCount += pageCharCount;
      }

      setExtractedPages(pages);
      setPagesRead(pages.length);
      setTotalChars(charCount);
      setDecisionCandidates([]);
      setDismissedIds(new Set());
      setShowAllCandidates(false);
      setRefineNotice(null);
      setAutoExtractPending(true);
      const emptyPages = pages.filter((page) => page.charCount === 0).length;
      if (pages.length > 0 && emptyPages / pages.length >= 0.5) {
        setExtractError("This PDF appears image-based; quick scan needs selectable text.");
      }
    } catch (error) {
      console.error("Failed to read PDF.", error);
      setExtractError("Failed to read the PDF. Please try a different file.");
    } finally {
      setIsReadingPdf(false);
    }
  }, []);

  const handleExtractDecisions = useCallback(async () => {
    if (extractedPages.length === 0 || isExtracting) return;
    setIsExtracting(true);
    setExtractError(null);
    setRefineNotice(null);
    setExtractStage("finding");
    setDismissedIds(new Set());
    setShowAllCandidates(false);
    setDecisionCandidates([]);
    const refineTimer = window.setTimeout(() => setExtractStage("refining"), 1200);
    try {
      const pages: PageText[] = extractedPages.map((page) => ({ page: page.pageNumber, text: page.text }));
      const candidates = localExtractDecisionCandidates(pages, { maxCandidates: 25, minScore: 6 });
      setDecisionCandidates(candidates);
      setRefineNotice(null);
      setExtractStage("done");
    } catch (error) {
      console.error("Decision extraction error.", error);
      setExtractError("Decision extraction failed. Please retry or try a different PDF.");
      setExtractStage("done");
    } finally {
      window.clearTimeout(refineTimer);
      setExtractStage("done");
      setIsExtracting(false);
      setAutoExtractPending(false);
    }
  }, [extractedPages, isExtracting, selectedFileName]);

  useEffect(() => {
    if (!autoExtractPending) return;
    if (isReadingPdf || isExtracting || extractedPages.length === 0) return;
    handleExtractDecisions();
  }, [autoExtractPending, extractedPages.length, handleExtractDecisions, isExtracting, isReadingPdf]);

  const scrollToDecision = useCallback((decisionId: string) => {
    const row = document.getElementById(`decision-row-${decisionId}`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("ring-2", "ring-primary/50");
    window.setTimeout(() => row.classList.remove("ring-2", "ring-primary/50"), 1600);
  }, []);

  const handleAddToSession = useCallback(
    (candidate: LocalDecisionCandidate) => {
      const title = candidate.title.trim() || "Untitled decision";
      let nextTotal = 0;
      let added = false;
      const decisionId = `extract-${candidate.id}`;
      setSessionDecisions((prev) => {
        if (prev.some((decision) => decision.id === decisionId)) {
          nextTotal = prev.length;
          return prev;
        }
        const sessionDecision: SessionDecision = {
          id: decisionId,
          decisionTitle: title,
          decisionDetail: candidate.decision,
          category: candidate.category || "Strategy",
          impact: 0,
          cost: 0,
          risk: 0,
          urgency: 0,
          confidence: 0,
          r: 0,
          p: 0,
          s: 0,
          dnav: 0,
          sourceFile: selectedFileName ?? undefined,
          sourcePage: candidate.evidence.page || undefined,
          excerpt: candidate.evidence.quote || undefined,
          sourceType: "intake",
          createdAt: Date.now(),
        };
        added = true;
        nextTotal = prev.length + 1;
        return [sessionDecision, ...prev];
      });
      setSessionExtractedDecisions((prev) => {
        if (prev.some((item) => item.id === candidate.id)) return prev;
        return [candidate, ...prev];
      });
      if (added) {
        setToastNotice({
          message: `Added to session (${nextTotal} total)`,
          actionLabel: "Jump to decision",
          onAction: () => scrollToDecision(decisionId),
        });
      }
    },
    [scrollToDecision, selectedFileName],
  );

  const handleAddMultiple = useCallback(
    (candidates: LocalDecisionCandidate[]) => {
      if (candidates.length === 0) return;
      let addedCount = 0;
      let nextTotal = 0;
      let lastAdded: string | null = null;
      setSessionDecisions((prev) => {
        const existingIds = new Set(prev.map((decision) => decision.id));
        const additions: SessionDecision[] = [];
        candidates.forEach((candidate) => {
          const id = `extract-${candidate.id}`;
          if (existingIds.has(id)) return;
          const title = candidate.title.trim() || "Untitled decision";
          additions.push({
            id,
            decisionTitle: title,
            decisionDetail: candidate.decision,
            category: candidate.category || "Strategy",
            impact: 0,
            cost: 0,
            risk: 0,
            urgency: 0,
            confidence: 0,
            r: 0,
            p: 0,
            s: 0,
            dnav: 0,
            sourceFile: selectedFileName ?? undefined,
            sourcePage: candidate.evidence.page || undefined,
            excerpt: candidate.evidence.quote || undefined,
            sourceType: "intake",
            createdAt: Date.now(),
          });
          lastAdded = id;
        });
        addedCount = additions.length;
        if (additions.length === 0) return prev;
        nextTotal = prev.length + additions.length;
        return [...additions, ...prev];
      });
      setSessionExtractedDecisions((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const next = [...prev];
        candidates.forEach((candidate) => {
          if (existing.has(candidate.id)) return;
          next.unshift(candidate);
          existing.add(candidate.id);
        });
        return next;
      });
      if (addedCount > 0) {
        setToastNotice({
          message: `Added ${addedCount} to session (${nextTotal} total)`,
          actionLabel: "Jump to decision",
          onAction: () => (lastAdded ? scrollToDecision(lastAdded) : undefined),
        });
      }
    },
    [scrollToDecision, selectedFileName],
  );

  const handleDismissCandidate = useCallback((candidate: LocalDecisionCandidate) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(candidate.id);
      return next;
    });
    setToastNotice({
      message: "Candidate dismissed",
      actionLabel: "Undo",
      onAction: () =>
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.delete(candidate.id);
          return next;
        }),
    });
  }, []);

  const handleDismissAll = useCallback((candidates: LocalDecisionCandidate[]) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      candidates.forEach((candidate) => next.add(candidate.id));
      return next;
    });
  }, []);

  const handleOpenEditDialog = useCallback((decision: SessionDecision) => {
    setEditingDecision(decision);
    setEditDraft({
      id: decision.id,
      decisionTitle: decision.decisionTitle,
      category: decision.category,
      impact: decision.impact,
      cost: decision.cost,
      risk: decision.risk,
      urgency: decision.urgency,
      confidence: decision.confidence,
    });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editDraft) return;
    setSessionDecisions((prev) =>
      prev.map((decision) =>
        decision.id === editDraft.id
          ? {
              ...decision,
              decisionTitle: editDraft.decisionTitle.trim() || decision.decisionTitle,
              category: editDraft.category.trim() || decision.category,
              impact: editDraft.impact,
              cost: editDraft.cost,
              risk: editDraft.risk,
              urgency: editDraft.urgency,
              confidence: editDraft.confidence,
            }
          : decision,
      ),
    );
    setEditingDecision(null);
    setEditDraft(null);
  }, [editDraft]);

  const rankedCandidates = useMemo(() => {
    return [...decisionCandidates].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.evidence.page !== b.evidence.page) return a.evidence.page - b.evidence.page;
      return a.title.localeCompare(b.title);
    });
  }, [decisionCandidates]);

  const filteredCandidates = useMemo(() => {
    return rankedCandidates.filter((candidate) => !dismissedIds.has(candidate.id));
  }, [dismissedIds, rankedCandidates]);

  const visibleCandidates = useMemo(() => {
    return showAllCandidates ? filteredCandidates : filteredCandidates.slice(0, TOP_PICK_LIMIT);
  }, [filteredCandidates, showAllCandidates, TOP_PICK_LIMIT]);

  const addedIds = useMemo(() => {
    return new Set(sessionExtractedDecisions.map((candidate) => candidate.id));
  }, [sessionExtractedDecisions]);
  const hasMoreCandidates = filteredCandidates.length > TOP_PICK_LIMIT;

  // TODO: Rebuild Decision Intake v2
  // Intake will be redesigned around the Decision Atom:
  // Actor + Action + Object + Constraint

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#f6f3ee] text-slate-900 dark:bg-[#050608] dark:text-white">
        <section className="bg-gradient-to-b from-[#f8f5f1] via-white to-[#f3efe8] dark:from-[#050608] dark:via-black/40 dark:to-[#050608]">
          <div className="mx-auto max-w-6xl space-y-3 px-4 pb-4 pt-3 md:px-6">
            <div className="flex flex-col gap-2 border-b border-border/60 pb-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold text-foreground">Stress Test</h1>
                  <p className="text-sm font-semibold text-foreground">See the shape of your decision in review.</p>
                  <p className="text-sm text-muted-foreground">Run a guided diagnostic on a decision and capture the signal.</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => openDefinitions(event.currentTarget)}
                      className="font-semibold"
                    >
                      Definitions
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <StressTestCalculator ref={calculatorRef} saveLabel="Save decision" onSaveDecision={handleSaveSessionDecision} />

            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-foreground">
                <span>
                  {decisionCount >= 10
                    ? "10/10 decisions logged — signal unlocked"
                    : `${decisionCount}/10 decisions logged`}
                </span>
                <div className="flex flex-col items-end gap-1 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Session progress</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-semibold uppercase tracking-wide"
                      onClick={handleClearSession}
                      disabled={decisionCount === 0}
                    >
                      Clear session
                    </Button>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer text-[11px] font-medium text-muted-foreground underline underline-offset-2">
                        What does this mean?
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[240px]">
                      Session Analysis shows how your decisions behave under pressure during review, before hindsight distorts them.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all"
                  style={{ width: `${progressCount * 10}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {decisionCount >= 10
                  ? `Session insight is based on these ${decisionCount} decisions. More decisions sharpen the signal.`
                  : "Insight unlocks at 10 decisions. More decisions sharpen the signal."}
              </p>
              <p className="text-[11px] text-muted-foreground">Session-only. Nothing is saved.</p>

              {decisionCount > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[720px] space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      These are live decisions captured in-the-moment for review — before outcomes rewrite the story.
                    </p>
                    <div className="grid grid-cols-[minmax(180px,1.6fr)_repeat(5,minmax(48px,0.5fr))_repeat(3,minmax(40px,0.4fr))_minmax(56px,0.5fr)_minmax(64px,0.6fr)] items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Decision</span>
                      <span className="text-center">Impact</span>
                      <span className="text-center">Cost</span>
                      <span className="text-center">Risk</span>
                      <span className="text-center">Urgency</span>
                      <span className="text-center">Confidence</span>
                      <span className="text-center">R</span>
                      <span className="text-center">P</span>
                      <span className="text-center">S</span>
                      <span className="text-right">D-NAV</span>
                      <span className="text-right">Edit</span>
                    </div>
                    {sessionDecisions.map((decision) => (
                      <div
                        key={decision.id}
                        id={`decision-row-${decision.id}`}
                        className="grid cursor-pointer grid-cols-[minmax(180px,1.6fr)_repeat(5,minmax(48px,0.5fr))_repeat(3,minmax(40px,0.4fr))_minmax(56px,0.5fr)_minmax(64px,0.6fr)] items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-1 text-[11px] text-muted-foreground transition hover:border-border/70 hover:bg-muted/20"
                        onClick={() => handleOpenEditDialog(decision)}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-foreground">{decision.decisionTitle}</p>
                            {decision.sourceType === "intake" &&
                            [decision.impact, decision.cost, decision.risk, decision.urgency, decision.confidence].every(
                              (value) => value === 0,
                            ) ? (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                                Needs scoring
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-[10px] text-muted-foreground">{decision.category}</p>
                        </div>
                        <span className="text-center tabular-nums">{formatCompact(decision.impact)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.cost)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.risk)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.urgency)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.confidence)}</span>
                        <span className="text-center tabular-nums">{formatSignal(decision.r)}</span>
                        <span className="text-center tabular-nums">{formatSignal(decision.p)}</span>
                        <span className="text-center tabular-nums">{formatSignal(decision.s)}</span>
                        <span className="text-right font-semibold text-foreground tabular-nums">
                          {formatCompact(decision.dnav, 1)}
                        </span>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] font-semibold uppercase tracking-wide"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenEditDialog(decision);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                      onClick={handleToggleSessionAnalysis}
                    >
                      {isSessionAnalysisOpen ? "CLOSE SESSION ANALYSIS" : "OPEN SESSION ANALYSIS"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canOpenSessionAnalysis ? (
                  <TooltipContent side="top">Log 10 decisions to unlock session analysis.</TooltipContent>
                ) : null}
              </Tooltip>
            </div>

            {isSessionAnalysisOpen ? (
              <div
                ref={sessionAnalysisRef}
                className="dnav-dark-glass-surface space-y-4 rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">
                      Session Analysis — Your Judgment Under Pressure
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      A pattern-level readout of how you make decisions before outcomes intervene.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      In guided consulting sessions, we review many decisions to surface the real variables — and
                      understand the physics of judgment under pressure.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right text-[11px] text-muted-foreground">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs font-semibold uppercase tracking-wide"
                      onClick={() => setIsSessionAnalysisOpen(false)}
                    >
                      Collapse
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[10px] font-semibold uppercase tracking-wide"
                      onClick={handleExportSessionCsv}
                    >
                      Export to Excel (.csv)
                    </Button>
                  </div>
                </div>

                {!canOpenSessionAnalysis ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700">
                    Need 10 kept decisions to unlock insights. Keep decisions in intake to build the session signal.
                  </div>
                ) : null}

                {canOpenSessionAnalysis ? (
                  <>
                    <Callout
                      label={
                        <>
                          <AccentSliver />
                          <span>Session Insight</span>
                        </>
                      }
                      labelClassName="flex items-center gap-2 text-muted-foreground"
                      bodyClassName="text-foreground"
                      className="dnav-dark-glass-surface dnav-insight-callout dnav-session-insight-callout"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{sessionActionOutput.callout}</p>
                          <p className="text-[11px] text-muted-foreground">{sessionDirective}</p>
                          {sessionActionOutput.note ? (
                            <p className="text-[11px] text-muted-foreground">{sessionActionOutput.note}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2 text-[11px] text-muted-foreground md:max-w-[220px] md:items-end md:text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Next step</p>
                          <p>Review 10–20 decisions live and tune the variables.</p>
                          <Button asChild size="sm" className="h-8 px-3 text-[11px]">
                            <Link href="/contact">Book a Decision Review</Link>
                          </Button>
                        </div>
                      </div>
                    </Callout>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Decisions", value: decisionCount.toString() },
                        { label: "D-NAV", value: sessionStats.avgDnav.toFixed(1) },
                        { label: "Return", value: sessionStats.avgReturn.toFixed(1) },
                        { label: "Pressure", value: sessionStats.avgPressure.toFixed(1) },
                        { label: "Stability", value: sessionStats.avgStability.toFixed(1) },
                      ].map((pill) => (
                        <div
                          key={pill.label}
                          className="flex h-9 w-full items-center justify-between gap-3 rounded-full border border-border/40 bg-muted/10 px-3 text-[11px] sm:w-auto"
                        >
                          <span className="font-semibold uppercase tracking-wide text-muted-foreground">{pill.label}</span>
                          <span className="text-sm font-semibold text-foreground tabular-nums">{pill.value}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Decision posture distribution (this is what repeats when stakes rise)
                    </p>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-1.5">
                        <MetricDistribution metricLabel="Return distribution" segments={sessionDistributions.returnSegments} />
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-1.5">
                        <MetricDistribution
                          metricLabel="Pressure distribution"
                          segments={sessionDistributions.pressureSegments}
                        />
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-1.5">
                        <MetricDistribution
                          metricLabel="Stability distribution"
                          segments={sessionDistributions.stabilitySegments}
                        />
                      </div>
                    </div>
                    <a
                      href="/mockups/John-Smith%27s-Company.pdf"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block rounded-md text-left transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:-translate-y-0.5 focus-visible:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="text-sm font-semibold text-foreground">Download Sample Decision Brief →</div>
                      <p className="text-[11px] text-muted-foreground">
                        A real pre-commitment consulting deliverable (PDF).
                      </p>
                    </a>
                    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                        WANT TO GO DEEPER?
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Live decisions tell the truth. In guided sessions, teams use D-NAV to surface blind spots before
                        outcomes create hindsight bias.
                      </p>
                      <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0 text-[11px]">
                        <Link href="/scenarios">Explore Scenarios →</Link>
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm">
              <div className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Decision Extract</h2>
                    <p className="text-xs text-muted-foreground">
                      Upload a PDF. We’ll pull out decision candidates (commitments, launches, build/ramp statements,
                      planned actions).
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Upload PDF</p>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedFileName ? `Selected: ${selectedFileName}` : "Choose a PDF to extract per-page text."}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                    <span>Pages read: {pagesRead}</span>
                    <span>Total chars: {totalChars.toLocaleString()}</span>
                    {isReadingPdf ? <span className="font-semibold text-foreground">Reading PDF…</span> : null}
                    {isExtracting && extractStage === "finding" ? (
                      <span className="font-semibold text-foreground">Finding decision candidates…</span>
                    ) : null}
                    {isExtracting && extractStage === "refining" ? (
                      <span className="font-semibold text-foreground">Refining (optional)…</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[11px] text-emerald-600">{LOCAL_EXTRACTION_NOTICE}</p>
                  {refineNotice ? (
                    <p className="mt-2 text-[11px] text-amber-600">{refineNotice}</p>
                  ) : null}
                  {extractError ? <p className="mt-2 text-[11px] text-rose-500">{extractError}</p> : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                    onClick={handleExtractDecisions}
                    disabled={extractedPages.length === 0 || isReadingPdf || isExtracting}
                  >
                    {isExtracting ? "Extracting…" : "Extract decisions"}
                  </Button>
                </div>

                {decisionCandidates.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          Decisions detected <span className="text-muted-foreground">({decisionCandidates.length})</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {showAllCandidates ? "Showing all picks." : `Showing top ${TOP_PICK_LIMIT} picks.`}
                        </p>
                        <p className="text-[11px] text-emerald-600">{LOCAL_EXTRACTION_NOTICE}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
                          onClick={() => handleAddMultiple(visibleCandidates)}
                          disabled={visibleCandidates.length === 0}
                        >
                          ADD ALL (SHOWN)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
                          onClick={() => handleDismissAll(visibleCandidates)}
                          disabled={visibleCandidates.length === 0}
                        >
                          DISMISS ALL
                        </Button>
                        {hasMoreCandidates && !showAllCandidates ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
                            onClick={() => setShowAllCandidates(true)}
                          >
                            SHOW MORE
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {visibleCandidates.map((candidate) => {
                        const isAdded = addedIds.has(candidate.id);
                        return (
                          <div
                            key={candidate.id}
                            className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-xs text-muted-foreground"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Title
                                </p>
                                <Input
                                  value={candidate.title}
                                  onChange={(event) => {
                                    const next = event.target.value;
                                    setDecisionCandidates((prev) =>
                                      prev.map((item) =>
                                        item.id === candidate.id ? { ...item, title: next } : item,
                                      ),
                                    );
                                  }}
                                  className="h-8 text-sm"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                  {candidate.evidence.page ? `p. ${candidate.evidence.page}` : "Page n/a"}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Decision
                              </p>
                              <Textarea
                                value={candidate.decision}
                                onChange={(event) => {
                                  const next = event.target.value;
                                  setDecisionCandidates((prev) =>
                                    prev.map((item) =>
                                      item.id === candidate.id ? { ...item, decision: next } : item,
                                    ),
                                  );
                                }}
                                className="min-h-[84px] text-[11px]"
                              />
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="space-y-1">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Category
                                  </p>
                                  <select
                                    value={candidate.category}
                                    onChange={(event) => {
                                      const next = event.target.value as DecisionCandidateDraft["category"];
                                      setDecisionCandidates((prev) =>
                                        prev.map((item) =>
                                          item.id === candidate.id ? { ...item, category: next } : item,
                                        ),
                                      );
                                    }}
                                    className="h-8 rounded-md border border-border/60 bg-background px-2 text-[11px] text-foreground"
                                  >
                                    {CATEGORY_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Strength
                                  </p>
                                  <div className="flex gap-2">
                                    {["hard", "soft"].map((strength) => (
                                      <button
                                        key={strength}
                                        type="button"
                                        onClick={() =>
                                          setDecisionCandidates((prev) =>
                                            prev.map((item) =>
                                              item.id === candidate.id
                                                ? { ...item, strength: strength as "hard" | "soft" }
                                                : item,
                                            ),
                                          )
                                        }
                                        className={`h-8 rounded-md border px-3 text-[11px] font-semibold uppercase tracking-wide transition ${
                                          candidate.strength === strength
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-border/60 bg-background text-foreground"
                                        }`}
                                      >
                                        {strength}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {candidate.evidence.quote ? (
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                “{candidate.evidence.quote}”
                              </p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {isAdded ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px] font-semibold uppercase tracking-wide"
                                  disabled
                                >
                                  ADDED ✓
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px] font-semibold uppercase tracking-wide"
                                  onClick={() => handleAddToSession(candidate)}
                                >
                                  ADD TO SESSION
                                </Button>
                              )}
                              {isAdded ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px] font-semibold uppercase tracking-wide"
                                  onClick={() => scrollToDecision(`extract-${candidate.id}`)}
                                >
                                  JUMP TO DECISION
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] font-semibold uppercase tracking-wide"
                                onClick={() => handleDismissCandidate(candidate)}
                              >
                                DISMISS
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                ) : null}
              </div>
            </div>

            {toastNotice ? (
              <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-border/60 bg-white/90 px-4 py-3 text-[11px] text-foreground shadow-lg">
                <span className="font-semibold">{toastNotice.message}</span>
                {toastNotice.actionLabel ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10px] font-semibold uppercase tracking-wide"
                    onClick={() => {
                      toastNotice.onAction?.();
                      setToastNotice(null);
                    }}
                  >
                    {toastNotice.actionLabel}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <Dialog
              open={Boolean(editingDecision)}
              onOpenChange={(open) => {
                if (!open) {
                  setEditingDecision(null);
                  setEditDraft(null);
                }
              }}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit decision details</DialogTitle>
                </DialogHeader>
                {editDraft ? (
                  <div className="space-y-3 text-sm">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Title
                      </label>
                      <Input
                        value={editDraft.decisionTitle}
                        onChange={(event) =>
                          setEditDraft((prev) => (prev ? { ...prev, decisionTitle: event.target.value } : prev))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Category
                      </label>
                      <Input
                        value={editDraft.category}
                        onChange={(event) =>
                          setEditDraft((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          { key: "impact", label: "Impact" },
                          { key: "cost", label: "Cost" },
                          { key: "risk", label: "Risk" },
                          { key: "urgency", label: "Urgency" },
                          { key: "confidence", label: "Confidence" },
                        ] as const
                      ).map((field) => (
                        <div key={field.key} className="space-y-1">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {field.label}
                          </label>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            value={editDraft[field.key]}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev
                                  ? { ...prev, [field.key]: Number(event.target.value) }
                                  : prev,
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingDecision(null);
                      setEditDraft(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSaveEdit}>
                    Save changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </section>
      </main>
    </TooltipProvider>
  );
}
