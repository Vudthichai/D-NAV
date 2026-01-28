"use client";

import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import {
  extractDecisionCandidatesLocal,
  type DecisionCandidate,
  type DecisionCategory,
} from "@/lib/intake/decisionExtractLocal";
import type { LocalSummary } from "@/lib/intake/summaryLocal";
import KeyDecisionRow from "@/components/decision-intake/KeyDecisionRow";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface PdfDecisionIntakeProps {
  onAddDecision: (candidate: DecisionCandidate, sourceFileName?: string) => void;
  onAddDecisions: (candidates: DecisionCandidate[], sourceFileName?: string) => void;
}

const CATEGORY_OPTIONS: DecisionCategory[] = [
  "Operations",
  "Finance",
  "Product",
  "Hiring",
  "Legal",
  "Strategy",
  "Sales/Go-to-market",
  "Other",
];

type SliderKey = keyof DecisionCandidate["sliders"];

const pillClass = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border/60 bg-transparent text-muted-foreground hover:border-border/80 hover:text-foreground",
  );

export default function PdfDecisionIntake({ onAddDecision, onAddDecisions }: PdfDecisionIntakeProps) {
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

  const updateCandidate = useCallback((id: string, updates: Partial<DecisionCandidate>) => {
    setCandidates((prev) => prev.map((candidate) => (candidate.id === id ? { ...candidate, ...updates } : candidate)));
  }, []);

  const updateSlider = useCallback((id: string, key: SliderKey, value: number) => {
    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              sliders: {
                ...candidate.sliders,
                [key]: Math.max(0, Math.min(10, value)),
              },
            }
          : candidate,
      ),
    );
  }, []);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      if (dismissedIds.has(candidate.id)) return false;
      if (committedOnly && candidate.strength !== "committed") return false;
      if (hideTables && candidate.flags.isTableLike) return false;
      return true;
    });
  }, [candidates, dismissedIds, committedOnly, hideTables]);

  const visibleCandidates = useMemo(() => {
    return showAll ? filteredCandidates : filteredCandidates.slice(0, 15);
  }, [filteredCandidates, showAll]);

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
    <div className="space-y-4 rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm dark:bg-white/5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Decision Intake</h2>
        <p className="text-xs text-muted-foreground">
          Local-first extraction for high-signal commitments. Edit, score, and add decisions directly into your session.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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

        <div className="dnav-dark-glass-surface rounded-xl border border-border/60 bg-white/70 p-4 shadow-sm dark:bg-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Document Summary</p>
          {summary ? (
            <div className="mt-2 space-y-2 text-[11px] text-muted-foreground">
              <p className="text-sm font-semibold text-foreground">{summary.intro}</p>
              {summary.bullets.length > 0 ? (
                <ul className="space-y-1">
                  {summary.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Upload a PDF to generate a local summary.</p>
              )}
              {summary.themes.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {summary.themes.map((theme) => (
                    <span
                      key={theme}
                      className="rounded-full border border-border/60 bg-muted/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {theme}
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

      <div className="dnav-dark-glass-surface space-y-3 rounded-xl border border-border/60 bg-white/70 p-4 shadow-sm dark:bg-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Key Decisions <span className="text-muted-foreground">({filteredCandidates.length})</span>
              </p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="grid h-6 w-6 place-items-center rounded-full border border-border/60 text-muted-foreground transition hover:text-foreground"
                      aria-label="Commitment definitions"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    <p className="font-semibold text-foreground">Commitment tags</p>
                    <p className="mt-1 text-muted-foreground">
                      COMMITTED = action-backed commitment (will/began/completed/scheduled)
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      INDICATIVE = intent or expectation (expect/plan/aim/on track)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-[11px] text-muted-foreground">Edit, score, and add to session.</p>
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
            Upload a PDF to see decision candidates.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleCandidates.map((candidate) => {
              const isAdded = addedIds.has(candidate.id);
              return (
                <KeyDecisionRow
                  key={candidate.id}
                  candidate={candidate}
                  isAdded={isAdded}
                  categoryOptions={CATEGORY_OPTIONS}
                  onAdd={handleAdd}
                  onDismiss={handleDismiss}
                  onCategoryChange={(id, category) => updateCandidate(id, { category })}
                  onMetricChange={(id, key, value) => updateSlider(id, key, value)}
                  onStrengthChange={(id, strength) => updateCandidate(id, { strength })}
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
                  Show More
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
