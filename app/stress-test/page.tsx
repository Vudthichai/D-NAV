"use client";

import SliderRow from "@/components/SliderRow";
import SummaryCard from "@/components/SummaryCard";
import DatasetSelect from "@/components/DatasetSelect";
import { useDataset } from "@/components/DatasetProvider";
import { useDefinitionsPanel } from "@/components/definitions/DefinitionsPanelProvider";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle, GlassCard } from "@/components/ui/card";
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
import { DecisionEntry, DecisionMetrics, DecisionVariables, computeMetrics, detectJudgmentSignal } from "@/lib/calculations";
import { Check, Pencil, Save } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type MouseEvent } from "react";

const DEFAULT_VARIABLES: DecisionVariables = {
  impact: 1,
  cost: 1,
  risk: 1,
  urgency: 1,
  confidence: 1,
};

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

export default function StressTestPage() {
  const [decisionName, setDecisionName] = useState("");
  const [decisionCategory, setDecisionCategory] = useState("");
  const [variables, setVariables] = useState<DecisionVariables>(() => ({ ...DEFAULT_VARIABLES }));
  const [metrics, setMetrics] = useState<DecisionMetrics>(() => computeMetrics(DEFAULT_VARIABLES));
  const [isSaved, setIsSaved] = useState(false);
  const [baselineBuckets, setBaselineBuckets] = useState<Record<BaselineBucketKey, BaselineBucketState>>({
    intent: { text: "", file: null },
    constraints: { text: "", file: null },
    actions: { text: "", file: null },
    movement: { text: "", file: null },
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedDecisions, setExtractedDecisions] = useState<ExtractedDecision[]>([]);
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const decisionNameRef = useRef<HTMLInputElement>(null);
  const decisionCategoryRef = useRef<HTMLInputElement>(null);
  const decisionFrameRef = useRef<HTMLDivElement>(null);
  const { openDefinitions } = useDefinitionsPanel();

  const { isLoggedIn, logout } = useNetlifyIdentity();
  const { addDataset, setDecisions, isDatasetLoading, loadError } = useDataset();

  const updateVariable = useCallback((key: keyof DecisionVariables, value: number) => {
    setVariables((prev) => {
      const updated = { ...prev, [key]: value };
      setMetrics(computeMetrics(updated));
      return updated;
    });
    setIsSaved(false);
  }, []);

  const handleSaveDecision = useCallback(() => {
    if (!decisionName.trim()) {
      decisionNameRef.current?.focus();
      alert("Please enter both a decision name and category before saving.");
      return;
    }

    if (!decisionCategory.trim()) {
      decisionCategoryRef.current?.focus();
      alert("Please enter both a decision name and category before saving.");
      return;
    }

    const decisionEntry: DecisionEntry = {
      ...variables,
      ...metrics,
      ts: Date.now(),
      name: decisionName.trim(),
      category: decisionCategory.trim(),
    };

    setDecisions((prev) => [decisionEntry, ...prev]);
    setIsSaved(true);

    setTimeout(() => setIsSaved(false), 3000);
  }, [decisionCategory, decisionName, metrics, setDecisions, variables]);

  const handleReset = () => {
    setDecisionName("");
    setDecisionCategory("");
    setVariables({ ...DEFAULT_VARIABLES });
    setMetrics(computeMetrics(DEFAULT_VARIABLES));
    setIsSaved(false);
  };

  const judgmentSignal = useMemo(() => detectJudgmentSignal(variables, metrics), [metrics, variables]);

  const getPillColor = useCallback(
    (value: number, type: "return" | "stability" | "pressure") => {
      if (type === "pressure") {
        if (value > 0) return { text: "Pressured", color: "red" as const };
        if (value < 0) return { text: "Calm", color: "green" as const };
        return { text: "Balanced", color: "amber" as const };
      }

      if (value > 0) {
        return { text: type === "return" ? "Positive" : "Stable", color: "green" as const };
      }
      if (value < 0) {
        return { text: type === "return" ? "Negative" : "Fragile", color: "red" as const };
      }
      return { text: type === "return" ? "Neutral" : "Uncertain", color: "amber" as const };
    },
    [],
  );

  const pillVariants: Record<"green" | "amber" | "red" | "blue", string> = {
    green: "bg-green-500/18 text-green-400 border-green-500/40",
    amber: "bg-amber-500/18 text-amber-400 border-amber-500/35",
    red: "bg-red-500/18 text-red-400 border-red-500/40",
    blue: "bg-blue-500/18 text-blue-400 border-blue-500/35",
  };

  const formatStatValue = useCallback((value: number) => {
    if (value > 0) return `+${value}`;
    if (value < 0) return value.toString();
    return "0";
  }, []);

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
    setDecisionName(decision.text);
    setDecisionCategory(decision.category);
    setIsSaved(false);
    decisionFrameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    decisionNameRef.current?.focus();
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
                  <p className="text-sm text-muted-foreground">See how a decision behaves under pressure.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <div className="dnav-glass-panel flex items-center gap-2 px-2 py-1">
                    <DatasetSelect
                      label="Dataset"
                      triggerSize="sm"
                      triggerClassName="min-w-[190px] text-xs"
                      labelClassName="text-[10px]"
                    />
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium" onClick={addDataset}>
                      Add
                    </Button>
                  </div>
                  <Button size="sm" onClick={(event) => openDefinitions(event.currentTarget)} className="font-semibold">
                    Definitions
                  </Button>
                  {isLoggedIn ? (
                    <button
                      type="button"
                      onClick={logout}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Log out
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {loadError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {loadError}
              </div>
            ) : isDatasetLoading ? (
              <div className="rounded-lg border border-muted/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Loading dataset…
              </div>
            ) : null}

            <section className="space-y-2">
              <div className="grid grid-cols-1 items-stretch gap-2 lg:auto-rows-fr lg:grid-cols-3">
                <div ref={decisionFrameRef} className="scroll-mt-4">
                  <GlassCard className="flex h-full flex-col gap-6 py-6">
                  <CardHeader className="space-y-0 px-4 pb-1 pt-3">
                    <CardTitle className="text-sm font-semibold">Decision Frame</CardTitle>
                    <p className="text-sm text-muted-foreground">Name it and set the five levers.</p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-2 px-4 pb-2">
                    <div className="space-y-2">
                      <div className="grid gap-1 sm:grid-cols-2">
                        <Input
                          ref={decisionNameRef}
                          type="text"
                          placeholder="Decision title"
                          value={decisionName}
                          onChange={(e) => {
                            setDecisionName(e.target.value);
                          }}
                          className="h-8 text-sm"
                        />
                        <Input
                          ref={decisionCategoryRef}
                          type="text"
                          placeholder="Category"
                          value={decisionCategory}
                          onChange={(e) => {
                            setDecisionCategory(e.target.value);
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Decision variables
                          </span>
                          <Badge variant="outline" className="text-[11px] font-medium">
                            1 = low · 10 = high
                          </Badge>
                        </div>
                        <div className="dnav-glass-panel space-y-0.5 px-2 py-0">
                          <SliderRow
                            id="impact"
                            label={<Term termKey="impact" />}
                            value={variables.impact}
                            onChange={(value) => updateVariable("impact", value)}
                            compact
                          />
                          <SliderRow
                            id="cost"
                            label={<Term termKey="cost" />}
                            value={variables.cost}
                            onChange={(value) => updateVariable("cost", value)}
                            compact
                          />
                          <SliderRow
                            id="risk"
                            label={<Term termKey="risk" />}
                            value={variables.risk}
                            onChange={(value) => updateVariable("risk", value)}
                            compact
                          />
                          <SliderRow
                            id="urgency"
                            label={<Term termKey="urgency" />}
                            value={variables.urgency}
                            onChange={(value) => updateVariable("urgency", value)}
                            compact
                          />
                          <SliderRow
                            id="confidence"
                            label={<Term termKey="confidence" />}
                            value={variables.confidence}
                            onChange={(value) => updateVariable("confidence", value)}
                            compact
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                      <Button onClick={handleSaveDecision} variant="secondary" className="h-9 px-4 text-xs font-semibold uppercase tracking-wide">
                        {isSaved ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Saved!
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Log this decision
                          </>
                        )}
                      </Button>
                      <Button variant="ghost" onClick={handleReset} className="h-8 px-3 text-xs">
                        Reset
                      </Button>
                    </div>
                  </CardContent>
                  </GlassCard>
                </div>

                <GlassCard className="flex h-full flex-col gap-6 py-6">
                  <CardHeader className="space-y-0 px-4 pb-1 pt-3">
                    <CardTitle className="text-sm font-semibold">RPS</CardTitle>
                    <p className="text-sm text-muted-foreground">Signals derived from your inputs.</p>
                  </CardHeader>
                  <CardContent className="px-4 pb-2">
                    <div className="grid gap-4">
                      <div className="dnav-glass-panel px-2 py-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-2xl font-black text-foreground">
                              {formatStatValue(metrics.return)}
                            </div>
                            <p className="text-[11px] font-semibold text-muted-foreground">
                              <Term termKey="return">Return</Term>
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${pillVariants[getPillColor(metrics.return, "return").color]}`}
                          >
                            {getPillColor(metrics.return, "return").text}
                          </Badge>
                        </div>
                      </div>
                      <div className="dnav-glass-panel px-2 py-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-2xl font-black text-foreground">
                              {formatStatValue(metrics.pressure)}
                            </div>
                            <p className="text-[11px] font-semibold text-muted-foreground">
                              <Term termKey="pressure">Pressure</Term>
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${pillVariants[getPillColor(metrics.pressure, "pressure").color]}`}
                          >
                            {getPillColor(metrics.pressure, "pressure").text}
                          </Badge>
                        </div>
                      </div>
                      <div className="dnav-glass-panel px-2 py-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-2xl font-black text-foreground">
                              {formatStatValue(metrics.stability)}
                            </div>
                            <p className="text-[11px] font-semibold text-muted-foreground">
                              <Term termKey="stability">Stability</Term>
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${pillVariants[getPillColor(metrics.stability, "stability").color]}`}
                          >
                            {getPillColor(metrics.stability, "stability").text}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </GlassCard>

                <GlassCard className="flex h-full flex-col gap-6 py-6">
                  <CardHeader className="space-y-0 px-4 pb-2 pt-4">
                    <CardTitle className="text-sm font-semibold">
                      <Term termKey="dnav">D-NAV</Term> Readout
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 px-3 pb-3 pt-1">
                    <div className="flex h-full flex-col gap-2">
                      <SummaryCard
                        metrics={metrics}
                        judgmentSignal={judgmentSignal}
                        className="flex flex-1"
                        compact
                        showMagnitudeCue={false}
                        showDefinitionLink={false}
                      />
                    </div>
                  </CardContent>
                </GlassCard>
              </div>
            </section>

            <div className="flex items-center justify-center rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              <p>This is one decision. Patterns emerge after 10–20.</p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="h-px w-full bg-border/40" />
              <section className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">Strategic Baseline</h2>
                  <p className="text-sm text-muted-foreground">
                    Load context so we can extract decisions before scoring them.
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
