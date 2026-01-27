"use client";

import SliderRow from "@/components/SliderRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { extractDecisionCandidates, type DecisionCandidate } from "@/lib/intake/decisionExtractLocal";
import { type DecisionCategory } from "@/lib/intake/decisionScoring";
import { splitSections } from "@/lib/intake/sectionSplit";
import { buildLocalSummary, type DocumentSummary } from "@/lib/intake/summaryLocal";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import { normalizePdfText, type NormalizedPdfPage } from "@/lib/pdf/normalizePdfText";
import { useCallback, useEffect, useMemo, useState } from "react";

const LOCAL_EXTRACTION_NOTICE = "Local-only extraction. No OpenAI or API calls.";
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

const TOP_PICK_LIMIT = 12;

export type AddDecisionResult = {
  added: boolean;
  decisionId: string;
  total: number;
};

export type AddMultipleResult = {
  addedCount: number;
  total: number;
  lastAddedId?: string | null;
};

type PdfDecisionIntakeProps = {
  onAddDecision: (candidate: DecisionCandidate, sourceFile: string | null) => AddDecisionResult;
  onAddMultiple: (candidates: DecisionCandidate[], sourceFile: string | null) => AddMultipleResult;
  onJumpToDecision: (decisionId: string) => void;
};

type ExtractState = {
  docName: string | null;
  pages: NormalizedPdfPage[];
  pageCount: number;
};

export default function PdfDecisionIntake({
  onAddDecision,
  onAddMultiple,
  onJumpToDecision,
}: PdfDecisionIntakeProps) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [extractState, setExtractState] = useState<ExtractState>({ docName: null, pages: [], pageCount: 0 });
  const [pagesRead, setPagesRead] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [decisionCandidates, setDecisionCandidates] = useState<DecisionCandidate[]>([]);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractStage, setExtractStage] = useState<"idle" | "finding" | "summarizing" | "done">("idle");
  const [autoExtractPending, setAutoExtractPending] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [hardOnly, setHardOnly] = useState(false);
  const [hideTables, setHideTables] = useState(true);
  const [hideDisclaimers, setHideDisclaimers] = useState(true);
  const [toastNotice, setToastNotice] = useState<{
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  useEffect(() => {
    if (!toastNotice) return;
    const timeout = window.setTimeout(() => setToastNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toastNotice]);

  const handlePdfUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFileName(file?.name ?? null);
    setExtractState({ docName: null, pages: [], pageCount: 0 });
    setPagesRead(0);
    setTotalChars(0);
    setDecisionCandidates([]);
    setSummary(null);
    setDismissedIds(new Set());
    setAddedIds(new Set());
    setExtractError(null);
    setShowAllCandidates(false);
    setHardOnly(false);
    setHideTables(true);
    setHideDisclaimers(true);
    if (!file) return;
    if (file.type !== "application/pdf") {
      setExtractError("Please upload a PDF file.");
      return;
    }

    setIsReadingPdf(true);
    try {
      const extracted = await extractPdfText(file);
      const normalized = normalizePdfText(extracted.pages);
      const pages = normalized.pages;
      const charCount = pages.reduce((sum, page) => sum + page.text.length, 0);
      const emptyPages = pages.filter((page) => page.text.length === 0).length;

      setExtractState({ docName: extracted.docName, pages, pageCount: extracted.pageCount });
      setPagesRead(pages.length);
      setTotalChars(charCount);
      setAutoExtractPending(true);

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
    if (extractState.pages.length === 0 || isExtracting) return;
    setIsExtracting(true);
    setExtractError(null);
    setExtractStage("finding");
    setDismissedIds(new Set());
    setShowAllCandidates(false);
    setDecisionCandidates([]);

    try {
      const sections = splitSections(extractState.pages);
      // Optional future enhancement: add an opt-in AI summarizer that refines summary + candidates.
      const localSummary = buildLocalSummary(extractState.docName ?? "Document", extractState.pages, sections);
      setExtractStage("summarizing");
      const candidates = extractDecisionCandidates(extractState.pages, sections, { maxCandidates: 32 });
      setDecisionCandidates(candidates);
      setSummary(localSummary);
      if (candidates.length === 0) {
        setExtractError("No clear commitments found. Try a different PDF or expand detection.");
      }
      setExtractStage("done");
    } catch (error) {
      console.error("Decision extraction error.", error);
      setExtractError("Decision extraction failed. Please retry or try a different PDF.");
      setExtractStage("done");
    } finally {
      setIsExtracting(false);
      setAutoExtractPending(false);
    }
  }, [extractState, isExtracting]);

  useEffect(() => {
    if (!autoExtractPending) return;
    if (isReadingPdf || isExtracting || extractState.pages.length === 0) return;
    handleExtractDecisions();
  }, [autoExtractPending, extractState.pages.length, handleExtractDecisions, isExtracting, isReadingPdf]);

  const rankedCandidates = useMemo(() => {
    return [...decisionCandidates].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.evidence.page !== b.evidence.page) return a.evidence.page - b.evidence.page;
      return a.title.localeCompare(b.title);
    });
  }, [decisionCandidates]);

  const filteredCandidates = useMemo(() => {
    return rankedCandidates.filter((candidate) => {
      if (dismissedIds.has(candidate.id)) return false;
      if (hardOnly && candidate.strength !== "hard") return false;
      if (hideTables && candidate.meta.isTableLike) return false;
      if (hideDisclaimers && candidate.meta.isBoilerplate) return false;
      return true;
    });
  }, [dismissedIds, hardOnly, hideDisclaimers, hideTables, rankedCandidates]);

  const visibleCandidates = useMemo(() => {
    return showAllCandidates ? filteredCandidates : filteredCandidates.slice(0, TOP_PICK_LIMIT);
  }, [filteredCandidates, showAllCandidates]);

  const hasMoreCandidates = filteredCandidates.length > TOP_PICK_LIMIT;

  const updateCandidate = useCallback((candidateId: string, next: Partial<DecisionCandidate>) => {
    setDecisionCandidates((prev) => prev.map((item) => (item.id === candidateId ? { ...item, ...next } : item)));
  }, []);

  const updateCandidateSlider = useCallback((candidateId: string, key: keyof DecisionCandidate["sliders"], value: number) => {
    setDecisionCandidates((prev) =>
      prev.map((item) =>
        item.id === candidateId ? { ...item, sliders: { ...item.sliders, [key]: value } } : item,
      ),
    );
  }, []);

  const handleAddToSession = useCallback(
    (candidate: DecisionCandidate) => {
      const result = onAddDecision(candidate, selectedFileName);
      if (result.added) {
        setAddedIds((prev) => new Set(prev).add(candidate.id));
        setToastNotice({
          message: `Added to session (${result.total} total)`,
          actionLabel: "Jump to decision",
          onAction: () => onJumpToDecision(result.decisionId),
        });
      }
    },
    [onAddDecision, onJumpToDecision, selectedFileName],
  );

  const handleAddMultiple = useCallback(() => {
    if (visibleCandidates.length === 0) return;
    const result = onAddMultiple(visibleCandidates, selectedFileName);
    setAddedIds((prev) => {
      const next = new Set(prev);
      visibleCandidates.forEach((candidate) => next.add(candidate.id));
      return next;
    });
    if (result.addedCount > 0) {
      setToastNotice({
        message: `Added ${result.addedCount} to session (${result.total} total)`,
        actionLabel: "Jump to decision",
        onAction: () => (result.lastAddedId ? onJumpToDecision(result.lastAddedId) : undefined),
      });
    }
  }, [onAddMultiple, onJumpToDecision, selectedFileName, visibleCandidates]);

  const handleDismissCandidate = useCallback((candidate: DecisionCandidate) => {
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

  const handleDismissAll = useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      visibleCandidates.forEach((candidate) => next.add(candidate.id));
      return next;
    });
  }, [visibleCandidates]);

  return (
    <div className="space-y-4">
      <div className="dnav-dark-glass-surface rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm">
        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Decision Intake</h2>
              <p className="text-xs text-muted-foreground">
                Upload a PDF. We’ll locally extract a summary and decision candidates (commitments, launches, build/ramp
                statements, planned actions).
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-4">
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
                className="text-xs text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              <span>Pages read: {pagesRead}</span>
              <span>Total chars: {totalChars.toLocaleString()}</span>
              {isReadingPdf ? <span className="font-semibold text-foreground">Reading PDF…</span> : null}
              {isExtracting && extractStage === "finding" ? (
                <span className="font-semibold text-foreground">Finding decision candidates…</span>
              ) : null}
              {isExtracting && extractStage === "summarizing" ? (
                <span className="font-semibold text-foreground">Summarizing document…</span>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] text-emerald-600">{LOCAL_EXTRACTION_NOTICE}</p>
            {extractError ? <p className="mt-2 text-[11px] text-rose-500">{extractError}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="h-9 rounded-full px-4 text-xs font-semibold uppercase tracking-wide"
              onClick={handleExtractDecisions}
              disabled={extractState.pages.length === 0 || isReadingPdf || isExtracting}
            >
              {isExtracting ? "Extracting…" : "Extract decisions"}
            </Button>
            {extractState.pageCount > 0 ? (
              <span className="text-[11px] text-muted-foreground">Pages detected: {extractState.pageCount}</span>
            ) : null}
          </div>
        </div>
      </div>

      {summary ? (
        <div className="dnav-dark-glass-surface rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Document Summary</h3>
              <p className="text-[11px] text-muted-foreground">{summary.overview}</p>
            </div>
            {summary.themes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {summary.themes.map((theme) => (
                  <span
                    key={theme}
                    className="rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {summary.bullets.length > 0 ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {summary.bullets.map((item) => (
                <div key={item.label} className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="text-[11px] text-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {decisionCandidates.length > 0 ? (
        <div className="dnav-dark-glass-surface rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Key Decisions <span className="text-muted-foreground">({decisionCandidates.length})</span>
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
                  className="h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wide"
                  onClick={handleAddMultiple}
                  disabled={visibleCandidates.length === 0}
                >
                  Add all (shown)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wide"
                  onClick={handleDismissAll}
                  disabled={visibleCandidates.length === 0}
                >
                  Dismiss all
                </Button>
                {hasMoreCandidates && !showAllCandidates ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wide"
                    onClick={() => setShowAllCandidates(true)}
                  >
                    Show more
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={hardOnly ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-[10px] font-semibold uppercase tracking-wide"
                onClick={() => setHardOnly((prev) => !prev)}
              >
                Hard only
              </Button>
              <Button
                type="button"
                size="sm"
                variant={hideTables ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-[10px] font-semibold uppercase tracking-wide"
                onClick={() => setHideTables((prev) => !prev)}
              >
                Hide finance tables
              </Button>
              <Button
                type="button"
                size="sm"
                variant={hideDisclaimers ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-[10px] font-semibold uppercase tracking-wide"
                onClick={() => setHideDisclaimers((prev) => !prev)}
              >
                Hide disclaimers
              </Button>
            </div>

            <div className="space-y-3">
              {visibleCandidates.map((candidate) => {
                const isAdded = addedIds.has(candidate.id);
                const isExpanded = expandedEvidence.has(candidate.id);
                return (
                  <div
                    key={candidate.id}
                    className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-4 text-xs text-muted-foreground"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</p>
                        <Input
                          value={candidate.title}
                          onChange={(event) => updateCandidate(candidate.id, { title: event.target.value })}
                          className="h-8 text-sm"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{candidate.section ?? "General"}</span>
                          <span>•</span>
                          <span>{candidate.evidence.page ? `p. ${candidate.evidence.page}` : "Page n/a"}</span>
                          {candidate.alsoSeenOnPages?.length ? (
                            <span>Also on p. {candidate.alsoSeenOnPages.join(", ")}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={candidate.strength === "hard" ? "default" : "outline"}
                          className="h-7 rounded-full px-3 text-[10px] font-semibold uppercase tracking-wide"
                          onClick={() => updateCandidate(candidate.id, { strength: "hard" })}
                        >
                          Hard
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={candidate.strength === "soft" ? "default" : "outline"}
                          className="h-7 rounded-full px-3 text-[10px] font-semibold uppercase tracking-wide"
                          onClick={() => updateCandidate(candidate.id, { strength: "soft" })}
                        >
                          Soft
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Decision</p>
                      <Textarea
                        value={candidate.decision}
                        onChange={(event) => updateCandidate(candidate.id, { decision: event.target.value })}
                        className="min-h-[84px] text-[11px]"
                      />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
                        <select
                          value={candidate.category}
                          onChange={(event) =>
                            updateCandidate(candidate.id, {
                              category: event.target.value as DecisionCategory,
                            })
                          }
                          className="mt-1 h-8 w-full rounded-full border border-border/60 bg-background px-3 text-[11px] font-semibold text-foreground"
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
                          Evidence
                        </p>
                        <p className="text-[11px] text-foreground">“{candidate.evidence.quote}”</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] font-semibold uppercase tracking-wide"
                          onClick={() =>
                            setExpandedEvidence((prev) => {
                              const next = new Set(prev);
                              if (next.has(candidate.id)) next.delete(candidate.id);
                              else next.add(candidate.id);
                              return next;
                            })
                          }
                        >
                          {isExpanded ? "Collapse" : "Expand"}
                        </Button>
                        {isExpanded ? (
                          <p className="text-[11px] text-muted-foreground">{candidate.evidence.fullQuote}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-border/50 bg-muted/5 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        D-NAV sliders
                      </p>
                      <div className="mt-1 space-y-1">
                        <SliderRow
                          id={`${candidate.id}-impact`}
                          label="Impact"
                          value={candidate.sliders.impact}
                          onChange={(value) => updateCandidateSlider(candidate.id, "impact", value)}
                          compact
                        />
                        <SliderRow
                          id={`${candidate.id}-cost`}
                          label="Cost"
                          value={candidate.sliders.cost}
                          onChange={(value) => updateCandidateSlider(candidate.id, "cost", value)}
                          compact
                        />
                        <SliderRow
                          id={`${candidate.id}-risk`}
                          label="Risk"
                          value={candidate.sliders.risk}
                          onChange={(value) => updateCandidateSlider(candidate.id, "risk", value)}
                          compact
                        />
                        <SliderRow
                          id={`${candidate.id}-urgency`}
                          label="Urgency"
                          value={candidate.sliders.urgency}
                          onChange={(value) => updateCandidateSlider(candidate.id, "urgency", value)}
                          compact
                        />
                        <SliderRow
                          id={`${candidate.id}-confidence`}
                          label="Confidence"
                          value={candidate.sliders.confidence}
                          onChange={(value) => updateCandidateSlider(candidate.id, "confidence", value)}
                          compact
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wide"
                          onClick={() => handleAddToSession(candidate)}
                          disabled={isAdded}
                        >
                          {isAdded ? "Added" : "Add to session"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wide"
                          onClick={() => handleDismissCandidate(candidate)}
                        >
                          Dismiss
                        </Button>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Signal score: <span className="font-semibold text-foreground">{candidate.score}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {toastNotice ? (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-border/60 bg-white/90 px-4 py-3 text-[11px] text-foreground shadow-lg">
          <span className="font-semibold">{toastNotice.message}</span>
          {toastNotice.actionLabel ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide"
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
    </div>
  );
}
