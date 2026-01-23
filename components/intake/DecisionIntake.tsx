"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { extractPdfText, type PdfProgress } from "@/lib/pdf/extractPdfText";
import { extractDecisionCandidates } from "@/lib/decision/extractDecisionCandidates";
import type { DecisionCandidate } from "@/lib/types/decision";

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
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionCandidate[]>([]);

  const progressLabel = useMemo(() => {
    if (pdfProgress) {
      return `File ${pdfProgress.fileIndex}/${pdfProgress.totalFiles} — Page ${pdfProgress.page}/${pdfProgress.total} (${pdfProgress.fileName})`;
    }
    if (isExtracting) {
      return "Extracting locally...";
    }
    return null;
  }, [isExtracting, pdfProgress]);

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

    try {
      const trimmedText = pastedText.trim();
      const shouldUsePaste = usePastedText || selectedFiles.length === 0;
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
        extractedCandidates.push(
          ...extractDecisionCandidates(text).map((candidate) => ({
            ...candidate,
            source: "Pasted text",
          })),
        );
      } else {
        if (selectedFiles.length === 0) {
          setError("Add a PDF or paste text to extract decisions.");
          setIsExtracting(false);
          return;
        }

        for (let index = 0; index < selectedFiles.length; index += 1) {
          const file = selectedFiles[index];
          const buffer = await file.arrayBuffer();
          const fileText = await extractPdfText(buffer, (progress) => {
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

          const trimmedFileText = fileText.trim();
          if (!trimmedFileText) continue;

          let effectiveText = trimmedFileText;
          if (trimmedFileText.length > remaining) {
            effectiveText = trimmedFileText.slice(0, remaining);
            wasTruncated = true;
          }

          totalChars += effectiveText.length;

          extractedCandidates.push(
            ...extractDecisionCandidates(effectiveText).map((candidate) => ({
              ...candidate,
              source: file.name,
            })),
          );

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
    }
  }, [pastedText, selectedFiles, usePastedText]);

  const handleImport = useCallback(() => {
    const selected = decisions.filter((decision) => decision.keep);
    if (selected.length === 0) {
      setError("Select at least one decision to import.");
      return;
    }

    if (onImportDecisions) {
      onImportDecisions(selected);
      return;
    }

    console.warn("TODO: wire Decision Intake import handler.");
    setError("Import is not wired yet.");
  }, [decisions, onImportDecisions]);

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
              <p className="text-xs text-muted-foreground">Score each decision before importing.</p>
            </div>
            <Button className="h-9 px-4 text-xs font-semibold uppercase tracking-wide" onClick={handleImport}>
              Import selected decisions
            </Button>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/80">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <TableHead>Decision</TableHead>
                  <TableHead className="text-center">Impact</TableHead>
                  <TableHead className="text-center">Cost</TableHead>
                  <TableHead className="text-center">Risk</TableHead>
                  <TableHead className="text-center">Urgency</TableHead>
                  <TableHead className="text-center">Confidence</TableHead>
                  <TableHead className="text-center">Keep</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisions.map((decision) => (
                  <TableRow key={decision.id} className="bg-transparent">
                    <TableCell className="min-w-[240px] align-top">
                      <div className="space-y-1">
                        <Input
                          value={decision.decision}
                          onChange={(event) => updateDecisionText(decision.id, event.target.value)}
                          className="h-8 text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{decision.evidence}</p>
                        {decision.source ? (
                          <p className="text-[10px] text-muted-foreground">Source: {decision.source}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    {(["impact", "cost", "risk", "urgency", "confidence"] as const).map((key) => (
                      <TableCell key={`${decision.id}-${key}`} className="text-center align-top">
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={decision[key]}
                          onChange={(event) => updateDecisionScore(decision.id, key, Number(event.target.value))}
                          className="h-8 w-16 text-center text-sm"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center align-top">
                      <div className="flex items-center justify-center">
                        <Switch checked={decision.keep} onCheckedChange={(checked) => toggleDecisionKeep(decision.id, checked)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
