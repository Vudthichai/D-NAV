"use client";

import StressTestCalculator, { type StressTestCalculatorHandle } from "@/components/stress-test/StressTestCalculator";
import StressTestDatasetControls from "@/components/stress-test/StressTestDatasetControls";
import { CardContent, CardHeader, CardTitle, GlassCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Pencil } from "lucide-react";
import { useCallback, useRef, useState, type MouseEvent } from "react";

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
  const [baselineBuckets, setBaselineBuckets] = useState<Record<BaselineBucketKey, BaselineBucketState>>({
    intent: { text: "", file: null },
    constraints: { text: "", file: null },
    actions: { text: "", file: null },
    movement: { text: "", file: null },
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedDecisions, setExtractedDecisions] = useState<ExtractedDecision[]>([]);
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const calculatorRef = useRef<StressTestCalculatorHandle>(null);

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
    calculatorRef.current?.selectDecision({ text: decision.text, category: decision.category });
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
                <StressTestDatasetControls />
              </div>
            </div>

            <StressTestCalculator ref={calculatorRef} />

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
