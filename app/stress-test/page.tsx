"use client";

import StressTestCalculator, {
  StressTestCalculatorHandle,
  type StressTestDecisionSnapshot,
} from "@/components/stress-test/StressTestCalculator";
import { useDefinitionsPanel } from "@/components/definitions/DefinitionsPanelProvider";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Term from "@/components/ui/Term";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import { ChevronDown, Pencil } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

type BaselineBucketKey = "intent" | "constraints" | "actions" | "movement";

interface BaselineBucketConfig {
  key: BaselineBucketKey;
  title: string;
  prompt: string;
  helper: string;
  examples: string[];
}

interface BaselineBucketState {
  text: string;
  file: File | null;
}

interface ExtractedDecision {
  id: string;
  text: string;
  category: string;
  included: boolean;
}

const BASELINE_BUCKETS: BaselineBucketConfig[] = [
  {
    key: "intent",
    title: "Strategic Intent",
    prompt: "What are you trying to move, protect, or avoid?",
    helper: "Use short statements or bullet fragments.",
    examples: ["Grow enterprise revenue", "Extend cash runway", "Reduce regulatory exposure", "Stabilize ops volatility"],
  },
  {
    key: "constraints",
    title: "Constraints",
    prompt: "What limits your options right now?",
    helper: "List the hard limits shaping the decision.",
    examples: ["Time", "Capital", "Regulation", "Headcount", "Infrastructure", "Market timing"],
  },
  {
    key: "actions",
    title: "Committed Actions",
    prompt: "What have you already committed to doing?",
    helper: "Include anything already set in motion.",
    examples: ["Hired a sales team", "Cut marketing spend", "Raised funding", "Consolidated suppliers"],
  },
  {
    key: "movement",
    title: "Observed Movement",
    prompt: "What changed after those actions?",
    helper: "Capture the latest outcomes you can see.",
    examples: ["Revenue up, margin down", "Churn flattened", "Burn stabilized", "Compliance costs rose"],
  },
];

const DEFAULT_DECISIONS = [
  "Created a new product",
  "Hired a new sales team",
  "Raised funding late last year",
  "Prioritized regulatory alignment",
  "Consolidated suppliers",
  "Reduced marketing spend",
  "Expanded into a new geography",
  "Repriced core offering",
  "Migrated systems/infrastructure",
  "Changed go-to-market focus",
];

const DECISION_CATEGORIES = ["Uncategorized", "Growth", "Operations", "Finance", "Risk", "People", "Product", "Market"];
const SESSION_DECISIONS_KEY = "dnav_stress_test_session_decisions";

const isSessionDecisionSnapshot = (value: unknown): value is StressTestDecisionSnapshot => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StressTestDecisionSnapshot>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.return === "number" &&
    typeof candidate.pressure === "number" &&
    typeof candidate.stability === "number" &&
    typeof candidate.dnav === "number"
  );
};

export default function StressTestPage() {
  const [baselineBuckets, setBaselineBuckets] = useState<Record<BaselineBucketKey, BaselineBucketState>>({
    intent: { text: "", file: null },
    constraints: { text: "", file: null },
    actions: { text: "", file: null },
    movement: { text: "", file: null },
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedDecisions, setExtractedDecisions] = useState<ExtractedDecision[]>([]);
  const [sessionDecisions, setSessionDecisions] = useState<StressTestDecisionSnapshot[]>(() => {
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
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [isBaselineOpen, setIsBaselineOpen] = useState(false);
  const [isSessionAnalysisOpen, setIsSessionAnalysisOpen] = useState(false);
  const calculatorRef = useRef<StressTestCalculatorHandle>(null);

  const { openDefinitions } = useDefinitionsPanel();
  const { isLoggedIn, openLogin } = useNetlifyIdentity();

  const updateBaselineBucket = useCallback((key: BaselineBucketKey, update: Partial<BaselineBucketState>) => {
    setBaselineBuckets((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...update,
      },
    }));
  }, []);

  const handleExtractDecisions = useCallback(() => {
    if (isExtracting) return;
    setIsExtracting(true);

    const typedActions = baselineBuckets.actions.text
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);

    const decisionsSource = typedActions.length > 0 ? typedActions.slice(0, 20) : DEFAULT_DECISIONS;
    const decisions: ExtractedDecision[] = decisionsSource.map((text, index) => ({
      id: `decision-${index}`,
      text,
      category: "Uncategorized",
      included: true,
    }));

    window.setTimeout(() => {
      setExtractedDecisions(decisions);
      setIsExtracting(false);
    }, 900);
  }, [baselineBuckets.actions.text, isExtracting]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(SESSION_DECISIONS_KEY, JSON.stringify(sessionDecisions));
    } catch (error) {
      console.error("Failed to persist stress test session decisions.", error);
    }
  }, [sessionDecisions]);

  const handleSaveSessionDecision = useCallback((decision: StressTestDecisionSnapshot) => {
    setSessionDecisions((prev) => [decision, ...prev]);
  }, []);

  const handleDecisionSelect = useCallback((decision: ExtractedDecision) => {
    calculatorRef.current?.selectDecision({ name: decision.text, category: decision.category });
  }, []);

  const handleDecisionContainerClick = useCallback(
    (event: MouseEvent<HTMLDivElement>, decision: ExtractedDecision) => {
      const target = event.target as HTMLElement;
      if (target.closest("button, input, textarea, [data-slot='select-trigger']")) return;
      handleDecisionSelect(decision);
    },
    [handleDecisionSelect],
  );

  const progressCount = Math.min(sessionDecisions.length, 10);
  const canOpenSessionAnalysis = sessionDecisions.length >= 10;

  const sessionStats = useMemo(() => {
    if (sessionDecisions.length === 0) {
      return {
        avgReturn: 0,
        avgPressure: 0,
        avgStability: 0,
        avgDnav: 0,
      };
    }

    const totals = sessionDecisions.reduce(
      (acc, decision) => {
        acc.return += decision.return;
        acc.pressure += decision.pressure;
        acc.stability += decision.stability;
        acc.dnav += decision.dnav;
        return acc;
      },
      { return: 0, pressure: 0, stability: 0, dnav: 0 },
    );

    const count = sessionDecisions.length;
    return {
      avgReturn: totals.return / count,
      avgPressure: totals.pressure / count,
      avgStability: totals.stability / count,
      avgDnav: totals.dnav / count,
    };
  }, [sessionDecisions]);

  const sessionBuckets = useMemo(() => {
    const buckets = {
      return: { Positive: 0, Neutral: 0, Negative: 0 },
      pressure: { Pressured: 0, Balanced: 0, Calm: 0 },
      stability: { Stable: 0, Uncertain: 0, Fragile: 0 },
    };

    sessionDecisions.forEach((decision) => {
      if (decision.return > 0) buckets.return.Positive += 1;
      else if (decision.return < 0) buckets.return.Negative += 1;
      else buckets.return.Neutral += 1;

      if (decision.pressure > 0) buckets.pressure.Pressured += 1;
      else if (decision.pressure < 0) buckets.pressure.Calm += 1;
      else buckets.pressure.Balanced += 1;

      if (decision.stability > 0) buckets.stability.Stable += 1;
      else if (decision.stability < 0) buckets.stability.Fragile += 1;
      else buckets.stability.Uncertain += 1;
    });

    return buckets;
  }, [sessionDecisions]);

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#f6f3ee] text-slate-900 dark:bg-[#050608] dark:text-white">
        <section className="bg-gradient-to-b from-[#f8f5f1] via-white to-[#f3efe8] dark:from-[#050608] dark:via-black/40 dark:to-[#050608]">
          <div className="mx-auto max-w-6xl space-y-3 px-4 pb-4 pt-3 md:px-6">
            <div className="flex flex-col gap-2 border-b border-border/60 pb-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold text-foreground">Stress Test</h1>
                  <p className="text-sm text-muted-foreground">
                    Run a fast diagnostic on a decision and capture the signal.
                  </p>
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
                    {isLoggedIn ? (
                      <Button asChild size="sm">
                        <Link href="/calculator">Go to Patterns</Link>
                      </Button>
                    ) : (
                      <Button size="sm" onClick={openLogin}>
                        Log in
                      </Button>
                    )}
                  </div>
                  {!isLoggedIn ? (
                    <p className="text-xs text-muted-foreground">
                      Log in to save decisions and{" "}
                      <Link href="/contact" className="underline underline-offset-2">
                        request analysis
                      </Link>
                      .
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <StressTestCalculator
              ref={calculatorRef}
              saveLabel="Save decision"
              requireLoginForSave
              onSaveDecision={handleSaveSessionDecision}
            />

            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span>{sessionDecisions.length}/10 decisions saved</span>
                <span className="text-muted-foreground">Session progress</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all"
                  style={{ width: `${progressCount * 10}%` }}
                />
              </div>
              {sessionDecisions.length < 10 ? (
                <p className="text-[11px] text-muted-foreground">Unlock session analysis at 10.</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  You’ve unlocked session analysis. Open it to review trends.
                </p>
              )}

              {canOpenSessionAnalysis ? (
                <Button
                  className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                  onClick={() => setIsSessionAnalysisOpen((prev) => !prev)}
                >
                  Open Session Analysis
                </Button>
              ) : (
                <Button
                  className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                  disabled
                >
                  View Decision Analysis
                </Button>
              )}
            </div>

            {canOpenSessionAnalysis && isSessionAnalysisOpen ? (
              <div className="space-y-4 rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm dark:bg-black/30">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">Session Analysis</h2>
                  <p className="text-xs text-muted-foreground">
                    Session-only readout based on your last saved decisions.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Total decisions saved
                    </p>
                    <p className="text-lg font-semibold text-foreground">{sessionDecisions.length}</p>
                  </div>
                  <div className="grid gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Avg D-NAV</span>
                      <span className="font-semibold text-foreground">{sessionStats.avgDnav.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Avg Return</span>
                      <span className="font-semibold text-foreground">{sessionStats.avgReturn.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Avg Pressure</span>
                      <span className="font-semibold text-foreground">{sessionStats.avgPressure.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Avg Stability</span>
                      <span className="font-semibold text-foreground">{sessionStats.avgStability.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Return buckets</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Positive</span>
                        <span className="font-semibold text-foreground">{sessionBuckets.return.Positive}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Neutral</span>
                        <span className="font-semibold text-foreground">{sessionBuckets.return.Neutral}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Negative</span>
                        <span className="font-semibold text-foreground">{sessionBuckets.return.Negative}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Pressure buckets</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Pressured</span>
                        <span className="font-semibold text-foreground">{sessionBuckets.pressure.Pressured}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Balanced</span>
                        <span className="font-semibold text-foreground">{sessionBuckets.pressure.Balanced}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Calm</span>
                        <span className="font-semibold text-foreground">{sessionBuckets.pressure.Calm}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Stability buckets</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Stable</span>
                        <span className="font-semibold text-foreground">{sessionBuckets.stability.Stable}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Uncertain</span>
                        <span className="font-semibold text-foreground">{sessionBuckets.stability.Uncertain}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Fragile</span>
                        <span className="font-semibold text-foreground">{sessionBuckets.stability.Fragile}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Recent decisions</h3>
                    <span className="text-xs text-muted-foreground">Session only</span>
                  </div>
                  <div className="space-y-2">
                    {sessionDecisions.slice(0, 5).map((decision) => (
                      <div
                        key={decision.id}
                        className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-foreground">{decision.name}</p>
                          <p className="text-[11px] text-muted-foreground">{decision.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">D-NAV</p>
                          <p className="font-semibold text-foreground">{decision.dnav.toFixed(1)}</p>
                        </div>
                      </div>
                    ))}
                    {sessionDecisions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No session decisions yet.</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
                  <Button asChild size="sm" className="h-9 px-4 text-xs font-semibold uppercase tracking-wide">
                    <Link href="/calculator">Go to Patterns to save as a dataset</Link>
                  </Button>
                  {!isLoggedIn ? (
                    <Button size="sm" variant="outline" className="h-9 px-4 text-xs" onClick={openLogin}>
                      Log in
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              <div className="h-px w-full bg-border/40" />
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setIsBaselineOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-left"
                >
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-foreground">Extract decisions from notes or documents</h2>
                    <p className="text-xs text-muted-foreground">Fastest way to get to 10–20.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span>Have documents?</span>
                    <ChevronDown className={`h-4 w-4 transition ${isBaselineOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isBaselineOpen ? (
                  <section className="space-y-4">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <h2 className="text-lg font-semibold text-foreground">Strategic Baseline</h2>
                        <p className="text-sm text-muted-foreground">
                          Load context so we can extract decisions before scoring them.
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload plans, memos, meeting notes, investor updates, or public filings. Plain text works best.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {BASELINE_BUCKETS.map((bucket) => {
                        const bucketState = baselineBuckets[bucket.key];
                        const fileId = `baseline-${bucket.key}-file`;
                        return (
                          <GlassCard key={bucket.key} className="flex h-full flex-col gap-3 p-4">
                            <div className="space-y-1">
                              <h3 className="text-sm font-semibold text-foreground">{bucket.title}</h3>
                              <p className="text-xs text-muted-foreground">{bucket.prompt}</p>
                            </div>
                            <Textarea
                              value={bucketState.text}
                              onChange={(event) => updateBaselineBucket(bucket.key, { text: event.target.value })}
                              placeholder="Type notes or paste excerpts"
                              className="min-h-[120px] text-sm"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                id={fileId}
                                type="file"
                                accept=".pdf,.docx,.txt"
                                className="hidden"
                                onChange={(event) => {
                                  updateBaselineBucket(bucket.key, { file: event.target.files?.[0] ?? null });
                                }}
                              />
                              <Button asChild variant="outline" size="sm" className="h-8 px-3 text-xs">
                                <label htmlFor={fileId}>Upload</label>
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                {bucketState.file?.name ?? "PDF, DOCX, TXT"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{bucket.helper}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {bucket.examples.map((example) => (
                                <Badge key={example} variant="outline" className="text-[10px] font-medium">
                                  {example}
                                </Badge>
                              ))}
                            </div>
                          </GlassCard>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={handleExtractDecisions}
                        className="h-10 w-full max-w-xs text-sm font-semibold"
                        disabled={isExtracting}
                      >
                        {isExtracting ? "Extracting…" : "Extract Decisions"}
                      </Button>

                      {isExtracting ? (
                        <div className="dnav-glass-panel space-y-3 px-4 py-3">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/70" />
                          </div>
                          <div className="grid gap-2">
                            {[...Array(3)].map((_, index) => (
                              <div key={`scan-${index}`} className="h-10 w-full animate-pulse rounded-full bg-muted/20" />
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {extractedDecisions.length > 0 ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <h3 className="text-base font-semibold text-foreground">Detected Decisions</h3>
                            <p className="text-sm text-muted-foreground">
                              Do these reflect how you see your actions? Edit anything before scoring.
                            </p>
                            {extractedDecisions.length < 10 ? (
                              <p className="text-xs text-muted-foreground">
                                We found {extractedDecisions.length}. Add more actions or upload a document to reveal
                                patterns.
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-3">
                            {extractedDecisions.map((decision) => (
                              <div
                                key={decision.id}
                                className="flex w-full flex-col gap-3 rounded-2xl border border-border/40 bg-muted/10 px-4 py-3 shadow-sm transition hover:border-border/70"
                                onClick={(event) => handleDecisionContainerClick(event, decision)}
                              >
                                <div className="flex flex-wrap items-center gap-3">
                                  <Checkbox
                                    checked={decision.included}
                                    onCheckedChange={(value) => {
                                      setExtractedDecisions((prev) =>
                                        prev.map((item) =>
                                          item.id === decision.id
                                            ? { ...item, included: value === true }
                                            : item,
                                        ),
                                      );
                                    }}
                                  />
                                  <div className="flex-1">
                                    {editingDecisionId === decision.id ? (
                                      <Input
                                        value={decision.text}
                                        onChange={(event) => {
                                          const nextValue = event.target.value;
                                          setExtractedDecisions((prev) =>
                                            prev.map((item) =>
                                              item.id === decision.id ? { ...item, text: nextValue } : item,
                                            ),
                                          );
                                        }}
                                        onBlur={() => setEditingDecisionId(null)}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            event.currentTarget.blur();
                                          }
                                        }}
                                        className="h-8 text-sm"
                                        autoFocus
                                      />
                                    ) : (
                                      <p className="text-sm font-medium text-foreground">{decision.text}</p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setEditingDecisionId(decision.id);
                                    }}
                                    className="h-8 w-8"
                                    aria-label="Edit decision"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <Select
                                    value={decision.category}
                                    onValueChange={(value) => {
                                      setExtractedDecisions((prev) =>
                                        prev.map((item) =>
                                          item.id === decision.id ? { ...item, category: value } : item,
                                        ),
                                      );
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-full md:w-44">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DECISION_CATEGORIES.map((category) => (
                                        <SelectItem key={category} value={category}>
                                          {category}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-8 px-3 text-xs font-semibold uppercase tracking-wide"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDecisionSelect(decision);
                                    }}
                                  >
                                    Score this
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>

            {process.env.NODE_ENV === "development" ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Tooltip demo: <Term termKey="impact" /> · <Term termKey="cost" /> · <Term termKey="risk" /> ·{" "}
                <Term termKey="urgency" /> · <Term termKey="confidence" /> · <Term termKey="return" /> ·{" "}
                <Term termKey="pressure" /> · <Term termKey="stability" /> · <Term termKey="dnav">D-NAV</Term>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </TooltipProvider>
  );
}
