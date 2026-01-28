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

const SLIDER_FIELDS = [
  { key: "impact", label: "Impact" },
  { key: "cost", label: "Cost" },
  { key: "risk", label: "Risk" },
  { key: "urgency", label: "Urgency" },
  { key: "confidence", label: "Confidence" },
] as const;

const INPUT_CLASS =
  "w-full rounded-md border border-border/60 bg-background px-2 py-2 text-xs text-foreground shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30";
const TEXTAREA_CLASS =
  "w-full rounded-md border border-border/60 bg-background px-2 py-2 text-xs text-foreground shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30";

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
  const [hardOnly, setHardOnly] = useState(false);
  const [hideTables, setHideTables] = useState(true);
  const [expandedEvidenceIds, setExpandedEvidenceIds] = useState<Set<string>>(new Set());

  const resetState = () => {
    setPagesRead(0);
    setPageCount(0);
    setTotalChars(0);
    setSummary(null);
    setCandidates([]);
    setDismissedIds(new Set());
    setAddedIds(new Set());
    setShowAll(false);
    setExtractError(null);
    setExpandedEvidenceIds(new Set());
  };

  const handleUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFileName(file?.name ?? null);
    resetState();

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
  }, []);

  const updateCandidate = useCallback((id: string, updates: Partial<DecisionCandidate>) => {
    setCandidates((prev) => prev.map((candidate) => (candidate.id === id ? { ...candidate, ...updates } : candidate)));
  }, []);

  const updateSlider = useCallback((id: string, key: typeof SLIDER_FIELDS[number]["key"], value: number) => {
    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              sliders: {
                ...candidate.sliders,
                [key]: value,
              },
            }
          : candidate,
      ),
    );
  }, []);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      if (dismissedIds.has(candidate.id)) return false;
      if (hardOnly && candidate.strength !== "hard") return false;
      if (hideTables && candidate.flags.isTableLike) return false;
      return true;
    });
  }, [candidates, dismissedIds, hardOnly, hideTables]);

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

  const toggleEvidence = useCallback((id: string) => {
    setExpandedEvidenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
          <div>
            <p className="text-sm font-semibold text-foreground">
              Key Decisions <span className="text-muted-foreground">({filteredCandidates.length})</span>
            </p>
            <p className="text-[11px] text-muted-foreground">Edit, score, and add to session.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={pillClass(hardOnly)} onClick={() => setHardOnly((prev) => !prev)}>
              Hard-only
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
          <div className="space-y-3">
            {visibleCandidates.map((candidate) => {
              const isAdded = addedIds.has(candidate.id);
              const isExpanded = expandedEvidenceIds.has(candidate.id);
              return (
                <div
                  key={candidate.id}
                  className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-xs text-muted-foreground"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</p>
                      <input
                        value={candidate.title}
                        onChange={(event) => updateCandidate(candidate.id, { title: event.target.value })}
                        className={INPUT_CLASS}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {candidate.evidence.page ? `p. ${candidate.evidence.page}` : "Page n/a"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={pillClass(candidate.strength === "hard")}>Hard</span>
                      <span className={pillClass(candidate.strength === "soft")}>Soft</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Decision</p>
                    <textarea
                      value={candidate.decision}
                      onChange={(event) => updateCandidate(candidate.id, { decision: event.target.value })}
                      className={TEXTAREA_CLASS}
                      rows={4}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
                        <select
                          value={candidate.category}
                          onChange={(event) =>
                            updateCandidate(candidate.id, { category: event.target.value as DecisionCategory })
                          }
                          className={cn(INPUT_CLASS, "h-8")}
                        >
                          {CATEGORY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Strength</p>
                        <div className="flex gap-2">
                          {(["hard", "soft"] as const).map((strength) => (
                            <button
                              key={strength}
                              type="button"
                              onClick={() => updateCandidate(candidate.id, { strength })}
                              className={pillClass(candidate.strength === strength)}
                            >
                              {strength}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {SLIDER_FIELDS.map((field) => (
                      <label key={field.key} className="space-y-1 text-[11px] text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={10}
                            step={1}
                            value={candidate.sliders[field.key]}
                            onChange={(event) => updateSlider(candidate.id, field.key, Number(event.target.value))}
                            className="w-full accent-foreground"
                          />
                          <span className="w-6 text-right text-[11px] text-foreground">
                            {candidate.sliders[field.key]}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>

                  {candidate.evidence.full ? (
                    <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                      <p>
                        {isExpanded || candidate.evidence.full.length <= 240
                          ? candidate.evidence.full
                          : `${candidate.evidence.full.slice(0, 240)}…`}
                      </p>
                      {candidate.evidence.full.length > 240 ? (
                        <button
                          type="button"
                          className="text-[10px] font-semibold uppercase tracking-wide text-primary"
                          onClick={() => toggleEvidence(candidate.id)}
                        >
                          {isExpanded ? "Show less" : "Expand evidence"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide",
                        isAdded
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                          : "border-border/60 bg-foreground/5 text-foreground hover:bg-foreground/10",
                      )}
                      onClick={() => handleAdd(candidate)}
                      disabled={isAdded}
                    >
                      {isAdded ? "Added ✓" : "Add to Session"}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide",
                        "border-border/60 bg-transparent text-muted-foreground hover:border-border/80 hover:text-foreground",
                      )}
                      onClick={() => handleDismiss(candidate.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
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
