"use client";

import StressTestCalculator, {
  StressTestCalculatorHandle,
  type StressTestDecisionSnapshot,
} from "@/components/stress-test/StressTestCalculator";
import { useDefinitionsPanel } from "@/components/definitions/DefinitionsPanelProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { computeMetrics, type DecisionVariables } from "@/lib/calculations";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

interface SessionDecision {
  id: string;
  decisionTitle: string;
  decisionDetail?: string;
  category: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
  r: number;
  p: number;
  s: number;
  dnav: number;
  createdAt: number;
}

interface ExtractedDecisionCandidate {
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
}

const SESSION_DECISIONS_KEY = "dnav:stressTest:sessionDecisions";

const isSessionDecisionSnapshot = (value: unknown): value is SessionDecision => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SessionDecision>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.decisionTitle === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.r === "number" &&
    typeof candidate.p === "number" &&
    typeof candidate.s === "number" &&
    typeof candidate.dnav === "number"
  );
};

export default function StressTestPage() {
  const [sessionDecisions, setSessionDecisions] = useState<SessionDecision[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.sessionStorage.getItem(SESSION_DECISIONS_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      return Array.isArray(parsed) ? parsed.filter(isSessionDecisionSnapshot) : [];
    } catch (error) {
      console.error("Failed to load stress test session decisions.", error);
      return [];
    }
  });
  const calculatorRef = useRef<StressTestCalculatorHandle>(null);

  const { openDefinitions } = useDefinitionsPanel();
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [showPdfNote, setShowPdfNote] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedDecisions, setExtractedDecisions] = useState<ExtractedDecisionCandidate[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionDecisions.length === 0) {
        window.sessionStorage.removeItem(SESSION_DECISIONS_KEY);
      } else {
        window.sessionStorage.setItem(SESSION_DECISIONS_KEY, JSON.stringify(sessionDecisions));
      }
    } catch (error) {
      console.error("Failed to persist stress test session decisions.", error);
    }
  }, [sessionDecisions]);

  const handleSaveSessionDecision = useCallback((decision: StressTestDecisionSnapshot) => {
    const title = decision.name?.trim() || "Untitled decision";
    const sessionDecision: SessionDecision = {
      id: decision.id,
      decisionTitle: title,
      decisionDetail: "",
      category: decision.category,
      impact: decision.impact,
      cost: decision.cost,
      risk: decision.risk,
      urgency: decision.urgency,
      confidence: decision.confidence,
      r: decision.return,
      p: decision.pressure,
      s: decision.stability,
      dnav: decision.dnav,
      createdAt: decision.createdAt,
    };
    setSessionDecisions((prev) => [sessionDecision, ...prev]);
  }, []);

  const decisionCount = sessionDecisions.length;
  const progressCount = Math.min(decisionCount, 10);
  const canOpenSessionAnalysis = decisionCount >= 10;

  const formatCompact = useCallback((value: number, digits = 0) => {
    if (!Number.isFinite(value)) return "0";
    return value.toFixed(digits);
  }, []);

  const formatSignal = useCallback((value: number) => {
    if (!Number.isFinite(value)) return "0";
    const formatted = value.toFixed(1).replace(/\.0$/, "");
    if (value > 0) return `+${formatted}`;
    return formatted;
  }, []);

  const handleClearSession = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.confirm("Clear saved session decisions?")) return;
    setSessionDecisions([]);
    calculatorRef.current?.resetSavedState();
    try {
      window.sessionStorage.removeItem(SESSION_DECISIONS_KEY);
    } catch (error) {
      console.error("Failed to clear stress test session decisions.", error);
    }
  }, []);

  const handleFileSelection = useCallback((file: File | null) => {
    setExtractError(null);
    setShowPdfNote(false);
    if (!file) {
      setUploadedFileName(null);
      setFileText("");
      return;
    }

    setUploadedFileName(file.name);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      setShowPdfNote(true);
      setFileText("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileText(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      setFileText("");
      setExtractError("We couldn't read that file. Please paste the text instead.");
    };
    reader.readAsText(file);
  }, []);

  const handleExtract = useCallback(async () => {
    const text = fileText.trim() || pastedText.trim();
    if (!text) {
      setExtractError("Add a file or paste text to extract decisions.");
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Extraction failed");
      }

      const data = (await response.json()) as { decisions?: Array<Record<string, unknown>> };
      const decisions = Array.isArray(data.decisions) ? data.decisions : [];

      const mapped = decisions.map((item, index) => {
        const title = typeof item.title === "string" ? item.title : "";
        const decisionText = typeof item.decision === "string" ? item.decision : "";
        const rationale = typeof item.rationale === "string" ? item.rationale : undefined;
        const category = typeof item.category === "string" ? item.category : undefined;
        const evidenceQuotesRaw = item.evidence_quotes;
        const evidenceQuotes = Array.isArray(evidenceQuotesRaw)
          ? evidenceQuotesRaw.filter((quote) => typeof quote === "string")
          : [];
        const source = typeof item.source === "string" ? item.source : undefined;

        return {
          id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          title: title || "Decision candidate",
          decision: decisionText,
          rationale,
          category,
          evidenceQuotes,
          source,
          impact: 5,
          cost: 5,
          risk: 5,
          urgency: 5,
          confidence: 5,
          keep: true,
          expanded: false,
        } satisfies ExtractedDecisionCandidate;
      });

      setExtractedDecisions(mapped);
      if (mapped.length === 0) {
        setExtractError("No decisions found. Try adding clearer decision language.");
      }
    } catch (error) {
      console.error("Decision extraction failed", error);
      setExtractError("Extraction failed. Please try again or paste different text.");
    } finally {
      setIsExtracting(false);
    }
  }, [fileText, pastedText]);

  const clampScore = useCallback((value: number) => {
    if (!Number.isFinite(value)) return 1;
    return Math.min(10, Math.max(1, Math.round(value)));
  }, []);

  const updateDecisionScore = useCallback(
    (id: string, key: keyof DecisionVariables, value: number) => {
      setExtractedDecisions((prev) =>
        prev.map((decision) =>
          decision.id === id ? { ...decision, [key]: clampScore(value) } : decision,
        ),
      );
    },
    [clampScore],
  );

  const toggleDecisionKeep = useCallback((id: string, keep: boolean) => {
    setExtractedDecisions((prev) =>
      prev.map((decision) => (decision.id === id ? { ...decision, keep } : decision)),
    );
  }, []);

  const toggleDecisionExpanded = useCallback((id: string) => {
    setExtractedDecisions((prev) =>
      prev.map((decision) =>
        decision.id === id ? { ...decision, expanded: !decision.expanded } : decision,
      ),
    );
  }, []);

  const handleImportDecisions = useCallback(() => {
    const selected = extractedDecisions.filter((decision) => decision.keep);
    if (selected.length === 0) return;

    setSessionDecisions((prev) => {
      const now = Date.now();
      const imports = selected.map((decision, index) => {
        const vars: DecisionVariables = {
          impact: decision.impact,
          cost: decision.cost,
          risk: decision.risk,
          urgency: decision.urgency,
          confidence: decision.confidence,
        };
        const metrics = computeMetrics(vars);
        return {
          id: `${now}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          decisionTitle: decision.title,
          decisionDetail: decision.decision,
          category: decision.category?.trim() || "Extracted",
          impact: vars.impact,
          cost: vars.cost,
          risk: vars.risk,
          urgency: vars.urgency,
          confidence: vars.confidence,
          r: metrics.return,
          p: metrics.pressure,
          s: metrics.stability,
          dnav: metrics.dnav,
          createdAt: now + index,
        } satisfies SessionDecision;
      });
      return [...imports, ...prev];
    });
  }, [extractedDecisions]);

  // TODO: Rebuild Decision Intake v2
  // Intake will be redesigned around the Decision Atom:
  // Actor + Action + Object + Constraint

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#f6f3ee] text-slate-900 dark:bg-[#050608] dark:text-white">
        <section className="bg-gradient-to-b from-[#f8f5f1] via-white to-[#f3efe8] dark:from-[#050608] dark:via-black/40 dark:to-[#050608]">
          <div className="mx-auto max-w-6xl space-y-3 px-4 pb-4 pt-3 md:px-6">
            <div className="flex flex-col gap-2 border-b border-border/60 pb-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold text-foreground">Stress Test</h1>
                  <p className="text-sm font-semibold text-foreground">See the shape of your decision in review.</p>
                  <p className="text-sm text-muted-foreground">Run a guided diagnostic on a decision and capture the signal.</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => openDefinitions(event.currentTarget)}
                      className="font-semibold"
                    >
                      Definitions
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <StressTestCalculator ref={calculatorRef} saveLabel="Save decision" onSaveDecision={handleSaveSessionDecision} />

            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-foreground">
                <span>
                  {decisionCount >= 10
                    ? "10/10 decisions logged — signal unlocked"
                    : `${decisionCount}/10 decisions logged`}
                </span>
                <div className="flex flex-col items-end gap-1 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Session progress</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-semibold uppercase tracking-wide"
                      onClick={handleClearSession}
                      disabled={decisionCount === 0}
                    >
                      Clear session
                    </Button>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer text-[11px] font-medium text-muted-foreground underline underline-offset-2">
                        What does this mean?
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[240px]">
                      Session Analysis shows how your decisions behave under pressure during review, before hindsight distorts them.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all"
                  style={{ width: `${progressCount * 10}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {decisionCount >= 10
                  ? `Session insight is based on these ${decisionCount} decisions. More decisions sharpen the signal.`
                  : "Insight unlocks at 10 decisions. More decisions sharpen the signal."}
              </p>
              <p className="text-[11px] text-muted-foreground">Session-only. Nothing is saved.</p>

              {decisionCount > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[720px] space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      These are live decisions captured in-the-moment for review — before outcomes rewrite the story.
                    </p>
                    <div className="grid grid-cols-[minmax(180px,1.6fr)_repeat(5,minmax(48px,0.5fr))_repeat(3,minmax(40px,0.4fr))_minmax(56px,0.5fr)] items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Decision</span>
                      <span className="text-center">Impact</span>
                      <span className="text-center">Cost</span>
                      <span className="text-center">Risk</span>
                      <span className="text-center">Urgency</span>
                      <span className="text-center">Confidence</span>
                      <span className="text-center">R</span>
                      <span className="text-center">P</span>
                      <span className="text-center">S</span>
                      <span className="text-right">D-NAV</span>
                    </div>
                    {sessionDecisions.map((decision) => (
                      <div
                        key={decision.id}
                        className="grid grid-cols-[minmax(180px,1.6fr)_repeat(5,minmax(48px,0.5fr))_repeat(3,minmax(40px,0.4fr))_minmax(56px,0.5fr)] items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-1 text-[11px] text-muted-foreground"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{decision.decisionTitle}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{decision.category}</p>
                        </div>
                        <span className="text-center tabular-nums">{formatCompact(decision.impact)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.cost)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.risk)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.urgency)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.confidence)}</span>
                        <span className="text-center tabular-nums">{formatSignal(decision.r)}</span>
                        <span className="text-center tabular-nums">{formatSignal(decision.p)}</span>
                        <span className="text-center tabular-nums">{formatSignal(decision.s)}</span>
                        <span className="text-right font-semibold text-foreground tabular-nums">
                          {formatCompact(decision.dnav, 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button
                className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                disabled={!canOpenSessionAnalysis}
              >
                OPEN SESSION ANALYSIS
              </Button>
            </div>

            <section className="mt-6 space-y-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">The fastest way to surface decisions</h2>
                <p className="text-sm text-muted-foreground">
                  Upload a memo, financial report, or paste text. We’ll extract decision candidates you can score
                  instantly.
                </p>
              </div>

              <Card className="gap-4 border-border/60 bg-background/80 px-4 py-4 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Drag & drop / Choose file
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
                          <span>{uploadedFileName ?? "Drop a .pdf or .txt file"}</span>
                          <input
                            type="file"
                            accept=".pdf,.txt"
                            className="hidden"
                            onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
                          />
                          <span className="text-[11px] font-semibold text-foreground underline">
                            Choose file
                          </span>
                        </label>
                      </div>
                      {showPdfNote ? (
                        <p className="text-[11px] text-muted-foreground">
                          PDF parsing is returning next — paste text for now.
                        </p>
                      ) : null}
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

                {extractError ? <p className="text-xs text-destructive">{extractError}</p> : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    We’ll only analyze the text you provide here.
                  </p>
                  <Button
                    className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                    onClick={handleExtract}
                    disabled={isExtracting}
                  >
                    {isExtracting ? "Extracting..." : "Extract decisions"}
                  </Button>
                </div>
              </Card>

              {extractedDecisions.length > 0 ? (
                <div className="space-y-3">
                  <div className="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Decision candidates</p>
                      <p className="text-xs text-muted-foreground">Score each decision before importing.</p>
                    </div>
                    <Button
                      className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                      onClick={handleImportDecisions}
                    >
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
                        {extractedDecisions.map((decision) => (
                          <Fragment key={decision.id}>
                            <TableRow className="bg-transparent">
                              <TableCell className="w-[36px] align-top">
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground"
                                  onClick={() => toggleDecisionExpanded(decision.id)}
                                  aria-label="Toggle decision details"
                                >
                                  {decision.expanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              </TableCell>
                              <TableCell className="min-w-[220px] align-top">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-foreground">{decision.title}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {decision.decision || "Decision detail not provided."}
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
                                    onChange={(event) =>
                                      updateDecisionScore(decision.id, key, Number(event.target.value))
                                    }
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

            <section id="session-gated-area" className="mt-8">
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                <strong>Session-gated area cleared</strong>
                <p className="mt-2">
                  All post-session UI has been intentionally removed. This space will be rebuilt once session-level
                  analysis is redesigned.
                </p>
              </div>
            </section>
          </div>
        </section>
      </main>
    </TooltipProvider>
  );
}
