"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { extractPdfTextByPage, type PdfProgress } from "@/lib/pdf/extractPdfText";
import { extractDecisionCandidatesFromPages, extractDecisionCandidatesFromText } from "@/lib/decisionExtract/extract";
import type { DecisionCandidate } from "@/lib/types/decision";
import { ChevronDown, ChevronUp } from "lucide-react";

const MAX_CLIENT_TEXT_CHARS = 200_000;

type DecisionIntakeProps = {
  onImportDecisions?: (decisions: DecisionCandidate[]) => void;
};

type IntakeProgress = PdfProgress & {
  fileIndex: number;
  totalFiles: number;
  fileName: string;
};

export default function DecisionIntake({ onImportDecisions }: DecisionIntakeProps) {
  const [intakeFiles, setIntakeFiles] = useState<File[]>([]);
  const [intakeMemo, setIntakeMemo] = useState("");
  const [parseProgress, setParseProgress] = useState<IntakeProgress[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionCandidate[]>([]);
  const [expandedDecisions, setExpandedDecisions] = useState<Record<string, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  const keptCandidates = useMemo(() => decisions.filter((decision) => decision.keep), [decisions]);
  const candidateLimit = 80;
  const visibleCandidates = showAllCandidates ? decisions : decisions.slice(0, candidateLimit);
  const aiRefineEnabled = process.env.NEXT_PUBLIC_AI_REFINE === "true";

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
    setIsParsing(true);
    setParseProgress([]);
    setShowAllCandidates(false);

    try {
      const trimmedText = intakeMemo.trim();
      const extractedCandidates: DecisionCandidate[] = [];
      let totalChars = 0;
      let wasTruncated = false;

      if (!trimmedText && intakeFiles.length === 0) {
        setError("Add PDFs or paste text to extract decisions.");
        setIsParsing(false);
        return;
      }

      if (trimmedText) {
        let text = trimmedText;
        if (text.length > MAX_CLIENT_TEXT_CHARS) {
          wasTruncated = true;
          text = text.slice(0, MAX_CLIENT_TEXT_CHARS);
        }
        extractedCandidates.push(...extractDecisionCandidatesFromText(text));
        totalChars += text.length;
      }

      for (let index = 0; index < intakeFiles.length; index += 1) {
        const file = intakeFiles[index];
        const buffer = await file.arrayBuffer();
        const pageTexts = await extractPdfTextByPage(buffer, (progress) => {
          setParseProgress((prev) => {
            const next = [...prev];
            const existingIndex = next.findIndex((entry) => entry.fileName === file.name);
            const update = {
              ...progress,
              fileIndex: index + 1,
              totalFiles: intakeFiles.length,
              fileName: file.name,
            };
            if (existingIndex >= 0) {
              next[existingIndex] = update;
            } else {
              next.push(update);
            }
            return next;
          });
        });

        const remaining = MAX_CLIENT_TEXT_CHARS - totalChars;
        if (remaining <= 0) {
          wasTruncated = true;
          break;
        }

        const trimmedPages = pageTexts
          .map((page) => ({
            ...page,
            text: page.text.trim(),
            fileName: file.name,
          }))
          .filter((page) => page.text);

        if (trimmedPages.length === 0) continue;

        let charsUsed = 0;
        const limitedPages = trimmedPages
          .map((page) => {
            const available = Math.max(0, remaining - charsUsed);
            if (available <= 0) {
              wasTruncated = true;
              return { ...page, text: "" };
            }
            if (page.text.length > available) {
              wasTruncated = true;
              charsUsed += available;
              return { ...page, text: page.text.slice(0, available) };
            }
            charsUsed += page.text.length;
            return page;
          })
          .filter((page) => page.text);

        totalChars += charsUsed;
        extractedCandidates.push(...extractDecisionCandidatesFromPages(limitedPages));

        if (wasTruncated) break;
      }

      if (extractedCandidates.length === 0) {
        setError("No decisions found. Try adding clearer decision language.");
        setIsParsing(false);
        return;
      }

      if (wasTruncated) {
        setWarning(
          `We analyzed only the first ${MAX_CLIENT_TEXT_CHARS.toLocaleString()} characters to keep the browser fast.`,
        );
      }

      setDecisions(extractedCandidates);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Extraction failed.";
      console.error("Decision extraction failed", caughtError);
      setError(message);
    } finally {
      setIsParsing(false);
      setParseProgress([]);
    }
  }, [intakeFiles, intakeMemo]);

  useEffect(() => {
    if (!onImportDecisions) return;
    onImportDecisions(decisions.filter((decision) => decision.keep));
  }, [decisions, onImportDecisions]);

  const toggleExpandedDecision = useCallback((id: string) => {
    setExpandedDecisions((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleExpandedSource = useCallback((id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleClearIntake = useCallback(() => {
    setIntakeFiles([]);
    setIntakeMemo("");
    setParseProgress([]);
    setDecisions([]);
    setExpandedDecisions({});
    setExpandedSources({});
    setWarning(null);
    setError(null);
    setShowAllCandidates(false);
  }, []);

  const handleRefineWording = useCallback(async () => {
    if (!aiRefineEnabled) return;
    const payload = (keptCandidates.length > 0 ? keptCandidates : decisions.slice(0, 30)).map((candidate) => ({
      id: candidate.id,
      decision: candidate.decision,
      evidence: candidate.evidence,
      sources: candidate.sources,
    }));
    if (payload.length === 0) return;
    setIsRefining(true);
    try {
      const response = await fetch("/api/refine-decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: payload }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { decisions?: { id: string; decision: string }[] };
      if (!data.decisions) return;
      setDecisions((prev) =>
        prev.map((decision) => {
          const match = data.decisions?.find((item) => item.id === decision.id);
          return match ? { ...decision, decision: match.decision } : decision;
        }),
      );
    } catch (caughtError) {
      console.error("Decision refine failed", caughtError);
    } finally {
      setIsRefining(false);
    }
  }, [aiRefineEnabled, decisions, keptCandidates]);

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
              {isParsing && parseProgress.length > 0 ? (
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  {parseProgress.map((progress) => (
                    <p key={progress.fileName}>
                      Parsing {progress.fileName} (p {progress.page}/{progress.total})
                    </p>
                  ))}
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">We’ll only analyze the text you provide here.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
              onClick={handleClearIntake}
              disabled={isParsing && parseProgress.length > 0}
            >
              Clear intake
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

      {decisions.length > 0 ? (
        <div className="space-y-3">
          <div className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Decision Candidates</p>
              <p className="text-xs text-muted-foreground">Toggle Keep to add to your session (N/10).</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Kept: {keptCandidates.length} / 10</span>
              {aiRefineEnabled ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px] font-semibold uppercase tracking-wide"
                  onClick={handleRefineWording}
                  disabled={isRefining}
                >
                  {isRefining ? "Refining..." : "Refine wording (optional)"}
                </Button>
              ) : null}
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
                        checked={decision.keep}
                        onCheckedChange={(checked) => toggleDecisionKeep(decision.id, checked)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {decisions.length > candidateLimit ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
                  onClick={() => setShowAllCandidates((prev) => !prev)}
                >
                  {showAllCandidates ? "Show top 80" : `Show ${decisions.length - candidateLimit} more`}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
