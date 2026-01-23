"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { chunkText } from "@/lib/chunkText";
import { extractPdfText, type PdfProgress } from "@/lib/pdf/extractPdfText";
import { ChevronDown, ChevronRight, RefreshCcw } from "lucide-react";

const DEFAULT_SCORE = 5;
const CHUNK_SIZE = 12000;
const DEBOUNCE_MS = 300;

export type DecisionCandidate = {
  id: string;
  title: string;
  decision: string;
  rationale?: string;
  category?: string;
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

export type ParsedDoc = {
  id: string;
  name: string;
  pages: number;
  text: string;
};

type IntakeProgress = {
  phase: "idle" | "parsing" | "extracting";
  docIndex?: number;
  totalDocs?: number;
  page?: number;
  totalPages?: number;
  chunkIndex?: number;
  totalChunks?: number;
};

type IntakeState = {
  docs: ParsedDoc[];
  combinedText: string;
  progress: IntakeProgress;
  error?: string | null;
};

type ChunkError = {
  chunkIndex: number;
  message: string;
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

const normalizeWhitespace = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

const hashId = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `dnav_${Math.abs(hash).toString(36)}`;
};

const toDecisionKey = (title: string, decision: string) => normalizeWhitespace(`${title} ${decision}`);

const normalizeDecisions = (payload: unknown): DecisionCandidate[] => {
  const container = typeof payload === "object" && payload !== null ? (payload as { decisions?: unknown }) : null;
  const decisionsRaw = Array.isArray(container?.decisions)
    ? container?.decisions
    : Array.isArray(payload)
      ? payload
      : [];

  return decisionsRaw.map((item) => {
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
    const extractConfidence =
      typeof candidate.extract_confidence === "number" && Number.isFinite(candidate.extract_confidence)
        ? candidate.extract_confidence
        : undefined;

    const normalizedTitle = title.trim() || "Decision candidate";
    const normalizedDecision = decisionText.trim();

    return {
      id: typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id
        : hashId(`${normalizedTitle}|${normalizedDecision}`),
      title: normalizedTitle,
      decision: normalizedDecision,
      rationale,
      category,
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

const mergeDecisions = (existing: DecisionCandidate[], incoming: DecisionCandidate[]) => {
  const merged = new Map<string, DecisionCandidate>();
  for (const decision of existing) {
    merged.set(toDecisionKey(decision.title, decision.decision), decision);
  }
  for (const decision of incoming) {
    const key = toDecisionKey(decision.title, decision.decision);
    if (!merged.has(key)) {
      merged.set(key, decision);
    }
  }
  return Array.from(merged.values());
};

const defaultIntakeState: IntakeState = {
  docs: [],
  combinedText: "",
  progress: { phase: "idle" },
  error: null,
};

export default function DecisionIntake({ onImportDecisions }: DecisionIntakeProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [debouncedText, setDebouncedText] = useState("");
  const [usePastedText, setUsePastedText] = useState(false);
  const [intakeState, setIntakeState] = useState<IntakeState>(defaultIntakeState);
  const [decisions, setDecisions] = useState<DecisionCandidate[]>([]);
  const [chunkErrors, setChunkErrors] = useState<ChunkError[]>([]);
  const chunksRef = useRef<string[]>([]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedText(pastedText);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [pastedText]);

  const progressLabel = useMemo(() => {
    if (intakeState.progress.phase === "parsing") {
      const { docIndex = 1, totalDocs = 1, page = 0, totalPages = 0 } = intakeState.progress;
      return `Parsing doc ${docIndex}/${totalDocs} — page ${page}/${totalPages}`;
    }
    if (intakeState.progress.phase === "extracting") {
      const { chunkIndex = 1, totalChunks = 1 } = intakeState.progress;
      return `Extracting chunk ${chunkIndex}/${totalChunks}`;
    }
    return null;
  }, [intakeState.progress]);

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

  const updateDecisionText = useCallback((id: string, updates: Partial<Pick<DecisionCandidate, "title" | "decision">>) => {
    setDecisions((prev) =>
      prev.map((decision) => (decision.id === id ? { ...decision, ...updates } : decision)),
    );
  }, []);

  const toggleDecisionKeep = useCallback((id: string, keep: boolean) => {
    setDecisions((prev) => prev.map((decision) => (decision.id === id ? { ...decision, keep } : decision)));
  }, []);

  const toggleDecisionExpanded = useCallback((id: string) => {
    setDecisions((prev) =>
      prev.map((decision) => (decision.id === id ? { ...decision, expanded: !decision.expanded } : decision)),
    );
  }, []);

  const resetIntake = useCallback(() => {
    setSelectedFiles([]);
    setPastedText("");
    setDebouncedText("");
    setUsePastedText(false);
    setIntakeState(defaultIntakeState);
    setDecisions([]);
    setChunkErrors([]);
    chunksRef.current = [];
  }, []);

  const parsePdfFiles = useCallback(async (files: File[]) => {
    setChunkErrors([]);
    setDecisions([]);
    setIntakeState((prev) => ({
      ...prev,
      docs: [],
      combinedText: "",
      progress: { phase: "parsing", docIndex: 1, totalDocs: files.length, page: 0, totalPages: 0 },
      error: null,
    }));

    try {
      const parsedDocs: ParsedDoc[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const buffer = await file.arrayBuffer();
        const { text, pages } = await extractPdfText(buffer, (progress: PdfProgress) => {
          setIntakeState((prev) => ({
            ...prev,
            progress: {
              phase: "parsing",
              docIndex: index + 1,
              totalDocs: files.length,
              page: progress.page,
              totalPages: progress.total,
            },
          }));
        });

        parsedDocs.push({
          id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          pages,
          text,
        });
      }

      const combinedText = parsedDocs.map((doc) => doc.text).filter(Boolean).join("\n\n");
      setIntakeState({
        docs: parsedDocs,
        combinedText,
        progress: { phase: "idle" },
        error: combinedText ? null : "No text could be extracted from these PDFs.",
      });
    } catch (caughtError) {
      console.error("PDF parsing failed", caughtError);
      const message = caughtError instanceof Error ? caughtError.message : "Failed to parse PDFs.";
      setIntakeState((prev) => ({ ...prev, progress: { phase: "idle" }, error: message }));
    }
  }, []);

  const handleFileSelection = useCallback(
    (files: FileList | null) => {
      setIntakeState((prev) => ({ ...prev, error: null }));
      if (!files || files.length === 0) {
        setSelectedFiles([]);
        return;
      }

      const fileArray = Array.from(files);
      const invalid = fileArray.filter(
        (file) => !file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf"),
      );
      if (invalid.length > 0) {
        setSelectedFiles([]);
        setIntakeState((prev) => ({
          ...prev,
          error: "Please upload PDF files only.",
        }));
        return;
      }

      setSelectedFiles(fileArray);
      setUsePastedText(false);
      void parsePdfFiles(fileArray);
    },
    [parsePdfFiles],
  );

  const handleExtract = useCallback(async () => {
    setChunkErrors([]);
    setDecisions([]);
    setIntakeState((prev) => ({ ...prev, error: null }));

    const textToUse = (usePastedText ? debouncedText : intakeState.combinedText).trim();
    if (!textToUse) {
      setIntakeState((prev) => ({
        ...prev,
        error: "Add a PDF or paste text to extract decisions.",
      }));
      return;
    }

    const chunks = chunkText(textToUse, CHUNK_SIZE);
    if (chunks.length === 0) {
      setIntakeState((prev) => ({ ...prev, error: "No readable text found to extract." }));
      return;
    }

    chunksRef.current = chunks;
    const totalChunks = chunks.length;
    const sourceName = usePastedText
      ? "Pasted text"
      : selectedFiles.length > 0
        ? `${selectedFiles.length} PDF${selectedFiles.length > 1 ? "s" : ""}`
        : "Uploaded PDFs";
    const errors: ChunkError[] = [];
    let extractedCount = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      setIntakeState((prev) => ({
        ...prev,
        progress: { phase: "extracting", chunkIndex: index + 1, totalChunks },
      }));

      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: chunks[index],
            meta: { sourceName, chunkIndex: index + 1, totalChunks },
          }),
        });

        const contentType = response.headers.get("content-type") || "";
        const raw = await response.text();
        const trimmed = raw.trim();
        if (contentType.includes("text/html") || /^<!?html/i.test(trimmed)) {
          throw new Error(
            `Server timed out. Try smaller files or fewer pages. (debug: ${trimmed.slice(0, 120)})`,
          );
        }

        if (!response.ok) {
          const detail = raw ? ` (${raw.slice(0, 200)})` : "";
          throw new Error(`Extraction failed${detail}`);
        }

        const parsed = safeParseJson(raw);
        const payload = typeof parsed === "string" ? safeParseJson(parsed) : parsed;
        const mapped = normalizeDecisions(payload);
        extractedCount += mapped.length;

        setDecisions((prev) => mergeDecisions(prev, mapped));
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Extraction failed.";
        console.error("Decision extraction failed", caughtError);
        errors.push({ chunkIndex: index + 1, message });
      }
    }

    setChunkErrors(errors);
    setIntakeState((prev) => ({
      ...prev,
      progress: { phase: "idle" },
      error:
        errors.length > 0
          ? "Some chunks failed to extract. Retry the failed chunks below."
          : extractedCount === 0
            ? "No decisions found. Try adding clearer decision language."
            : prev.error,
    }));
  }, [debouncedText, intakeState.combinedText, selectedFiles.length, usePastedText]);

  const handleRetryChunk = useCallback(
    async (chunkIndex: number) => {
      const chunks = chunksRef.current;
      const chunkTextValue = chunks[chunkIndex - 1];
      if (!chunkTextValue) return;

      setIntakeState((prev) => ({
        ...prev,
        progress: { phase: "extracting", chunkIndex, totalChunks: chunks.length },
        error: null,
      }));

      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunkTextValue, meta: { sourceName: "Retry", chunkIndex } }),
        });

        const contentType = response.headers.get("content-type") || "";
        const raw = await response.text();
        const trimmed = raw.trim();
        if (contentType.includes("text/html") || /^<!?html/i.test(trimmed)) {
          throw new Error(
            `Server timed out. Try smaller files or fewer pages. (debug: ${trimmed.slice(0, 120)})`,
          );
        }

        if (!response.ok) {
          const detail = raw ? ` (${raw.slice(0, 200)})` : "";
          throw new Error(`Extraction failed${detail}`);
        }

        const parsed = safeParseJson(raw);
        const payload = typeof parsed === "string" ? safeParseJson(parsed) : parsed;
        const mapped = normalizeDecisions(payload);
        setDecisions((prev) => mergeDecisions(prev, mapped));
        setChunkErrors((prev) => prev.filter((error) => error.chunkIndex !== chunkIndex));
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Extraction failed.";
        console.error("Chunk retry failed", caughtError);
        setChunkErrors((prev) =>
          prev.map((error) => (error.chunkIndex === chunkIndex ? { ...error, message } : error)),
        );
      } finally {
        setIntakeState((prev) => ({ ...prev, progress: { phase: "idle" } }));
      }
    },
    [],
  );

  const handleImport = useCallback(() => {
    const selected = decisions.filter((decision) => decision.keep);
    if (selected.length === 0) {
      setIntakeState((prev) => ({ ...prev, error: "Select at least one decision to import." }));
      return;
    }

    if (onImportDecisions) {
      onImportDecisions(selected);
      return;
    }

    console.warn("TODO: wire Decision Intake import handler.");
    setIntakeState((prev) => ({ ...prev, error: "Import is not wired yet." }));
  }, [decisions, onImportDecisions]);

  const canExtract = useMemo(() => {
    const hasParsedText = intakeState.combinedText.trim().length > 0;
    const hasPastedText = debouncedText.trim().length > 0;
    return usePastedText ? hasPastedText : hasParsedText;
  }, [debouncedText, intakeState.combinedText, usePastedText]);

  return (
    <section className="mt-6 space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">The fastest way to surface decisions</h2>
        <p className="text-sm text-muted-foreground">
          Upload multiple PDFs or paste text. We’ll extract decision candidates you can score instantly.
        </p>
      </div>

      <Card className="gap-4 border-border/60 bg-background/80 px-4 py-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Drag & drop / Choose PDFs
              </p>
              <div
                className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 text-xs text-muted-foreground"
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFileSelection(event.dataTransfer.files);
                }}
              >
                <label className="flex cursor-pointer flex-col items-center gap-2">
                  <span>
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`
                      : "Drop PDF files"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(event) => handleFileSelection(event.target.files)}
                  />
                  <span className="text-[11px] font-semibold text-foreground underline">Choose files</span>
                </label>
              </div>
              {selectedFiles.length > 0 ? (
                <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                  <p className="font-semibold text-foreground">Selected PDFs</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {selectedFiles.map((file) => (
                      <li key={file.name}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {progressLabel ? <p className="text-[11px] text-muted-foreground">{progressLabel}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Paste text instead
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

        {intakeState.error ? (
          <div
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {intakeState.error}
          </div>
        ) : null}

        {chunkErrors.length > 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Chunk errors</p>
            <ul className="mt-2 space-y-2">
              {chunkErrors.map((error) => (
                <li key={`chunk-error-${error.chunkIndex}`} className="flex flex-wrap items-center gap-2">
                  <span>Chunk {error.chunkIndex}: {error.message}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10px] font-semibold uppercase"
                    onClick={() => handleRetryChunk(error.chunkIndex)}
                  >
                    Retry
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>We’ll only analyze the text you provide here.</p>
            {intakeState.combinedText ? (
              <p className="text-[11px]">Combined text length: {intakeState.combinedText.length.toLocaleString()}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              className="h-9 px-3 text-xs font-semibold uppercase tracking-wide"
              onClick={resetIntake}
            >
              Clear intake
            </Button>
            <Button
              className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
              onClick={handleExtract}
              disabled={!canExtract || intakeState.progress.phase === "parsing"}
            >
              {intakeState.progress.phase === "extracting" ? "Extracting..." : "Extract decisions"}
            </Button>
          </div>
        </div>
      </Card>

      {decisions.length > 0 ? (
        <div className="space-y-3">
          <div className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Decision candidates</p>
              <p className="text-xs text-muted-foreground">Score each decision before importing.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-9 px-3 text-xs font-semibold uppercase tracking-wide"
                onClick={resetIntake}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Clear intake
              </Button>
              <Button className="h-9 px-4 text-xs font-semibold uppercase tracking-wide" onClick={handleImport}>
                Import selected decisions
              </Button>
            </div>
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
                  <TableHead className="text-center">Source</TableHead>
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
                      <TableCell className="min-w-[240px] align-top">
                        <div className="space-y-2">
                          <Input
                            value={decision.title}
                            onChange={(event) => updateDecisionText(decision.id, { title: event.target.value })}
                            className="h-8 text-sm font-semibold"
                          />
                          <Textarea
                            value={decision.decision}
                            onChange={(event) => updateDecisionText(decision.id, { decision: event.target.value })}
                            className="min-h-[72px] text-xs"
                            placeholder="Decision statement"
                          />
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
                      <TableCell className="text-center align-top text-xs text-muted-foreground">
                        {decision.source || "—"}
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
