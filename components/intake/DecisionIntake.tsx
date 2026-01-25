"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PdfProgress } from "@/lib/pdf/extractPdfText";
import { distillSources, type DistillStage } from "@/lib/decisionExtract/distillSources";
import type { DecisionCandidate } from "@/lib/types/decision";
import { ChevronDown, ChevronUp } from "lucide-react";

const MAX_FILES = 5;

type DecisionIntakeProps = {
  onImportDecisions?: (decisions: DecisionCandidate[], options?: { mode: "sync" | "append" }) => void;
};

type IntakeProgress = PdfProgress & {
  fileIndex: number;
  totalFiles: number;
  fileName: string;
};

export default function DecisionIntake({ onImportDecisions }: DecisionIntakeProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [pdfProgress, setPdfProgress] = useState<IntakeProgress | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionCandidate[]>([]);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [expandedDecisions, setExpandedDecisions] = useState<Record<string, boolean>>({});

  const progressLabel = useMemo(() => {
    if (pdfProgress) {
      return `Parsing PDFs ${pdfProgress.fileIndex}/${pdfProgress.totalFiles} … page ${pdfProgress.page}/${pdfProgress.total} (${pdfProgress.fileName})`;
    }
    if (statusMessage) {
      return statusMessage;
    }
    if (isExtracting) {
      return "Extracting decisions...";
    }
    return null;
  }, [isExtracting, pdfProgress, statusMessage]);

  const handleFileSelection = useCallback((files: FileList | File[] | null) => {
    setError(null);
    setWarning(null);
    setPdfProgress(null);
    if (!files || files.length === 0) {
      setSelectedFiles([]);
      return;
    }

    const fileArray = Array.from(files).slice(0, MAX_FILES);
    const invalid = fileArray.find(
      (file) => !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")),
    );
    if (invalid) {
      setSelectedFiles([]);
      setError("Please upload PDF files only.");
      return;
    }

    if (files.length > MAX_FILES) {
      setWarning(`Only the first ${MAX_FILES} PDFs were added.`);
    }
    setSelectedFiles(fileArray);
  }, []);

  const clampScore = useCallback((value: number) => {
    if (!Number.isFinite(value)) return 1;
    return Math.min(10, Math.max(1, Math.round(value)));
  }, []);

  const updateDecisionScore = useCallback(
    (id: string, key: "impact" | "cost" | "risk" | "urgency" | "confidence", value: number) => {
      setDecisions((prev) =>
        prev.map((decision) => (decision.id === id ? { ...decision, [key]: clampScore(value) } : decision)),
      );
    },
    [clampScore],
  );

  const updateDecisionText = useCallback((id: string, value: string) => {
    setDecisions((prev) => prev.map((decision) => (decision.id === id ? { ...decision, decision: value } : decision)));
  }, []);

  const toggleDecisionKeep = useCallback((id: string, keep: boolean) => {
    setDecisions((prev) => prev.map((decision) => (decision.id === id ? { ...decision, keep } : decision)));
  }, []);

  const handleExtract = useCallback(async () => {
    setError(null);
    setWarning(null);
    setIsExtracting(true);
    setPdfProgress(null);
    setStatusMessage(null);

    try {
      const trimmedText = pastedText.trim();
      if (!trimmedText && selectedFiles.length === 0) {
        setError("Add a PDF or paste text to extract decisions.");
        setIsExtracting(false);
        return;
      }

      const stageLabel: Record<DistillStage, string> = {
        parsing: "Parsing PDFs...",
        scanning: "Scanning text...",
        chunking: "Preparing chunks...",
      };

      const { chunks, warnings } = await distillSources(selectedFiles, trimmedText, {
        onProgress: (progress) => {
          setPdfProgress(progress);
        },
        onStageChange: (stage) => {
          setStatusMessage(stageLabel[stage]);
        },
      });
      setPdfProgress(null);

      if (warnings.length > 0) {
        setWarning(warnings[0]);
      }

      if (chunks.length === 0) {
        setError("No readable text found. Try a different PDF or pasted memo.");
        setIsExtracting(false);
        return;
      }

      setStatusMessage("Extracting decisions...");
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks, maxDecisionsPerChunk: 12 }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Extraction failed.");
      }

      const payload = (await response.json()) as {
        decisions: Array<{
          id: string;
          decision: string;
          evidence: string;
          sourceId: string;
          pageStart: number | null;
          pageEnd: number | null;
          extractConfidence: number;
          decisionness: number;
        }>;
      };

      setStatusMessage("Dedupe...");
      const mapped = payload.decisions.map((decision) => ({
        id: decision.id,
        decision: decision.decision,
        evidence: decision.evidence,
        sources: [
          {
            fileName: decision.sourceId,
            pageNumber: decision.pageStart ?? undefined,
            pageEnd: decision.pageEnd ?? undefined,
            excerpt: decision.evidence,
          },
        ],
        extractConfidence: decision.extractConfidence,
        impact: 5,
        cost: 5,
        risk: 5,
        urgency: 5,
        confidence: 5,
        keep: true,
      }));

      if (mapped.length === 0) {
        setError("No decisions found. Try adding clearer decision language.");
        setIsExtracting(false);
        return;
      }

      setDecisions(mapped);
      setHasExtracted(true);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Extraction failed.";
      console.error("Decision extraction failed", caughtError);
      setError(message);
    } finally {
      setIsExtracting(false);
      setStatusMessage(null);
    }
  }, [pastedText, selectedFiles]);

  useEffect(() => {
    if (!onImportDecisions || !hasExtracted) return;
    const kept = decisions.filter((decision) => decision.keep);
    onImportDecisions(kept, { mode: "sync" });
  }, [decisions, hasExtracted, onImportDecisions]);

  const toggleExpandedDecision = useCallback((id: string) => {
    setExpandedDecisions((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

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
                className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 text-xs text-muted-foreground"
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFileSelection(event.dataTransfer.files ?? null);
                }}
              >
                <label className="flex cursor-pointer flex-col items-center gap-2">
                  <span>
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} PDF${selectedFiles.length > 1 ? "s" : ""} selected`
                      : `Drop up to ${MAX_FILES} .pdf files`}
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(event) => handleFileSelection(event.target.files)}
                  />
                  <span className="text-[11px] font-semibold text-foreground underline">Choose file</span>
                </label>
              </div>
              {progressLabel ? <p className="text-[11px] text-muted-foreground">{progressLabel}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Paste text memo
              </label>
            </div>
            <Textarea
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
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
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">We’ll only analyze the text you provide here.</p>
          <Button
            className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
            onClick={handleExtract}
            disabled={isExtracting}
          >
            {isExtracting ? "Extracting..." : "Extract Decisions"}
          </Button>
        </div>
      </Card>

      {decisions.length > 0 ? (
        <div className="space-y-3">
          <div className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Decision candidates</p>
              <p className="text-xs text-muted-foreground">Kept decisions instantly count toward your session.</p>
            </div>
          </div>

          <div className="space-y-3">
            {decisions.map((decision) => {
              const source = decision.sources[0];
              const pageLabel =
                source?.pageNumber && source?.pageEnd && source.pageEnd !== source.pageNumber
                  ? `p${source.pageNumber}–${source.pageEnd}`
                  : source?.pageNumber
                    ? `p${source.pageNumber}`
                    : null;
              const sourceLabel = source?.fileName ? `${source.fileName}${pageLabel ? ` · ${pageLabel}` : ""}` : undefined;
              const isExpanded = Boolean(expandedDecisions[decision.id]);

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
                      {sourceLabel ? <span>Source: {sourceLabel}</span> : null}
                    </div>
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
                      <Switch checked={decision.keep} onCheckedChange={(checked) => toggleDecisionKeep(decision.id, checked)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
