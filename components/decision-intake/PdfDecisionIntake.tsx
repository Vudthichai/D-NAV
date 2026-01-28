"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import { normalizePdfText } from "@/lib/pdf/normalizePdfText";
import { extractDecisionCandidates, type DecisionCandidate } from "@/lib/intake/decisionExtractLocal";
import { buildLocalSummary, type LocalSummary } from "@/lib/intake/summaryLocal";

type PdfDecisionIntakeProps = {
  onAddDecision: (candidate: DecisionCandidate) => void;
  onAddDecisions: (candidates: DecisionCandidate[]) => void;
  addedCandidateIds: Set<string>;
  onFileSelected?: (fileName: string | null) => void;
};

const CATEGORY_OPTIONS: DecisionCandidate["category"][] = ["Product", "Operations", "Finance", "Strategy", "Other"];

const scoreLabels: Array<keyof DecisionCandidate["scores"]> = [
  "impact",
  "cost",
  "risk",
  "urgency",
  "confidence",
];

const normalizeCandidate = (candidate: DecisionCandidate) => ({
  ...candidate,
  title: candidate.title.trim() || "Untitled decision",
  decision: candidate.decision.trim(),
});

export default function PdfDecisionIntake({
  onAddDecision,
  onAddDecisions,
  addedCandidateIds,
  onFileSelected,
}: PdfDecisionIntakeProps) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [pagesRead, setPagesRead] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [decisionCandidates, setDecisionCandidates] = useState<DecisionCandidate[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [summary, setSummary] = useState<LocalSummary | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [hardOnly, setHardOnly] = useState(false);
  const [hideTables, setHideTables] = useState(true);
  const [hideDisclaimers, setHideDisclaimers] = useState(true);
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());

  const handlePdfUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFileName(file?.name ?? null);
    onFileSelected?.(file?.name ?? null);
    setPagesRead(0);
    setTotalChars(0);
    setDecisionCandidates([]);
    setExtractError(null);
    setShowAllCandidates(false);
    setSummary(null);
    setDismissedIds(new Set());
    if (!file) return;
    if (file.type !== "application/pdf") {
      setExtractError("Please upload a PDF file.");
      return;
    }

    setIsReadingPdf(true);
    try {
      const raw = await extractPdfText(file);
      const normalized = normalizePdfText(raw);
      setPagesRead(normalized.pageCount);
      setTotalChars(normalized.pages.reduce((acc, page) => acc + page.text.length, 0));

      const extracted = extractDecisionCandidates(normalized, { maxCandidates: 40 });
      const cleanedCandidates = extracted.candidates.map(normalizeCandidate);
      setDecisionCandidates(cleanedCandidates);
      setSummary(buildLocalSummary(normalized));

      if (cleanedCandidates.length === 0) {
        setExtractError("No clear commitments found. Try a different PDF or expand detection.");
      }
    } catch (error) {
      console.error("Failed to read PDF.", error);
      setExtractError("Failed to read the PDF. Please try a different file.");
    } finally {
      setIsReadingPdf(false);
    }
  }, []);

  const filteredCandidates = useMemo(() => {
    return decisionCandidates.filter((candidate) => {
      if (dismissedIds.has(candidate.id)) return false;
      if (hardOnly && candidate.strength !== "hard") return false;
      if (hideTables && candidate.meta.isTableLike) return false;
      if (hideDisclaimers && candidate.meta.isBoilerplate) return false;
      return true;
    });
  }, [decisionCandidates, dismissedIds, hardOnly, hideDisclaimers, hideTables]);

  const visibleCandidates = useMemo(() => {
    if (showAllCandidates) return filteredCandidates;
    return filteredCandidates.slice(0, 12);
  }, [filteredCandidates, showAllCandidates]);

  const hasMoreCandidates = filteredCandidates.length > visibleCandidates.length;

  const handleDismissCandidate = useCallback((candidate: DecisionCandidate) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(candidate.id);
      return next;
    });
  }, []);

  const handleDismissAll = useCallback((candidates: DecisionCandidate[]) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      candidates.forEach((candidate) => next.add(candidate.id));
      return next;
    });
  }, []);

  const handleAddCandidate = useCallback(
    (candidate: DecisionCandidate) => {
      onAddDecision(candidate);
    },
    [onAddDecision],
  );

  const handleAddAll = useCallback(() => {
    const additions = visibleCandidates.filter((candidate) => !addedCandidateIds.has(candidate.id));
    if (additions.length === 0) return;
    onAddDecisions(additions);
  }, [addedCandidateIds, onAddDecisions, visibleCandidates]);

  const toggleEvidence = useCallback((id: string) => {
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const updateCandidate = useCallback((id: string, updates: Partial<DecisionCandidate>) => {
    setDecisionCandidates((prev) =>
      prev.map((candidate) => (candidate.id === id ? { ...candidate, ...updates } : candidate)),
    );
  }, []);

  const updateScore = useCallback(
    (id: string, key: keyof DecisionCandidate["scores"], value: number) => {
      setDecisionCandidates((prev) =>
        prev.map((candidate) =>
          candidate.id === id ? { ...candidate, scores: { ...candidate.scores, [key]: value } } : candidate,
        ),
      );
    },
    [],
  );

  const summaryThemes = summary?.themes ?? [];

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:bg-white/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Decision Intake</h2>
            <p className="text-xs text-muted-foreground">
              Local-first PDF extraction. Clean decisions, no API calls, fully offline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-muted/20 px-3 py-1 font-semibold uppercase tracking-wide">
              Local-only
            </span>
            <span className="rounded-full border border-border/60 bg-muted/20 px-3 py-1 font-semibold uppercase tracking-wide">
              Edit before add
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-4">
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
          </div>
          <p className="mt-2 text-[11px] text-emerald-600">Local extraction (fast). Edit before saving.</p>
          {extractError ? <p className="mt-2 text-[11px] text-rose-500">{extractError}</p> : null}
        </div>
      </div>

      {summary ? (
        <div className="rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:bg-white/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Document Summary</h3>
              <p className="text-xs text-muted-foreground">High-signal, deterministic summary (no AI).</p>
            </div>
            {summaryThemes.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {summaryThemes.map((theme) => (
                  <span
                    key={theme}
                    className="rounded-full border border-border/60 bg-muted/20 px-3 py-1 font-semibold uppercase tracking-wide"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-foreground">{summary.overview}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {summary.bullets.map((bullet) => (
              <div key={bullet.label} className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{bullet.label}</p>
                <p className="mt-1 text-xs text-foreground">{bullet.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Key Decisions <span className="text-muted-foreground">({filteredCandidates.length})</span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Aggressively filtered. Fewer, higher-signal decisions are better.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <label className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1">
              <input
                type="checkbox"
                checked={hardOnly}
                onChange={(event) => setHardOnly(event.target.checked)}
                className="h-3 w-3"
              />
              Hard only
            </label>
            <label className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1">
              <input
                type="checkbox"
                checked={hideTables}
                onChange={(event) => setHideTables(event.target.checked)}
                className="h-3 w-3"
              />
              Hide finance tables
            </label>
            <label className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1">
              <input
                type="checkbox"
                checked={hideDisclaimers}
                onChange={(event) => setHideDisclaimers(event.target.checked)}
                className="h-3 w-3"
              />
              Hide disclaimers
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-8 rounded-full border border-border/60 bg-foreground px-4 text-[11px] font-semibold uppercase tracking-wide text-background"
            onClick={handleAddAll}
            disabled={visibleCandidates.length === 0}
          >
            Add all (shown)
          </button>
          <button
            type="button"
            className="h-8 rounded-full border border-border/60 bg-muted/20 px-4 text-[11px] font-semibold uppercase tracking-wide text-foreground"
            onClick={() => handleDismissAll(visibleCandidates)}
            disabled={visibleCandidates.length === 0}
          >
            Dismiss all
          </button>
          {hasMoreCandidates ? (
            <button
              type="button"
              className="h-8 rounded-full border border-border/60 bg-muted/10 px-4 text-[11px] font-semibold uppercase tracking-wide text-foreground"
              onClick={() => setShowAllCandidates(true)}
            >
              Show more
            </button>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {visibleCandidates.map((candidate) => {
            const isAdded = addedCandidateIds.has(candidate.id);
            const expanded = expandedEvidence.has(candidate.id);
            return (
              <div
                key={candidate.id}
                className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3 text-xs text-muted-foreground"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</p>
                    <input
                      value={candidate.title}
                      onChange={(event) => updateCandidate(candidate.id, { title: event.target.value })}
                      className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm text-foreground"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {candidate.evidence.page ? `p. ${candidate.evidence.page}` : "Page n/a"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide">
                    <span className="rounded-full border border-border/60 bg-muted/10 px-2 py-1 font-semibold text-muted-foreground">
                      {candidate.category}
                    </span>
                    <span className="rounded-full border border-border/60 bg-muted/10 px-2 py-1 font-semibold text-muted-foreground">
                      {candidate.strength}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Decision</p>
                  <textarea
                    value={candidate.decision}
                    onChange={(event) => updateCandidate(candidate.id, { decision: event.target.value })}
                    className="min-h-[88px] w-full rounded-md border border-border/60 bg-background px-2 py-2 text-[11px] text-foreground"
                  />

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
                      <select
                        value={candidate.category}
                        onChange={(event) =>
                          updateCandidate(candidate.id, { category: event.target.value as DecisionCandidate["category"] })
                        }
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
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Strength</p>
                      <div className="flex gap-2">
                        {["hard", "soft"].map((strength) => (
                          <button
                            key={strength}
                            type="button"
                            onClick={() => updateCandidate(candidate.id, { strength: strength as "hard" | "soft" })}
                            className={`h-8 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-wide transition ${
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

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {scoreLabels.map((label) => (
                      <div key={label} className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={1}
                          value={candidate.scores[label]}
                          onChange={(event) => updateScore(candidate.id, label, Number(event.target.value))}
                          className="w-full accent-foreground"
                        />
                        <p className="text-[11px] font-semibold text-foreground">{candidate.scores[label]}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
                  <p className="text-[11px] text-muted-foreground">“{expanded ? candidate.evidence.full : candidate.evidence.preview}”</p>
                  <button
                    type="button"
                    className="text-[11px] font-semibold uppercase tracking-wide text-foreground underline underline-offset-4"
                    onClick={() => toggleEvidence(candidate.id)}
                  >
                    {expanded ? "Collapse evidence" : "Expand evidence"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isAdded ? (
                    <button
                      type="button"
                      className="h-7 rounded-full border border-border/60 bg-muted/20 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      disabled
                    >
                      Added ✓
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="h-7 rounded-full border border-border/60 bg-background px-3 text-[11px] font-semibold uppercase tracking-wide text-foreground"
                      onClick={() => handleAddCandidate(candidate)}
                    >
                      Add to session
                    </button>
                  )}
                  <button
                    type="button"
                    className="h-7 rounded-full border border-border/60 bg-muted/10 px-3 text-[11px] font-semibold uppercase tracking-wide text-foreground"
                    onClick={() => handleDismissCandidate(candidate)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}

          {visibleCandidates.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
              No decisions to show yet. Upload a PDF to get started.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
