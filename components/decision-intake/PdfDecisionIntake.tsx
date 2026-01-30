"use client";

import { type ChangeEvent, forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import { extractDecisionCandidatesLocal, type DecisionCandidate } from "@/lib/intake/decisionExtractLocal";
import type { LocalSummary } from "@/lib/intake/summaryLocal";
import KeyDecisionRow from "@/components/decision-intake/KeyDecisionRow";

interface PdfDecisionIntakeProps {
  onAddDecision: (candidate: DecisionCandidate, sourceFileName?: string) => void;
  onAddDecisions: (candidates: DecisionCandidate[], sourceFileName?: string) => void;
  onCandidateUpdate?: (candidate: DecisionCandidate) => void;
}

export interface PdfDecisionIntakeHandle {
  syncCandidate: (candidateId: string, updates: Partial<DecisionCandidate>) => void;
}

type SliderKey = keyof DecisionCandidate["sliders"];

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
        setExtractError("No clear decisions detected. Try a different PDF.");
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

  const updateDecisionText = useCallback(
    (id: string, value: string) => {
      applyCandidateUpdates(id, (candidate) => ({
        ...candidate,
        decision: value,
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

  const isCandidateVisible = useCallback(
    (candidate: DecisionCandidate) => {
      if (dismissedIds.has(candidate.id)) return false;
      return true;
    },
    [dismissedIds],
  );

  const filteredCandidates = useMemo(
    () => candidates.filter((candidate) => isCandidateVisible(candidate)),
    [candidates, isCandidateVisible],
  );

  const visibleCandidates = useMemo(
    () => (showAll ? filteredCandidates : filteredCandidates.slice(0, 15)),
    [filteredCandidates, showAll],
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

  const narrativeSummary = summary?.narrativeSummary ?? summary?.summary ?? "";
  const getPdfPageUrl = useCallback((pdfUrl: string, page?: number) => {
    const resolvedPage = page && page > 0 ? page : 1;
    return `${pdfUrl}#page=${resolvedPage}`;
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Decision Intake</h2>
        <p className="text-xs text-muted-foreground">
          Local-first extraction for high-signal decisions. Edit, score, and add decisions directly into your session.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="dnav-dark-glass-surface rounded-xl border border-border/60 bg-white/70 p-4 shadow-sm dark:bg-white/10 md:col-span-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Upload PDF</p>
              <p className="text-[11px] text-muted-foreground">
                {selectedFileName ? (
                  <span className="block truncate" title={selectedFileName}>
                    Selected: {selectedFileName}
                  </span>
                ) : (
                  "Choose a PDF to extract per-page text."
                )}
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
            {isReading ? <span className="font-semibold text-foreground">Reading PDF…</span> : null}
            {isExtracting ? <span className="font-semibold text-foreground">Extracting decisions…</span> : null}
          </div>
          <details className="mt-2 text-[11px] text-muted-foreground">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Document stats
            </summary>
            <div className="mt-2 flex flex-wrap gap-3">
              <span>Pages read: {pagesRead}</span>
              <span>Total chars: {totalChars.toLocaleString()}</span>
              {pageCount > 0 ? <span>Pages total: {pageCount}</span> : null}
            </div>
          </details>
          {extractError ? <p className="mt-2 text-[11px] text-rose-500">{extractError}</p> : null}
        </div>

        <div className="dnav-dark-glass-surface rounded-xl border border-border/60 bg-white/70 p-5 shadow-sm dark:bg-white/10 md:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Document Summary</p>
            </div>
          </div>
          {summary ? (
            <div className="mt-4 space-y-2 rounded-lg border border-border/40 bg-muted/5 p-4">
              {narrativeSummary ? (
                <p className="text-[12px] font-semibold leading-relaxed text-foreground/90">{narrativeSummary}</p>
              ) : (
                <p className="text-[12px] text-muted-foreground">No summary available yet.</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">No summary available yet.</p>
          )}
        </div>
      </div>

      <div className="dnav-dark-glass-surface space-y-4 rounded-xl border border-border/60 bg-white/70 p-5 shadow-sm dark:bg-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Extracted Decisions (Decision Candidates Only){" "}
              <span className="text-muted-foreground">({filteredCandidates.length})</span>
            </p>
            <div className="mt-3 w-full rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                How to use these decisions
              </p>
              <p className="mt-1 text-[12px]">
                Don’t know where to start? Upload a memo or report. D-NAV surfaces decision candidates you can edit and
                rate.
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground">
                1) Edit wording &nbsp; 2) Score Impact/Cost/Risk/Urgency/Confidence &nbsp; 3) Add to session
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pdfUrl ? (
              <a
                href={getPdfPageUrl(pdfUrl, 1)}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                  "border-border/60 bg-foreground/5 text-foreground hover:bg-foreground/10",
                )}
              >
                View PDF
              </a>
            ) : null}
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
          <div className="space-y-1">
            {visibleCandidates.map((candidate) => {
              const isAdded = addedIds.has(candidate.id);
              const candidatePage = candidate.page ?? candidate.evidence.page;
              const pdfPageUrl = pdfUrl ? getPdfPageUrl(pdfUrl, candidatePage) : null;
              return (
                <KeyDecisionRow
                  key={candidate.id}
                  candidate={candidate}
                  isAdded={isAdded}
                  pdfUrl={pdfPageUrl}
                  onAdd={handleAdd}
                  onDismiss={handleDismiss}
                  onMetricChange={(id, key, value) => updateSlider(id, key, value)}
                  onDecisionChange={updateDecisionText}
                />
              );
            })}

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
