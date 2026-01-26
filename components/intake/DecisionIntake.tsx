"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { DecisionCandidate } from "@/lib/types/decision";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const DEFAULT_SCORE = 5;

type DecisionIntakeProps = {
  onImportDecisions?: (decisions: DecisionCandidate[]) => void;
};

type IntakeSummary = {
  key_decisions: Array<{
    decision: string;
    why_it_matters?: string;
    source?: {
      fileName: string;
      page: number;
    };
  }>;
  themes?: string[];
  unknowns?: string[];
};

type IntakeDecision = {
  id: string;
  decision: string;
  evidence: string;
  source: {
    fileName: string;
    page: number;
  };
};

type IntakeResponse = {
  summary: IntakeSummary | null;
  decisions: IntakeDecision[];
  meta: {
    pages_processed: number;
    chunks_processed: number;
    candidates_extracted: number;
    decisions_final: number;
    truncated: boolean;
    warnings: string[];
    timing_ms: number;
  };
  errorId?: string;
};

type ProgressStep = "parsing" | "extracting" | "merging" | null;

type ErrorState = {
  message: string;
  errorId?: string;
};

const progressSteps = [
  { key: "parsing" as const, label: "Parsing PDF pages…" },
  { key: "extracting" as const, label: "Extracting candidates…" },
  { key: "merging" as const, label: "Merging & summarizing…" },
];

export default function DecisionIntake({ onImportDecisions }: DecisionIntakeProps) {
  const [intakeFiles, setIntakeFiles] = useState<File[]>([]);
  const [intakeMemo, setIntakeMemo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<ProgressStep>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [summary, setSummary] = useState<IntakeSummary | null>(null);
  const [candidatesAll, setCandidatesAll] = useState<DecisionCandidate[]>([]);
  const [candidatesKeptIds, setCandidatesKeptIds] = useState<Set<string>>(new Set());
  const [expandedDecisions, setExpandedDecisions] = useState<Record<string, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showAllCandidates, setShowAllCandidates] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setProgressStep(null);
      return;
    }

    setProgressStep("parsing");
    const extractTimer = setTimeout(() => setProgressStep("extracting"), 800);
    const mergeTimer = setTimeout(() => setProgressStep("merging"), 3200);

    return () => {
      clearTimeout(extractTimer);
      clearTimeout(mergeTimer);
    };
  }, [isLoading]);

  const keptCandidates = useMemo(
    () => candidatesAll.filter((decision) => candidatesKeptIds.has(decision.id)),
    [candidatesAll, candidatesKeptIds],
  );
  const candidateLimit = 30;
  const visibleCandidates = showAllCandidates ? candidatesAll : candidatesAll.slice(0, candidateLimit);
  const selectedCount = candidatesKeptIds.size;

  const handleFileSelection = useCallback((files: FileList | File[] | null) => {
    setError(null);
    setWarnings([]);
    if (!files || files.length === 0) {
      setIntakeFiles([]);
      return;
    }

    const fileArray = Array.from(files);
    const invalid = fileArray.find(
      (file) => !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")),
    );
    if (invalid) {
      setIntakeFiles([]);
      setError({ message: "Please upload PDF files only." });
      return;
    }

    setIntakeFiles(fileArray);
  }, []);

  const handleAddFiles = useCallback((files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const invalid = incoming.find(
      (file) => !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")),
    );
    if (invalid) {
      setError({ message: "Please upload PDF files only." });
      return;
    }
    setIntakeFiles((prev) => [...prev, ...incoming]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setIntakeFiles((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const clampScore = useCallback((value: number) => {
    if (!Number.isFinite(value)) return DEFAULT_SCORE;
    return Math.min(10, Math.max(1, Math.round(value)));
  }, []);

  const updateDecisionScore = useCallback(
    (id: string, key: "impact" | "cost" | "risk" | "urgency" | "confidence", value: number) => {
      setCandidatesAll((prev) =>
        prev.map((decision) => (decision.id === id ? { ...decision, [key]: clampScore(value) } : decision)),
      );
    },
    [clampScore],
  );

  const updateDecisionText = useCallback((id: string, value: string) => {
    setCandidatesAll((prev) =>
      prev.map((decision) => (decision.id === id ? { ...decision, decision: value } : decision)),
    );
  }, []);

  const toggleDecisionKeep = useCallback((id: string, keep: boolean) => {
    setCandidatesKeptIds((prev) => {
      const next = new Set(prev);
      if (keep) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const mapDecisionsToCandidates = useCallback((decisions: IntakeDecision[]) => {
    return decisions.map((decision) => ({
      id: decision.id,
      decision: decision.decision,
      evidence: decision.evidence,
      sources: [
        {
          fileName: decision.source.fileName,
          pageNumber: decision.source.page,
          excerpt: decision.evidence,
        },
      ],
      extractConfidence: 0.7,
      qualityScore: 0.8,
      impact: DEFAULT_SCORE,
      cost: DEFAULT_SCORE,
      risk: DEFAULT_SCORE,
      urgency: DEFAULT_SCORE,
      confidence: DEFAULT_SCORE,
    }));
  }, []);

  const runIntake = useCallback(
    async (mode: "extract" | "summarize" | "extract+summarize") => {
      setError(null);
      setWarnings([]);
      setIsLoading(true);
      setShowAllCandidates(false);

      try {
        if (!intakeMemo.trim() && intakeFiles.length === 0) {
          setError({ message: "Add PDFs or paste text to extract decisions." });
          return;
        }

        const formData = new FormData();
        formData.append("mode", mode);
        if (intakeMemo.trim()) {
          formData.append("memo", intakeMemo.trim());
        }
        intakeFiles.forEach((file) => {
          formData.append("files", file);
        });

        const response = await fetch("/api/decision-intake", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as IntakeResponse;
        if (!response.ok) {
          setError({ message: "Decision intake failed.", errorId: payload?.errorId });
          return;
        }

        if (!Array.isArray(payload.decisions) || payload.decisions.length === 0) {
          setError({ message: "No decisions found. Try adding clearer decision language.", errorId: payload?.errorId });
          return;
        }

        setWarnings(Array.isArray(payload.meta?.warnings) ? payload.meta.warnings : []);
        setSummary(payload.summary ?? null);
        setCandidatesAll(mapDecisionsToCandidates(payload.decisions));
        setCandidatesKeptIds(new Set());
        setExpandedDecisions({});
        setExpandedSources({});
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Extraction failed.";
        console.error("Decision extraction failed", caughtError);
        setError({ message });
      } finally {
        setIsLoading(false);
      }
    },
    [intakeFiles, intakeMemo, mapDecisionsToCandidates],
  );

  const handleExtract = useCallback(() => runIntake("extract"), [runIntake]);

  const handleSummarize = useCallback(() => {
    if (candidatesAll.length === 0) {
      void runIntake("extract+summarize");
      return;
    }
    void runIntake("summarize");
  }, [candidatesAll.length, runIntake]);

  const toggleExpandedDecision = useCallback((id: string) => {
    setExpandedDecisions((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleExpandedSource = useCallback((id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleClearIntake = useCallback(() => {
    setIntakeFiles([]);
    setIntakeMemo("");
    setCandidatesAll([]);
    setCandidatesKeptIds(new Set());
    setExpandedDecisions({});
    setExpandedSources({});
    setWarnings([]);
    setError(null);
    setSummary(null);
    setShowAllCandidates(false);
  }, []);

  const handleClearCandidates = useCallback(() => {
    setCandidatesAll([]);
    setCandidatesKeptIds(new Set());
    setExpandedDecisions({});
    setExpandedSources({});
    setSummary(null);
    setShowAllCandidates(false);
  }, []);

  const handleAddToSession = useCallback(() => {
    if (!onImportDecisions || keptCandidates.length === 0) return;
    onImportDecisions(keptCandidates);
    setCandidatesAll((prev) =>
      prev.map((decision) =>
        candidatesKeptIds.has(decision.id) ? { ...decision, imported: true } : decision,
      ),
    );
    setCandidatesKeptIds(new Set());
  }, [candidatesKeptIds, keptCandidates, onImportDecisions]);

  const activeStepIndex = progressStep
    ? progressSteps.findIndex((step) => step.key === progressStep)
    : -1;

  return (
    <section className="mt-6 space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">Decision intake built for real documents</h2>
        <p className="text-sm text-muted-foreground">
          Upload a memo, earnings deck, or paste text. We’ll extract decisions and summarize what matters.
        </p>
        <p className="text-xs text-muted-foreground">
          The flow is split into parsing, extraction, and merging so you can see progress.
        </p>
      </div>

      <Card className="gap-4 border-border/60 bg-background/80 px-4 py-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Drag & drop / Choose PDF
              </p>
              <div
                className="flex min-h-[132px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground"
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleAddFiles(event.dataTransfer.files ?? null);
                }}
              >
                <div className="flex w-full flex-col items-center gap-2">
                  {intakeFiles.length === 0 ? (
                    <label className="flex cursor-pointer flex-col items-center gap-2">
                      <span>Drop PDFs here or Choose files</span>
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        className="hidden"
                        onChange={(event) => handleFileSelection(event.target.files)}
                      />
                      <span className="text-[11px] font-semibold text-foreground underline">Choose files</span>
                    </label>
                  ) : (
                    <div className="flex w-full flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {intakeFiles.map((file, index) => (
                          <span
                            key={`${file.name}-${file.lastModified}-${index}`}
                            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground"
                          >
                            {file.name}
                            <button
                              type="button"
                              className="text-[11px] text-muted-foreground hover:text-foreground"
                              onClick={() => handleRemoveFile(index)}
                              aria-label={`Remove ${file.name}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-foreground underline">
                        + Add more
                        <input
                          type="file"
                          accept=".pdf"
                          multiple
                          className="hidden"
                          onChange={(event) => handleAddFiles(event.target.files)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Paste text memo
            </label>
            <Textarea
              value={intakeMemo}
              onChange={(event) => setIntakeMemo(event.target.value)}
              placeholder="Paste the excerpt you want to scan for decisions."
              className="min-h-[128px] bg-background"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span>Processing intake…</span>
            </div>
            <ol className="space-y-1">
              {progressSteps.map((step, index) => (
                <li key={step.key} className={index <= activeStepIndex ? "text-foreground" : "text-muted-foreground"}>
                  {step.label}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            <p className="text-[11px] font-semibold uppercase tracking-wide">Warnings</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <div
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            <p>{error.message}</p>
            {error.errorId ? <p className="mt-1 text-[11px]">Error ID: {error.errorId}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">We’ll only analyze the text you provide here.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
              onClick={handleClearIntake}
              disabled={isLoading}
            >
              Clear Intake
            </Button>
            <Button
              variant="outline"
              className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
              onClick={handleExtract}
              disabled={isLoading}
            >
              {isLoading ? "Extracting..." : "Extract Decisions"}
            </Button>
            <Button
              className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
              onClick={handleSummarize}
              disabled={isLoading}
            >
              {isLoading ? "Summarizing..." : "Summarize Key Decisions"}
            </Button>
          </div>
        </div>
      </Card>

      {summary ? (
        <Card className="space-y-3 border-border/60 bg-background/80 px-4 py-4 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Key Decisions Summary</p>
            <p className="text-xs text-muted-foreground">High-signal takeaways ready for scoring.</p>
          </div>
          <ul className="list-disc space-y-2 pl-4 text-sm text-foreground">
            {summary.key_decisions.map((item, index) => (
              <li key={`${item.decision}-${index}`}>
                <p className="font-medium">{item.decision}</p>
                {item.why_it_matters ? (
                  <p className="text-xs text-muted-foreground">{item.why_it_matters}</p>
                ) : null}
                {item.source ? (
                  <p className="text-[11px] text-muted-foreground">
                    {item.source.fileName} • p{item.source.page}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {summary.themes?.length ? (
            <div className="text-xs text-muted-foreground">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Themes</p>
              <p>{summary.themes.join(" • ")}</p>
            </div>
          ) : null}
          {summary.unknowns?.length ? (
            <div className="text-xs text-muted-foreground">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Unknowns</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {summary.unknowns.map((unknown) => (
                  <li key={unknown}>{unknown}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      {candidatesAll.length > 0 ? (
        <div className="space-y-3">
          <div className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Decision Candidates</p>
              <p className="text-xs text-muted-foreground">
                Found {candidatesAll.length.toLocaleString()} decisions. Select what counts, then import to the session.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[11px] font-semibold text-foreground">
                Selected: {selectedCount}
              </span>
              <Button
                size="sm"
                className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
                onClick={handleAddToSession}
                disabled={selectedCount === 0}
              >
                ✅ ADD KEPT DECISIONS TO SESSION
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
                onClick={handleClearCandidates}
              >
                CLEAR CANDIDATES
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {visibleCandidates.map((decision) => {
              const source = decision.sources[0];
              const sourceLabel = source?.fileName
                ? `${source.fileName}${source.pageNumber ? ` • p${source.pageNumber}` : ""}`
                : undefined;
              const isExpanded = Boolean(expandedDecisions[decision.id]);
              const isSourceExpanded = Boolean(expandedSources[decision.id]);

              return (
                <div
                  key={decision.id}
                  className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background/80 px-4 py-3 shadow-sm lg:flex-row lg:items-start"
                >
                  <div className="flex-1 space-y-2">
                    <Input
                      value={decision.decision}
                      onChange={(event) => updateDecisionText(decision.id, event.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="flex items-start gap-2">
                      <p className={`text-[11px] text-muted-foreground ${isExpanded ? "" : "line-clamp-2"}`}>
                        {decision.evidence}
                      </p>
                      <button
                        type="button"
                        className="mt-0.5 rounded-md border border-border/70 bg-muted/20 px-1.5 py-1 text-[10px] font-semibold text-muted-foreground"
                        onClick={() => toggleExpandedDecision(decision.id)}
                      >
                        {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      {sourceLabel ? <span>{sourceLabel}</span> : null}
                      {decision.imported ? (
                        <Badge variant="outline" className="h-5 rounded-full px-2 text-[9px] font-semibold">
                          Imported
                        </Badge>
                      ) : null}
                      {source?.excerpt ? (
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-foreground underline-offset-2 hover:underline"
                          onClick={() => toggleExpandedSource(decision.id)}
                        >
                          {isSourceExpanded ? "Hide source excerpt" : "Show source excerpt"}
                        </button>
                      ) : null}
                    </div>
                    {isSourceExpanded && source?.excerpt ? (
                      <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                        {source.excerpt}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-5">
                    {(["impact", "cost", "risk", "urgency", "confidence"] as const).map((key) => (
                      <label key={`${decision.id}-${key}`} className="space-y-1 text-[10px] text-muted-foreground">
                        <span className="block text-center uppercase tracking-wide">{key}</span>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={decision[key]}
                          onChange={(event) => updateDecisionScore(decision.id, key, Number(event.target.value))}
                          className="h-8 w-16 text-center text-sm"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-end lg:justify-center">
                    <div className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
                      <span>Keep</span>
                      <Switch
                        checked={candidatesKeptIds.has(decision.id)}
                        onCheckedChange={(checked) => toggleDecisionKeep(decision.id, checked)}
                        disabled={decision.imported}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {candidatesAll.length > candidateLimit ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
                  onClick={() => setShowAllCandidates((prev) => !prev)}
                >
                  {showAllCandidates
                    ? `Show top ${candidateLimit}`
                    : `Show ${candidatesAll.length - candidateLimit} more`}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
