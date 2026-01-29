"use client";

import { type ChangeEvent, forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import {
  extractDecisionCandidatesLocal,
  type DecisionCandidate,
  DECISION_CATEGORIES,
} from "@/lib/intake/decisionExtractLocal";
import type { LocalSummary } from "@/lib/intake/summaryLocal";
import { MAP_CATEGORY_CONFIG } from "@/lib/intake/decisionMap";
import KeyDecisionRow from "@/components/decision-intake/KeyDecisionRow";
import DecisionLegend from "@/components/decision-intake/DecisionLegend";

interface PdfDecisionIntakeProps {
  onAddDecision: (candidate: DecisionCandidate, sourceFileName?: string) => void;
  onAddDecisions: (candidates: DecisionCandidate[], sourceFileName?: string) => void;
  onCandidateUpdate?: (candidate: DecisionCandidate) => void;
}

export interface PdfDecisionIntakeHandle {
  syncCandidate: (candidateId: string, updates: Partial<DecisionCandidate>) => void;
}

type SliderKey = keyof DecisionCandidate["sliders"];

const pillClass = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border/60 bg-transparent text-muted-foreground hover:border-border/80 hover:text-foreground",
  );

const SHOW_SUMMARY_HEADLINE = true;

const PdfDecisionIntake = forwardRef<PdfDecisionIntakeHandle, PdfDecisionIntakeProps>(function PdfDecisionIntake(
  { onAddDecision, onAddDecisions, onCandidateUpdate }: PdfDecisionIntakeProps,
  ref,
) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [pagesRead, setPagesRead] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [summary, setSummary] = useState<LocalSummary | null>(null);
  const [candidates, setCandidates] = useState<DecisionCandidate[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [committedOnly, setCommittedOnly] = useState(false);
  const [hideTables, setHideTables] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const resetState = useCallback(() => {
    setPagesRead(0);
    setPageCount(0);
    setTotalChars(0);
    setSummary(null);
    setCandidates([]);
    setDismissedIds(new Set());
    setAddedIds(new Set());
    setShowAll(false);
    setExtractError(null);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFileName(file?.name ?? null);
    resetState();
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });

    if (!file) return;
    if (file.type !== "application/pdf") {
      setExtractError("Please upload a PDF file.");
      return;
    }

    setIsReading(true);
    try {
      const result = await extractPdfText(file, {
        onProgress: ({ page, pageCount, totalChars }) => {
          setPagesRead(page);
          setPageCount(pageCount);
          setTotalChars(totalChars);
        },
      });

      setPagesRead(result.pages.length);
      setPageCount(result.pageCount);
      setTotalChars(result.pages.reduce((acc, page) => acc + page.charCount, 0));
      setIsExtracting(true);

      const extraction = extractDecisionCandidatesLocal(
        result.pages.map((page) => ({ page: page.page, text: page.text })),
        { maxPerPage: 6, minScore: 4 },
        result.docName,
      );

      setSummary(extraction.summary);
      setCandidates(extraction.candidates);
      if (extraction.candidates.length === 0) {
        setExtractError("No clear commitments detected. Try a different PDF or expand the filters.");
      }
    } catch (error) {
      console.error("Failed to read PDF.", error);
      setExtractError("Failed to read the PDF. Please try a different file.");
    } finally {
      setIsReading(false);
      setIsExtracting(false);
    }
  }, [resetState]);

  const applyCandidateUpdates = useCallback(
    (id: string, updater: (candidate: DecisionCandidate) => DecisionCandidate) => {
      let updatedCandidate: DecisionCandidate | null = null;
      setCandidates((prev) =>
        prev.map((candidate) => {
          if (candidate.id !== id) return candidate;
          updatedCandidate = updater(candidate);
          return updatedCandidate;
        }),
      );
      if (updatedCandidate) {
        onCandidateUpdate?.(updatedCandidate);
      }
    },
    [onCandidateUpdate],
  );

  const updateCandidate = useCallback(
    (id: string, updates: Partial<DecisionCandidate>) => {
      applyCandidateUpdates(id, (candidate) => ({ ...candidate, ...updates }));
    },
    [applyCandidateUpdates],
  );

  const updateSlider = useCallback(
    (id: string, key: SliderKey, value: number) => {
      applyCandidateUpdates(id, (candidate) => ({
        ...candidate,
        sliders: {
          ...candidate.sliders,
          [key]: Math.max(0, Math.min(10, value)),
        },
      }));
    },
    [applyCandidateUpdates],
  );

  useImperativeHandle(
    ref,
    () => ({
      syncCandidate: (candidateId: string, updates: Partial<DecisionCandidate>) => {
        applyCandidateUpdates(candidateId, (candidate) => ({ ...candidate, ...updates }));
      },
    }),
    [applyCandidateUpdates],
  );

  const mappedSections = useMemo(
    () =>
      MAP_CATEGORY_CONFIG.map((section) => ({
        ...section,
        summary: summary?.map[section.key] ?? "",
        candidates: candidates.filter((candidate) => candidate.mapCategory === section.key),
      })),
    [candidates, summary],
  );

  const isCandidateVisible = useCallback(
    (candidate: DecisionCandidate) => {
      if (dismissedIds.has(candidate.id)) return false;
      if (committedOnly && candidate.strength !== "committed") return false;
      if (hideTables && candidate.flags.isTableLike) return false;
      return true;
    },
    [dismissedIds, committedOnly, hideTables],
  );

  const filteredSections = useMemo(
    () =>
      mappedSections.map((section) => ({
        ...section,
        candidates: section.candidates.filter((candidate) => isCandidateVisible(candidate)),
      })),
    [isCandidateVisible, mappedSections],
  );

  const filteredCandidates = useMemo(
    () => filteredSections.flatMap((section) => section.candidates),
    [filteredSections],
  );

  const visibleCandidates = useMemo(
    () => (showAll ? filteredCandidates : filteredCandidates.slice(0, 15)),
    [filteredCandidates, showAll],
  );

  const visibleCandidateIds = useMemo(
    () => new Set(visibleCandidates.map((candidate) => candidate.id)),
    [visibleCandidates],
  );

  const visibleSections = useMemo(
    () =>
      filteredSections.map((section) => ({
        ...section,
        candidates: section.candidates.filter((candidate) => visibleCandidateIds.has(candidate.id)),
      })),
    [filteredSections, visibleCandidateIds],
  );

  const hasMore = filteredCandidates.length > visibleCandidates.length;

  const handleAdd = useCallback(
    (candidate: DecisionCandidate) => {
      onAddDecision(candidate, selectedFileName ?? undefined);
      setAddedIds((prev) => new Set([...prev, candidate.id]));
    },
    [onAddDecision, selectedFileName],
  );

  const handleAddAll = useCallback(() => {
    if (visibleCandidates.length === 0) return;
    const toAdd = visibleCandidates.filter((candidate) => !addedIds.has(candidate.id));
    if (toAdd.length === 0) return;
    onAddDecisions(toAdd, selectedFileName ?? undefined);
    setAddedIds((prev) => new Set([...prev, ...toAdd.map((candidate) => candidate.id)]));
  }, [addedIds, onAddDecisions, selectedFileName, visibleCandidates]);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  const handleDismissAll = useCallback(() => {
    setDismissedIds((prev) => new Set([...prev, ...visibleCandidates.map((candidate) => candidate.id)]));
  }, [visibleCandidates]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Decision Intake</h2>
        <p className="text-xs text-muted-foreground">
          Local-first extraction for high-signal commitments. Edit, score, and add decisions directly into your session.
        </p>
      </div>

      <div className="space-y-5">
        <div className="dnav-dark-glass-surface rounded-xl border border-border/60 bg-white/70 p-4 shadow-sm dark:bg-white/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Upload PDF</p>
              <p className="text-[11px] text-muted-foreground">
                {selectedFileName ? `Selected: ${selectedFileName}` : "Choose a PDF to extract per-page text."}
              </p>
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-[11px] font-semibold text-primary hover:underline"
                >
                  View PDF
                </a>
              ) : null}
            </div>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleUpload}
              className="text-xs text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-[10px] file:font-semibold file:uppercase file:tracking-wide file:text-primary-foreground"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span>Pages read: {pagesRead}</span>
            <span>Total chars: {totalChars.toLocaleString()}</span>
            {isReading ? <span className="font-semibold text-foreground">Reading PDF…</span> : null}
            {isExtracting ? <span className="font-semibold text-foreground">Extracting decisions…</span> : null}
            {pageCount > 0 ? <span>Pages total: {pageCount}</span> : null}
          </div>
          <p className="mt-2 text-[11px] text-emerald-600">Offline extraction. No API calls.</p>
          {extractError ? <p className="mt-2 text-[11px] text-rose-500">{extractError}</p> : null}
        </div>

        <div className="dnav-dark-glass-surface rounded-xl border border-border/60 bg-white/70 p-5 shadow-sm dark:bg-white/10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Document Summary</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Orientation map only — the decision candidates live below.
              </p>
            </div>
          </div>
          {summary ? (
            <div className="mt-4 space-y-4">
              {SHOW_SUMMARY_HEADLINE && summary.summaryHeadline ? (
                <p className="text-[12px] font-semibold text-foreground">{summary.summaryHeadline}</p>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                {MAP_CATEGORY_CONFIG.map((section) => (
                  <div
                    key={section.key}
                    className="space-y-2 rounded-lg border border-border/40 bg-muted/5 p-3"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title}
                    </p>
                    <p className="text-[12px] text-foreground">{summary.map[section.key]}</p>
                  </div>
                ))}
              </div>
              {summary.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {summary.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border/60 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm dark:bg-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">Summary populates after extraction.</p>
          )}
        </div>
      </div>

      <div className="dnav-dark-glass-surface space-y-4 rounded-xl border border-border/60 bg-white/70 p-5 shadow-sm dark:bg-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Key Decisions <span className="text-muted-foreground">({filteredCandidates.length})</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Key decision candidates that support the map above.
            </p>
            <DecisionLegend />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={pillClass(committedOnly)} onClick={() => setCommittedOnly((prev) => !prev)}>
              Committed only
            </button>
            <button type="button" className={pillClass(hideTables)} onClick={() => setHideTables((prev) => !prev)}>
              Hide tables
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                "border-border/60 bg-foreground/5 text-foreground hover:bg-foreground/10",
              )}
              onClick={handleAddAll}
            >
              Add All (Shown)
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                "border-border/60 bg-transparent text-muted-foreground hover:border-border/80 hover:text-foreground",
              )}
              onClick={handleDismissAll}
            >
              Dismiss All
            </button>
          </div>
        </div>

        {visibleCandidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-4 text-[11px] text-muted-foreground">
            Upload a PDF to see key decision candidates.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleSections.map((section) =>
              section.candidates.length > 0 ? (
                <div key={section.key} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {section.candidates.length} items
                    </span>
                  </div>
                  <div className="space-y-2">
                    {section.candidates.map((candidate) => {
                      const isAdded = addedIds.has(candidate.id);
                      return (
                        <KeyDecisionRow
                          key={candidate.id}
                          candidate={candidate}
                          isAdded={isAdded}
                          categoryOptions={DECISION_CATEGORIES}
                          pdfUrl={pdfUrl}
                          onAdd={handleAdd}
                          onDismiss={handleDismiss}
                          onCategoryChange={(id, category) => updateCandidate(id, { category })}
                          onMetricChange={(id, key, value) => updateSlider(id, key, value)}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div key={section.key} className="space-y-2 rounded-lg border border-dashed border-border/50 bg-muted/5 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">No candidates in this category yet.</p>
                </div>
              ),
            )}

            {hasMore ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  className="rounded-full border border-border/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:border-border/80 hover:text-foreground"
                  onClick={() => setShowAll(true)}
                >
                  Load More Items
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
});

export default PdfDecisionIntake;
