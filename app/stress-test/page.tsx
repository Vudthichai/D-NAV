"use client";

import StressTestCalculator, { StressTestCalculatorHandle } from "@/components/stress-test/StressTestCalculator";
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
import { type DecisionEntry, getArchetype } from "@/lib/calculations";
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

interface SessionDecision {
  id: string;
  title: string;
  category: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
  dnav: number;
  return: number;
  pressure: number;
  stability: number;
  archetype: string;
  timestamp: number;
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

export default function StressTestPage() {
  const [baselineBuckets, setBaselineBuckets] = useState<Record<BaselineBucketKey, BaselineBucketState>>({
    intent: { text: "", file: null },
    constraints: { text: "", file: null },
    actions: { text: "", file: null },
    movement: { text: "", file: null },
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedDecisions, setExtractedDecisions] = useState<ExtractedDecision[]>([]);
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [isBaselineOpen, setIsBaselineOpen] = useState(false);
  const [sessionDecisions, setSessionDecisions] = useState<SessionDecision[]>([]);
  const [isSessionAnalysisOpen, setIsSessionAnalysisOpen] = useState(false);
  const calculatorRef = useRef<StressTestCalculatorHandle>(null);

  const { openDefinitions } = useDefinitionsPanel();
  const { isLoggedIn, openLogin } = useNetlifyIdentity();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(SESSION_DECISIONS_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setSessionDecisions(parsed);
      }
    } catch (error) {
      console.error("Failed to load stress test session decisions.", error);
    }
  }, []);

  const persistSessionDecisions = useCallback((nextDecisions: SessionDecision[]) => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(SESSION_DECISIONS_KEY, JSON.stringify(nextDecisions));
  }, []);

  const generateSessionId = useCallback(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  const handleSaveSessionDecision = useCallback(
    (decision: DecisionEntry) => {
      const archetype = getArchetype(decision).name;
      const nextDecision: SessionDecision = {
        id: generateSessionId(),
        title: decision.name,
        category: decision.category || "Uncategorized",
        impact: decision.impact,
        cost: decision.cost,
        risk: decision.risk,
        urgency: decision.urgency,
        confidence: decision.confidence,
        dnav: decision.dnav,
        return: decision.return,
        pressure: decision.pressure,
        stability: decision.stability,
        archetype,
        timestamp: decision.ts ?? Date.now(),
      };

      setSessionDecisions((prev) => {
        const next = [...prev, nextDecision];
        persistSessionDecisions(next);
        return next;
      });
    },
    [generateSessionId, persistSessionDecisions],
  );

  const sessionStats = useMemo(() => {
    const total = sessionDecisions.length;
    const base = {
      total,
      avgDnav: 0,
      avgReturn: 0,
      avgPressure: 0,
      avgStability: 0,
      returnBuckets: { positive: 0, neutral: 0, negative: 0 },
      pressureBuckets: { calm: 0, balanced: 0, overloaded: 0 },
      stabilityBuckets: { stable: 0, uncertain: 0, fragile: 0 },
    };

    if (total === 0) return base;

    const sums = sessionDecisions.reduce(
      (acc, decision) => {
        acc.dnav += decision.dnav;
        acc.return += decision.return;
        acc.pressure += decision.pressure;
        acc.stability += decision.stability;

        if (decision.return >= 2) acc.returnBuckets.positive += 1;
        else if (decision.return <= -2) acc.returnBuckets.negative += 1;
        else acc.returnBuckets.neutral += 1;

        if (decision.pressure >= 2) acc.pressureBuckets.overloaded += 1;
        else if (decision.pressure <= -2) acc.pressureBuckets.calm += 1;
        else acc.pressureBuckets.balanced += 1;

        if (decision.stability >= 2) acc.stabilityBuckets.stable += 1;
        else if (decision.stability <= -2) acc.stabilityBuckets.fragile += 1;
        else acc.stabilityBuckets.uncertain += 1;

        return acc;
      },
      {
        dnav: 0,
        return: 0,
        pressure: 0,
        stability: 0,
        returnBuckets: { positive: 0, neutral: 0, negative: 0 },
        pressureBuckets: { calm: 0, balanced: 0, overloaded: 0 },
        stabilityBuckets: { stable: 0, uncertain: 0, fragile: 0 },
      },
    );

    return {
      total,
      avgDnav: sums.dnav / total,
      avgReturn: sums.return / total,
      avgPressure: sums.pressure / total,
      avgStability: sums.stability / total,
      returnBuckets: sums.returnBuckets,
      pressureBuckets: sums.pressureBuckets,
      stabilityBuckets: sums.stabilityBuckets,
    };
  }, [sessionDecisions]);

  const recentDecisions = useMemo(() => sessionDecisions.slice(-20), [sessionDecisions]);

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
                      Log in to turn sessions into datasets and{" "}
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
              onSaveDecision={handleSaveSessionDecision}
            />

            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              {sessionDecisions.length < 10 ? (
                <>
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span>{sessionDecisions.length}/10 decisions saved</span>
                    <span className="text-muted-foreground">Unlock session analysis at 10</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${Math.min(sessionDecisions.length, 10) * 10}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Unlock session analysis at 10.</p>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => setIsSessionAnalysisOpen((prev) => !prev)}
                    className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                  >
                    {isSessionAnalysisOpen ? "Hide Session Analysis" : "Open Session Analysis"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    You’ve saved enough decisions for session analysis.
                  </p>
                </div>
              )}
            </div>

            {sessionDecisions.length >= 10 && isSessionAnalysisOpen ? (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-4 text-xs text-muted-foreground">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-foreground">Session RPS Baseline</h2>
                  <p className="text-xs text-muted-foreground">Session summary based on saved stress tests.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">Totals</p>
                    <div className="mt-2 grid gap-1 text-sm text-foreground">
                      <p>Total decisions: {sessionStats.total}</p>
                      <p>Avg D-NAV: {sessionStats.avgDnav.toFixed(1)}</p>
                      <p>Avg Return: {sessionStats.avgReturn.toFixed(1)}</p>
                      <p>Avg Pressure: {sessionStats.avgPressure.toFixed(1)}</p>
                      <p>Avg Stability: {sessionStats.avgStability.toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">Distributions</p>
                    <div className="mt-2 space-y-2 text-sm text-foreground">
                      <div>
                        <p className="text-[11px] uppercase text-muted-foreground">Return</p>
                        <p>
                          Positive: {sessionStats.returnBuckets.positive} · Neutral:{" "}
                          {sessionStats.returnBuckets.neutral} · Negative: {sessionStats.returnBuckets.negative}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase text-muted-foreground">Pressure</p>
                        <p>
                          Calm: {sessionStats.pressureBuckets.calm} · Balanced:{" "}
                          {sessionStats.pressureBuckets.balanced} · Overloaded:{" "}
                          {sessionStats.pressureBuckets.overloaded}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase text-muted-foreground">Stability</p>
                        <p>
                          Stable: {sessionStats.stabilityBuckets.stable} · Uncertain:{" "}
                          {sessionStats.stabilityBuckets.uncertain} · Fragile:{" "}
                          {sessionStats.stabilityBuckets.fragile}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">Latest decisions</p>
                  <div className="space-y-2">
                    {recentDecisions.map((decision) => (
                      <div
                        key={decision.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground"
                      >
                        <div>
                          <p className="text-sm font-semibold">{decision.title}</p>
                          <p className="text-[11px] text-muted-foreground">{decision.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase text-muted-foreground">D-NAV</p>
                          <p className="text-base font-semibold">{decision.dnav}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Want to keep this session? Turn it into a dataset when you log in.
                  </p>
                  {isLoggedIn ? (
                    <Button asChild variant="outline" size="sm" className="h-8 px-3 text-[11px] font-semibold">
                      <Link href="/calculator">Turn this into a dataset</Link>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-[11px] font-semibold"
                      onClick={openLogin}
                    >
                      Log in to turn this into a dataset
                    </Button>
                  )}
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
