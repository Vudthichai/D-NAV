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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [usePastedText, setUsePastedText] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [pdfProgress, setPdfProgress] = useState<IntakeProgress | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionCandidate[]>([]);
  const [expandedDecisions, setExpandedDecisions] = useState<Record<string, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const progressLabel = useMemo(() => {
    if (pdfProgress) {
      return `Parsing PDF ${pdfProgress.fileIndex}/${pdfProgress.totalFiles} … page ${pdfProgress.page}/${pdfProgress.total} (${pdfProgress.fileName})`;
    }
    if (statusMessage) {
      return statusMessage;
    }
    if (isExtracting) {
      return "Extracting locally...";
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

    const fileArray = Array.from(files);
    const invalid = fileArray.find(
      (file) => !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")),
    );
    if (invalid) {
      setSelectedFiles([]);
      setError("Please upload PDF files only.");
      return;
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
      const shouldUsePaste = usePastedText || trimmedText.length > 0 || selectedFiles.length === 0;
      const extractedCandidates: DecisionCandidate[] = [];
      let totalChars = 0;
      let wasTruncated = false;

      if (shouldUsePaste) {
        if (!trimmedText) {
          setError("Add text to extract decisions.");
          setIsExtracting(false);
          return;
        }
        let text = trimmedText;
        if (text.length > MAX_CLIENT_TEXT_CHARS) {
          wasTruncated = true;
          text = text.slice(0, MAX_CLIENT_TEXT_CHARS);
        }
        setStatusMessage("Filtering candidates...");
        extractedCandidates.push(...extractDecisionCandidatesFromText(text));
      } else {
        if (selectedFiles.length === 0) {
          setError("Add a PDF or paste text to extract decisions.");
          setIsExtracting(false);
          return;
        }

        for (let index = 0; index < selectedFiles.length; index += 1) {
          const file = selectedFiles[index];
          const buffer = await file.arrayBuffer();
          const pageTexts = await extractPdfTextByPage(buffer, (progress) => {
            setPdfProgress({
              ...progress,
              fileIndex: index + 1,
              totalFiles: selectedFiles.length,
              fileName: file.name,
            });
          });
          setPdfProgress(null);

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
          const limitedPages = trimmedPages.map((page) => {
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
          }).filter((page) => page.text);

          totalChars += charsUsed;

          setStatusMessage("Filtering candidates...");
          extractedCandidates.push(...extractDecisionCandidatesFromPages(limitedPages));

          if (wasTruncated) break;
        }
      }

      if (extractedCandidates.length === 0) {
        setError("No decisions found. Try adding clearer decision language.");
        setIsExtracting(false);
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
      setIsExtracting(false);
      setStatusMessage(null);
    }
  }, [pastedText, selectedFiles, usePastedText]);

  useEffect(() => {
    if (!onImportDecisions) return;
    if (decisions.length === 0) return;
    onImportDecisions(decisions.filter((decision) => decision.keep));
  }, [decisions, onImportDecisions]);

  const toggleExpandedDecision = useCallback((id: string) => {
    setExpandedDecisions((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleExpandedSource = useCallback((id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
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
                      : "Drop up to 5 .pdf files"}
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
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Use pasted text instead</span>
                <Switch checked={usePastedText} onCheckedChange={setUsePastedText} />
              </div>
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
            {isExtracting ? "Extracting..." : "Extract decisions"}
          </Button>
        </div>
      </Card>

      {decisions.length > 0 ? (
        <div className="space-y-3">
          <div className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Decision candidates</p>
              <p className="text-xs text-muted-foreground">Keep toggles update your session instantly.</p>
            </div>
          </div>

          <div className="space-y-3">
            {decisions.map((decision) => {
              const source = decision.sources[0];
              const sourceLabel = source?.fileName
                ? `${source.fileName}${source.pageNumber ? ` · p${source.pageNumber}` : ""}`
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
                      {sourceLabel ? <span>Source: {sourceLabel}</span> : null}
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
