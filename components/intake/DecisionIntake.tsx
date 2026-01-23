"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { extractPdfText, type PdfProgress, type PdfPageText } from "@/lib/pdf/extractPdfText";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_SCORE = 5;
const DEFAULT_MAX_PAGES = 20;
const EXTENDED_MAX_PAGES = 40;
const MAX_CHARACTERS = 120_000;
const BATCH_SIZE = 10;

const CATEGORY_OPTIONS = [
  "Product",
  "Finance",
  "Legal",
  "Ops",
  "Hiring",
  "Strategy",
  "Other",
];

type ExtractResponseMeta = {
  model?: string;
  truncated?: boolean;
  input_chars?: number;
};

export type DecisionCandidate = {
  id: string;
  title: string;
  decision: string;
  rationale?: string;
  category?: string;
  constraints?: string[];
  evidenceQuotes?: string[];
  source?: string;
  extractConfidence?: number;
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

const hashDecision = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `dnav_${Math.abs(hash).toString(36)}`;
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
    const evidenceQuotesRaw = candidate.evidence_quotes ?? candidate.evidenceQuotes ?? candidate.evidenceQuotesRaw;
    const evidenceQuotes = Array.isArray(evidenceQuotesRaw)
      ? evidenceQuotesRaw.filter((quote): quote is string => typeof quote === "string")
      : [];
    const source = typeof candidate.source === "string" ? candidate.source : undefined;
    const constraintsRaw = candidate.constraints;
    const constraints = Array.isArray(constraintsRaw)
      ? constraintsRaw.filter((item): item is string => typeof item === "string")
      : undefined;
    const extractConfidence =
      typeof candidate.extract_confidence === "number"
        ? candidate.extract_confidence
        : typeof candidate.extractConfidence === "number"
          ? candidate.extractConfidence
          : undefined;

    const stableId = typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id
      : hashDecision(`${title}|${decisionText}|${index}`);

    return {
      id: stableId,
      title: title || "Decision candidate",
      decision: decisionText,
      rationale,
      category,
      constraints,
      evidenceQuotes,
      source,
      extractConfidence,
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

const buildBatchText = (pages: PdfPageText[]) =>
  pages.map((page) => `\n\n[PAGE ${page.pageNumber}]\n${page.text}`.trim()).join("\n");

const isHtmlResponse = (value: string, contentType?: string | null) => {
  const trimmed = value.trim().toLowerCase();
  if (contentType && contentType.includes("text/html")) return true;
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
};

export default function DecisionIntake({ onImportDecisions }: DecisionIntakeProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [useMemoOverPdf, setUseMemoOverPdf] = useState(true);
  const [allowMorePages, setAllowMorePages] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PdfProgress | null>(null);
  const [pdfPages, setPdfPages] = useState<PdfPageText[]>([]);
  const [pdfTotalPages, setPdfTotalPages] = useState<number | null>(null);
  const [pdfPageLimitReached, setPdfPageLimitReached] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusLine, setStatusLine] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionCandidate[]>([]);
  const [truncationNotice, setTruncationNotice] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<ExtractResponseMeta | null>(null);

  const maxPages = allowMorePages ? EXTENDED_MAX_PAGES : DEFAULT_MAX_PAGES;
  const hasMemoText = pastedText.trim().length > 0;
  const hasPdfText = pdfPages.length > 0;
  const canExtract = !isExtracting && (hasMemoText || hasPdfText);

  const progressLabel = useMemo(() => {
    if (pdfProgress) {
      return `Parsing page ${pdfProgress.page} of ${pdfProgress.total}`;
    }
    if (isExtracting) {
      return "Extracting decisions...";
    }
    return null;
  }, [isExtracting, pdfProgress]);

  const parsePdf = useCallback(
    async (file: File) => {
      setError(null);
      setPdfProgress(null);
      setIsParsingPdf(true);
      setPdfPages([]);
      setPdfTotalPages(null);
      setPdfPageLimitReached(false);
      try {
        const buffer = await file.arrayBuffer();
        const result = await extractPdfText(buffer, {
          maxPages,
          onProgress: (progress) => setPdfProgress(progress),
        });
        setPdfPages(result.pages);
        setPdfTotalPages(result.totalPages);
        setPdfPageLimitReached(result.totalPages > result.processedPages);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "PDF extraction failed.";
        console.error("Failed to parse PDF", caughtError);
        setError(message);
      } finally {
        setIsParsingPdf(false);
        setPdfProgress(null);
      }
    },
    [maxPages],
  );

  useEffect(() => {
    if (!selectedFile) return;
    parsePdf(selectedFile);
  }, [allowMorePages, parsePdf, selectedFile]);

  const handleFileSelection = useCallback(
    (file: File | null) => {
      setError(null);
      setPdfProgress(null);
      if (!file) {
        setSelectedFile(null);
        setPdfPages([]);
        setPdfTotalPages(null);
        return;
      }

      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setSelectedFile(null);
        setPdfPages([]);
        setPdfTotalPages(null);
        setError("Please upload a PDF file.");
        return;
      }

      setSelectedFile(file);
    },
    [parsePdf],
  );

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

  const updateDecisionField = useCallback((id: string, key: "title" | "decision", value: string) => {
    setDecisions((prev) => prev.map((decision) => (decision.id === id ? { ...decision, [key]: value } : decision)));
  }, []);

  const updateDecisionCategory = useCallback((id: string, value: string) => {
    setDecisions((prev) => prev.map((decision) => (decision.id === id ? { ...decision, category: value } : decision)));
  }, []);

  const toggleDecisionKeep = useCallback((id: string, keep: boolean) => {
    setDecisions((prev) => prev.map((decision) => (decision.id === id ? { ...decision, keep } : decision)));
  }, []);

  const toggleDecisionExpanded = useCallback((id: string) => {
    setDecisions((prev) =>
      prev.map((decision) => (decision.id === id ? { ...decision, expanded: !decision.expanded } : decision)),
    );
  }, []);

  const postExtract = useCallback(async (text: string, meta: Record<string, unknown>) => {
    const payload = JSON.stringify({ text, source_meta: meta });
    const url = "/api/extract";
    if (process.env.NODE_ENV !== "production") {
      console.log("[extract] posting", { url, bytes: new TextEncoder().encode(payload).length });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[extract] status", { status: response.status });
    }

    const raw = await response.text();
    if (isHtmlResponse(raw, response.headers.get("content-type"))) {
      throw new Error("Server returned HTML (likely timeout). See Network tab.");
    }

    if (!response.ok) {
      const detail = raw ? ` (${raw.slice(0, 200)})` : "";
      throw new Error(`Extraction failed${detail}`);
    }

    const parsed = safeParseJson(raw);
    const payloadValue = typeof parsed === "string" ? safeParseJson(parsed) : parsed;
    const normalized = normalizeDecisions(payloadValue);
    const metaPayload = typeof payloadValue === "object" && payloadValue !== null
      ? (payloadValue as { meta?: ExtractResponseMeta }).meta
      : null;

    return { normalized, meta: metaPayload ?? null };
  }, []);

  const handleExtract = useCallback(async () => {
    const hasFile = Boolean(selectedFile);
    const textLen = pastedText.trim().length;

    if (process.env.NODE_ENV !== "production") {
      console.log("[extract] clicked", { hasFile, textLen });
    }

    setError(null);
    // Unit-ish check: a enabled click should always trigger at least one /api/extract call and update the status line.
    setStatusLine("Extracting…");
    setTruncationNotice(null);
    setIsExtracting(true);

    try {
      let truncated = false;
      let candidates: DecisionCandidate[] = [];
      let meta: ExtractResponseMeta | null = null;

      const useMemo = hasMemoText && (useMemoOverPdf || !hasPdfText);

      if (useMemo) {
        let text = pastedText.trim();
        if (text.length > MAX_CHARACTERS) {
          text = text.slice(0, MAX_CHARACTERS);
          truncated = true;
          setTruncationNotice(`Memo truncated to ${MAX_CHARACTERS.toLocaleString()} characters.`);
        }

        const result = await postExtract(text, {
          mode: "memo",
          truncated,
        });
        candidates = result.normalized;
        meta = result.meta;
      } else {
        if (!hasPdfText && selectedFile) {
          await parsePdf(selectedFile);
        }

        if (pdfPages.length === 0) {
          throw new Error("Add a PDF or paste text to extract decisions.");
        }

        const batches: PdfPageText[][] = [];
        for (let i = 0; i < pdfPages.length; i += BATCH_SIZE) {
          batches.push(pdfPages.slice(i, i + BATCH_SIZE));
        }

        const merged = new Map<string, DecisionCandidate>();
        for (const batch of batches) {
          let text = buildBatchText(batch);
          let batchTruncated = false;
          if (text.length > MAX_CHARACTERS) {
            text = text.slice(0, MAX_CHARACTERS);
            batchTruncated = true;
            truncated = true;
          }

          const result = await postExtract(text, {
            mode: "pdf",
            filename: selectedFile?.name,
            pages: batch.length,
            truncated: batchTruncated || pdfPageLimitReached,
          });

          meta = result.meta ?? meta;

          for (const decision of result.normalized) {
            const key = decision.id || hashDecision(`${decision.title}|${decision.decision}`);
            const existing = merged.get(key);
            if (!existing || (decision.extractConfidence ?? 0) > (existing.extractConfidence ?? 0)) {
              merged.set(key, decision);
            }
          }
        }

        if (pdfPageLimitReached) {
          truncated = true;
        }
        candidates = Array.from(merged.values());
        if (truncated) {
          const pageNote = pdfPageLimitReached && pdfTotalPages
            ? `Processed ${pdfPages.length} of ${pdfTotalPages} pages.`
            : "";
          setTruncationNotice(`PDF input truncated. ${pageNote}`.trim());
        }
      }

      const sorted = candidates.sort((a, b) => (b.extractConfidence ?? 0) - (a.extractConfidence ?? 0));
      setDecisions(sorted);
      setLastMeta(meta);

      if (sorted.length === 0) {
        setStatusLine("Success (0)");
        setError("No decisions found. Try adding clearer decision language.");
      } else {
        setStatusLine(`Success (${sorted.length})`);
      }

      if (process.env.NODE_ENV !== "production") {
        console.log("[extract] result", { decisionsCount: sorted.length });
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Extraction failed.";
      console.error("Decision extraction failed", caughtError);
      setError(message);
      setStatusLine(`Error (${message})`);
    } finally {
      setIsExtracting(false);
    }
  }, [
    hasMemoText,
    hasPdfText,
    parsePdf,
    pastedText,
    pdfPageLimitReached,
    pdfPages,
    pdfTotalPages,
    postExtract,
    selectedFile,
    useMemoOverPdf,
  ]);

  const handleImport = useCallback(() => {
    const selected = decisions.filter((decision) => decision.keep);
    if (selected.length === 0) {
      setError("Select at least one decision to import.");
      setStatusLine("Error (Select at least one decision to import.)");
      return;
    }

    if (onImportDecisions) {
      onImportDecisions(selected);
      return;
    }

    console.warn("TODO: wire Decision Intake import handler.");
    setError("Import is not wired yet.");
    setStatusLine("Error (Import is not wired yet.)");
  }, [decisions, onImportDecisions]);

  return (
    <section className="mt-6 space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">The fastest way to surface decisions</h2>
        <p className="text-sm text-muted-foreground">
          Drop a PDF or paste a memo. We’ll extract decision candidates you can score instantly.
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
                className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 text-xs text-muted-foreground"
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0] ?? null;
                  handleFileSelection(file);
                }}
              >
                <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
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
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p>PDF text is extracted locally in your browser.</p>
                {selectedFile ? (
                  <p>
                    {pdfTotalPages ? `Pages detected: ${pdfPages.length}/${pdfTotalPages}` : "Detecting pages..."}
                  </p>
                ) : null}
                {progressLabel ? <p>{progressLabel}</p> : null}
                {pdfPageLimitReached ? (
                  <p className="text-[11px] text-amber-600">Page limit reached (processing {maxPages} pages max).</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={allowMorePages} onCheckedChange={setAllowMorePages} />
              <span>Allow up to 40 pages</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Paste a memo or report excerpt
            </label>
            <Textarea
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              placeholder="Paste the excerpt you want to scan for decisions."
              className="min-h-[160px] bg-background"
            />

            {hasMemoText && hasPdfText ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={useMemoOverPdf} onCheckedChange={setUseMemoOverPdf} />
                <span>Use memo instead of PDF</span>
              </div>
            ) : null}
          </div>
        </div>

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
          <Button
            className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
            onClick={handleExtract}
            disabled={!canExtract || isParsingPdf}
          >
            {isExtracting ? "EXTRACTING..." : "EXTRACT DECISIONS"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{statusLine}</span>
          {truncationNotice ? <Badge variant="outline">truncated</Badge> : null}
          {lastMeta?.model ? <span>Model: {lastMeta.model}</span> : null}
        </div>
        {truncationNotice ? <p className="text-[11px] text-amber-600">{truncationNotice}</p> : null}
      </Card>

      {decisions.length > 0 ? (
        <div className="space-y-3">
          <div className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Decision candidates</p>
              <p className="text-xs text-muted-foreground">Score each decision before importing.</p>
            </div>
            <Button className="h-9 px-4 text-xs font-semibold uppercase tracking-wide" onClick={handleImport}>
              IMPORT SELECTED DECISIONS
            </Button>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/80">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <TableHead className="w-[36px]" />
                  <TableHead>Decision</TableHead>
                  <TableHead className="text-center">Category</TableHead>
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
                      <TableCell className="min-w-[260px] align-top">
                        <div className="space-y-2">
                          <Input
                            value={decision.title}
                            onChange={(event) => updateDecisionField(decision.id, "title", event.target.value)}
                            className="h-8 text-sm font-semibold"
                          />
                          <Textarea
                            value={decision.decision}
                            onChange={(event) => updateDecisionField(decision.id, "decision", event.target.value)}
                            className="min-h-[64px] text-xs"
                          />
                          {typeof decision.extractConfidence === "number" ? (
                            <p className="text-[11px] text-muted-foreground">
                              Extract confidence: {decision.extractConfidence.toFixed(2)}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[140px] align-top">
                        <Select
                          value={decision.category ?? "Other"}
                          onValueChange={(value) => updateDecisionCategory(decision.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <TableCell colSpan={8} className="py-4">
                          <div className="space-y-3 text-xs text-muted-foreground">
                            {decision.rationale ? (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                                  Rationale
                                </p>
                                <p className="mt-1">{decision.rationale}</p>
                              </div>
                            ) : null}
                            {decision.constraints && decision.constraints.length > 0 ? (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                                  Constraints
                                </p>
                                <ul className="mt-1 list-disc space-y-1 pl-4">
                                  {decision.constraints.map((constraint, index) => (
                                    <li key={`${decision.id}-constraint-${index}`}>{constraint}</li>
                                  ))}
                                </ul>
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
