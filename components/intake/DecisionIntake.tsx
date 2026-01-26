"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { DecisionCandidate } from "@/lib/types/decision";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const MAX_API_CANDIDATES = 120;
const API_CHUNK_SIZE = 30;

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

type DecisionIntakeProps = {
  onImportDecisions?: (decisions: DecisionCandidate[]) => void;
};

type ApiDecisionPayload = {
  id: string;
  decision: string;
  evidence: string;
  source?: {
    fileName?: string;
    page?: number;
  };
};

type ApiRefinedCandidate = {
  id: string;
  rewrittenDecision: string;
  reasonKeep?: string;
  mergedFromIds?: string[];
};

type ApiRefinementResponse = {
  kept_candidates?: ApiRefinedCandidate[];
  drop_ids?: string[];
  notes?: string;
};

type IntakeResponse = {
  candidates?: DecisionCandidate[];
  warning?: string;
  debug?: {
    pagesExtracted: number;
    totalChars: number;
    chunks: number;
    candidatesExtracted: number;
    candidatesAfterQuality: number;
    notes?: string[];
  };
  error?: {
    message?: string;
    step?: string;
  };
  errorId?: string;
};

export default function DecisionIntake({ onImportDecisions }: DecisionIntakeProps) {
  const [intakeFiles, setIntakeFiles] = useState<File[]>([]);
  const [intakeMemo, setIntakeMemo] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [candidatesAll, setCandidatesAll] = useState<DecisionCandidate[]>([]);
  const [candidatesKeptIds, setCandidatesKeptIds] = useState<Set<string>>(new Set());
  const [expandedDecisions, setExpandedDecisions] = useState<Record<string, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [debugInfo, setDebugInfo] = useState<IntakeResponse["debug"] | null>(null);

  const keptCandidates = useMemo(
    () => candidatesAll.filter((decision) => candidatesKeptIds.has(decision.id)),
    [candidatesAll, candidatesKeptIds],
  );
  const candidateLimit = 30;
  const visibleCandidates = showAllCandidates ? candidatesAll : candidatesAll.slice(0, candidateLimit);
  const selectedCount = candidatesKeptIds.size;

  const handleFileSelection = useCallback((files: FileList | File[] | null) => {
    setError(null);
    setWarning(null);
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
      setError("Please upload PDF files only.");
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
      setError("Please upload PDF files only.");
      return;
    }
    setIntakeFiles((prev) => [...prev, ...incoming]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setIntakeFiles((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const clampScore = useCallback((value: number) => {
    if (!Number.isFinite(value)) return 1;
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

  const mergeSources = useCallback((base: DecisionCandidate, incoming: DecisionCandidate[]) => {
    const merged = [...base.sources];
    for (const candidate of incoming) {
      for (const source of candidate.sources) {
        const exists = merged.some(
          (entry) =>
            entry.fileName === source.fileName &&
            entry.pageNumber === source.pageNumber &&
            entry.excerpt === source.excerpt,
        );
        if (!exists) merged.push(source);
      }
    }
    return merged;
  }, []);

  const buildApiPayload = useCallback((extracted: DecisionCandidate[]) => {
    const ranked = [...extracted].sort((a, b) => b.qualityScore - a.qualityScore);
    return ranked.slice(0, MAX_API_CANDIDATES).map((candidate) => {
      const source = candidate.sources[0];
      return {
        id: candidate.id,
        decision: candidate.decision,
        evidence: candidate.evidence,
        source: {
          fileName: source?.fileName,
          page: source?.pageNumber,
        },
      } satisfies ApiDecisionPayload;
    });
  }, []);

  const applyRefinement = useCallback(
    (prev: DecisionCandidate[], refinement: ApiRefinementResponse) => {
      if (!refinement) return prev;
      const dropIds = new Set(refinement.drop_ids ?? []);
      const keptCandidates = refinement.kept_candidates ?? [];
      const byId = new Map(prev.map((candidate) => [candidate.id, candidate]));
      const mergedIds = new Set<string>();

      const updated = prev.map((candidate) => {
        const kept = keptCandidates.find((item) => item.id === candidate.id);
        if (!kept) return candidate;
        const updatedDecision = kept.rewrittenDecision?.trim() || candidate.decision;
        const mergeFrom = kept.mergedFromIds ?? [];
        if (mergeFrom.length > 0) {
          mergeFrom.forEach((id) => mergedIds.add(id));
        }
        const mergedSources = mergeFrom.length
          ? mergeSources(candidate, mergeFrom.map((id) => byId.get(id)).filter(Boolean) as DecisionCandidate[])
          : candidate.sources;
        return {
          ...candidate,
          decision: updatedDecision,
          sources: mergedSources,
        };
      });

      const finalDropIds = new Set([...dropIds, ...mergedIds]);
      return updated.filter((candidate) => !finalDropIds.has(candidate.id));
    },
    [mergeSources],
  );

  const refineCandidatesInBackground = useCallback(
    async (extracted: DecisionCandidate[]) => {
      const payload = buildApiPayload(extracted);
      if (payload.length === 0) return;
      const chunks = chunkArray(payload, API_CHUNK_SIZE);
      for (const chunk of chunks) {
        try {
          const response = await fetch("/api/decision-candidates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidates: chunk }),
          });
          if (!response.ok) continue;
          const data = (await response.json()) as ApiRefinementResponse;
          if (!data) continue;
          setCandidatesAll((prev) => applyRefinement(prev, data));
          const dropIds = new Set<string>(data.drop_ids ?? []);
          (data.kept_candidates ?? []).forEach((candidate) => {
            (candidate.mergedFromIds ?? []).forEach((id) => dropIds.add(id));
          });
          if (dropIds.size > 0) {
            setCandidatesKeptIds((prev) => {
              const next = new Set(prev);
              dropIds.forEach((id) => next.delete(id));
              return next;
            });
          }
        } catch (apiError) {
          console.error("Decision refinement failed", apiError);
        }
      }
    },
    [applyRefinement, buildApiPayload],
  );

  const handleExtract = useCallback(async () => {
    setError(null);
    setWarning(null);
    setDebugInfo(null);
    setIsParsing(true);
    setShowAllCandidates(false);

    try {
      if (!intakeMemo.trim() && intakeFiles.length === 0) {
        setError("Add PDFs or paste text to extract decisions.");
        return;
      }

      const formData = new FormData();
      if (intakeMemo.trim()) {
        formData.append("memo", intakeMemo.trim());
      }
      intakeFiles.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("mode", "extract+summarize");

      const response = await fetch("/api/decision-intake", {
        method: "POST",
        body: formData,
      });

      let payload: IntakeResponse | null = null;
      try {
        payload = (await response.json()) as IntakeResponse;
      } catch (parseError) {
        console.error("Failed to parse decision intake response.", parseError);
      }
      if (!response.ok) {
        const fallbackMessage = "Decision extraction failed.";
        const message = payload?.error?.message?.trim() || fallbackMessage;
        const errorParts = [message, `Status ${response.status}`];
        if (payload?.error?.step) errorParts.push(`Step: ${payload.error.step}`);
        if (payload?.errorId) errorParts.push(`Error ID: ${payload.errorId}`);
        setError(errorParts.join(" • "));
        return;
      }

      const extractedCandidates = Array.isArray(payload?.candidates) ? payload?.candidates : [];
      if (extractedCandidates.length === 0) {
        setError("No decisions found. Try adding clearer decision language.");
        return;
      }

      if (payload?.warning) {
        setWarning(payload.warning);
      }

      setCandidatesAll(extractedCandidates);
      setCandidatesKeptIds(new Set());
      setExpandedDecisions({});
      setExpandedSources({});
      if (process.env.NODE_ENV !== "production") {
        setDebugInfo(payload?.debug ?? null);
      }

      if (process.env.NODE_ENV !== "production" && payload?.debug) {
        console.debug("Decision extraction debug", {
          ...payload.debug,
          candidatesRendered: Math.min(candidateLimit, extractedCandidates.length),
        });
      }

      void refineCandidatesInBackground(extractedCandidates);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Extraction failed.";
      console.error("Decision extraction failed", caughtError);
      setError(message);
    } finally {
      setIsParsing(false);
    }
  }, [candidateLimit, intakeFiles, intakeMemo, refineCandidatesInBackground]);

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
    setWarning(null);
    setError(null);
    setShowAllCandidates(false);
    setDebugInfo(null);
  }, []);

  const handleClearCandidates = useCallback(() => {
    setCandidatesAll([]);
    setCandidatesKeptIds(new Set());
    setExpandedDecisions({});
    setExpandedSources({});
    setShowAllCandidates(false);
    setDebugInfo(null);
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

  return (
    <section className="mt-6 space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">The fastest way to surface decisions</h2>
        <p className="text-sm text-muted-foreground">
          Upload a memo, financial report, or paste text. We’ll extract decision candidates you can score instantly.
        </p>
        <p className="text-xs text-muted-foreground">
          We surface candidates that look like committed intent under constraint. You curate what counts.
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
              {isParsing && intakeFiles.length > 0 ? (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  <span>Parsing PDFs…</span>
                </div>
              ) : null}
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

        {warning ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            {warning}
          </div>
        ) : null}

        {error ? (
          <div
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {debugInfo && process.env.NODE_ENV !== "production" ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Debug</p>
            <ul className="mt-1 space-y-1">
              <li>Pages extracted: {debugInfo.pagesExtracted}</li>
              <li>Total chars: {debugInfo.totalChars.toLocaleString()}</li>
              <li>Chunks: {debugInfo.chunks}</li>
              <li>Candidates extracted: {debugInfo.candidatesExtracted}</li>
              <li>Candidates after quality: {debugInfo.candidatesAfterQuality}</li>
              {debugInfo.notes?.length ? (
                <li>
                  Notes:
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {debugInfo.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">We’ll only analyze the text you provide here.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
              onClick={handleClearIntake}
              disabled={isParsing}
            >
              Clear Intake
            </Button>
            <Button
              className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
              onClick={handleExtract}
              disabled={isParsing}
            >
              {isParsing ? "Extracting..." : "Extract Decisions"}
            </Button>
          </div>
        </div>
      </Card>

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
