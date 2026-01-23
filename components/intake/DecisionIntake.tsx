"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { extractPdfText, type PdfProgress } from "@/lib/pdf/extractPdfText";
import { ChevronDown, ChevronRight } from "lucide-react";

const DEFAULT_SCORE = 5;
const MAX_CLIENT_TEXT_CHARS = 200_000;

export type DecisionCandidate = {
  id: string;
  title: string;
  decision: string;
  rationale?: string;
  category?: string;
  evidenceQuotes?: string[];
  source?: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
  keep: boolean;
  expanded: boolean;
};

type DecisionIntakeProps = {
  onImportDecisions?: (decisions: DecisionCandidate[]) => void;
};

const safeParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const normalizeDecisions = (payload: unknown): DecisionCandidate[] => {
  const container = typeof payload === "object" && payload !== null ? (payload as { decisions?: unknown }) : null;
  const decisionsRaw = Array.isArray(container?.decisions)
    ? container?.decisions
    : Array.isArray(payload)
      ? payload
      : [];

  return decisionsRaw.map((item, index) => {
    const candidate = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const title = typeof candidate.title === "string" ? candidate.title : "";
    const decisionText = typeof candidate.decision === "string" ? candidate.decision : "";
    const rationale = typeof candidate.rationale === "string" ? candidate.rationale : undefined;
    const category = typeof candidate.category === "string" ? candidate.category : undefined;
    const evidenceQuotesRaw =
      candidate.evidence_quotes ?? candidate.evidenceQuotes ?? candidate.evidenceQuotesRaw;
    const evidenceQuotes = Array.isArray(evidenceQuotesRaw)
      ? evidenceQuotesRaw.filter((quote): quote is string => typeof quote === "string")
      : [];
    const source = typeof candidate.source === "string" ? candidate.source : undefined;

    return {
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      title: title || "Decision candidate",
      decision: decisionText,
      rationale,
      category,
      evidenceQuotes,
      source,
      impact: DEFAULT_SCORE,
      cost: DEFAULT_SCORE,
      risk: DEFAULT_SCORE,
      urgency: DEFAULT_SCORE,
      confidence: DEFAULT_SCORE,
      keep: true,
      expanded: false,
    };
  });
};

export default function DecisionIntake({ onImportDecisions }: DecisionIntakeProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [pdfProgress, setPdfProgress] = useState<PdfProgress | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionCandidate[]>([]);

  const progressLabel = useMemo(() => {
    if (pdfProgress) {
      return `Parsing page ${pdfProgress.page} of ${pdfProgress.total}`;
    }
    if (isExtracting) {
      return "Sending to extractor...";
    }
    return null;
  }, [isExtracting, pdfProgress]);

  const handleFileSelection = useCallback((file: File | null) => {
    setError(null);
    setPdfProgress(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setSelectedFile(null);
      setError("Please upload a PDF file.");
      return;
    }

    setSelectedFile(file);
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

  const toggleDecisionKeep = useCallback((id: string, keep: boolean) => {
    setDecisions((prev) => prev.map((decision) => (decision.id === id ? { ...decision, keep } : decision)));
  }, []);

  const toggleDecisionExpanded = useCallback((id: string) => {
    setDecisions((prev) =>
      prev.map((decision) => (decision.id === id ? { ...decision, expanded: !decision.expanded } : decision)),
    );
  }, []);

  const handleExtract = useCallback(async () => {
    setError(null);
    setIsExtracting(true);
    setPdfProgress(null);

    try {
      let text = pastedText.trim();

      if (!text && selectedFile) {
        const buffer = await selectedFile.arrayBuffer();
        text = await extractPdfText(buffer, (progress) => {
          setPdfProgress(progress);
        });
        setPdfProgress(null);
      }

      if (!text) {
        setError("Add a PDF or paste text to extract decisions.");
        setIsExtracting(false);
        return;
      }

      if (text.length > MAX_CLIENT_TEXT_CHARS) {
        setError(
          `Your text is ${text.length.toLocaleString()} characters. Only the first ${MAX_CLIENT_TEXT_CHARS.toLocaleString()} will be analyzed—consider shortening the input.`,
        );
        text = text.slice(0, MAX_CLIENT_TEXT_CHARS);
      }

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const raw = await response.text();
      if (!response.ok) {
        const detail = raw ? ` (${raw.slice(0, 200)})` : "";
        throw new Error(`Extraction failed${detail}`);
      }

      const parsed = safeParseJson(raw);
      const payload = typeof parsed === "string" ? safeParseJson(parsed) : parsed;
      const mapped = normalizeDecisions(payload);

      setDecisions(mapped);
      if (mapped.length === 0) {
        setError("No decisions found. Try adding clearer decision language.");
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Extraction failed.";
      console.error("Decision extraction failed", caughtError);
      setError(message);
    } finally {
      setIsExtracting(false);
    }
  }, [pastedText, selectedFile]);

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
                  const file = event.dataTransfer.files?.[0] ?? null;
                  handleFileSelection(file);
                }}
              >
                <label className="flex cursor-pointer flex-col items-center gap-2">
                  <span>{selectedFile?.name ?? "Drop a .pdf file"}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
                  />
                  <span className="text-[11px] font-semibold text-foreground underline">Choose file</span>
                </label>
              </div>
              {progressLabel ? <p className="text-[11px] text-muted-foreground">{progressLabel}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Paste text instead
            </label>
            <Textarea
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              placeholder="Paste the excerpt you want to scan for decisions."
              className="min-h-[128px] bg-background"
            />
          </div>
        </div>

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
                  <TableHead className="w-[36px]" />
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
                  <Fragment key={decision.id}>
                    <TableRow className="bg-transparent">
                      <TableCell className="w-[36px] align-top">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground"
                          onClick={() => toggleDecisionExpanded(decision.id)}
                          aria-label="Toggle decision details"
                        >
                          {decision.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="min-w-[220px] align-top">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{decision.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {decision.rationale || decision.decision || "Rationale not provided."}
                          </p>
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
                          <Switch
                            checked={decision.keep}
                            onCheckedChange={(checked) => toggleDecisionKeep(decision.id, checked)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                    {decision.expanded ? (
                      <TableRow className="bg-muted/10">
                        <TableCell />
                        <TableCell colSpan={7} className="py-4">
                          <div className="space-y-3 text-xs text-muted-foreground">
                            {decision.decision ? (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                                  Decision detail
                                </p>
                                <p className="mt-1">{decision.decision}</p>
                              </div>
                            ) : null}
                            {decision.rationale ? (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                                  Rationale
                                </p>
                                <p className="mt-1">{decision.rationale}</p>
                              </div>
                            ) : null}
                            {decision.evidenceQuotes && decision.evidenceQuotes.length > 0 ? (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                                  Evidence quotes
                                </p>
                                <ul className="mt-1 list-disc space-y-1 pl-4">
                                  {decision.evidenceQuotes.map((quote, index) => (
                                    <li key={`${decision.id}-quote-${index}`}>{quote}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {decision.source ? (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                                  Source
                                </p>
                                <p className="mt-1">{decision.source}</p>
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
