"use client";

import { Info } from "lucide-react";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { computeMetrics, DecisionVariables } from "@/lib/calculations";
import { loadLog } from "@/lib/storage";
import SliderRow from "@/components/SliderRow";

interface CompareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseVariables: DecisionVariables;
}

const clampVariable = (value: number) => Math.min(10, Math.max(1, Number.isFinite(value) ? value : 1));
const DELTA_EPSILON = 0.15;
const INTERACTION_EPSILON = 0.05;

const QUICK_TESTS: { label: string; changes: Partial<DecisionVariables> }[] = [
  { label: "Impact +1", changes: { impact: 1 } },
  { label: "Impact −1", changes: { impact: -1 } },
  { label: "Cost +1", changes: { cost: 1 } },
  { label: "Cost −1", changes: { cost: -1 } },
  { label: "Risk +1", changes: { risk: 1 } },
  { label: "Risk −1", changes: { risk: -1 } },
  { label: "Urgency +1", changes: { urgency: 1 } },
  { label: "Urgency −1", changes: { urgency: -1 } },
  { label: "Confidence +1", changes: { confidence: 1 } },
  { label: "Confidence −1", changes: { confidence: -1 } },
  { label: "+1 Impact, +1 Risk", changes: { impact: 1, risk: 1 } },
  { label: "−1 Cost, −1 Confidence", changes: { cost: -1, confidence: -1 } },
  { label: "−1 Urgency, −1 Confidence", changes: { urgency: -1, confidence: -1 } },
];

const SUMMARY_TOOLTIPS = [
  { term: "Signal (Return)", text: "How much upside your decisions are reaching for." },
  { term: "Load (Pressure)", text: "How constrained or forced your decisions are." },
  { term: "Coherence (Stability)", text: "How repeatable your posture is across decisions." },
  { term: "Repeatability (Consistency)", text: "How much your decisions swing." },
];

const VARIABLE_LABELS: Record<keyof DecisionVariables, string> = {
  impact: "Impact",
  cost: "Cost",
  risk: "Risk",
  urgency: "Urgency",
  confidence: "Confidence",
};

export default function CompareSheet({
  open,
  onOpenChange,
  baseVariables,
}: CompareSheetProps) {
  const [baselineVariables, setBaselineVariables] = useState<DecisionVariables>({ ...baseVariables });
  const [testVariables, setTestVariables] = useState<DecisionVariables>({ ...baseVariables });
  const [advancedMode, setAdvancedMode] = useState(false);
  const [historyResetKey, setHistoryResetKey] = useState(0);
  const history = useMemo(() => (open ? loadLog() : []), [open]);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      startTransition(() => {
        setBaselineVariables({ ...baseVariables });
        setTestVariables({ ...baseVariables });
        setAdvancedMode(false);
      });
    }
    wasOpen.current = open;
  }, [open, baseVariables]);

  const baselineMetrics = useMemo(() => computeMetrics(baselineVariables), [baselineVariables]);
  const testMetrics = useMemo(() => computeMetrics(testVariables), [testVariables]);

  const deltas = useMemo(() => {
    return {
      return: testMetrics.return - baselineMetrics.return,
      pressure: testMetrics.pressure - baselineMetrics.pressure,
      stability: testMetrics.stability - baselineMetrics.stability,
      dnav: testMetrics.dnav - baselineMetrics.dnav,
    };
  }, [baselineMetrics, testMetrics]);

  const leverageBreakdown = useMemo(() => {
    const baseScore = baselineMetrics.dnav;
    const totalDelta = testMetrics.dnav - baseScore;
    const contributions = (Object.keys(VARIABLE_LABELS) as (keyof DecisionVariables)[]).map(
      (key) => {
        const hybrid = { ...baselineVariables, [key]: testVariables[key] };
        const hybridScore = computeMetrics(hybrid).dnav;
        return {
          key,
          label: VARIABLE_LABELS[key],
          delta: hybridScore - baseScore,
        };
      }
    );
    const contributionSum = contributions.reduce((sum, entry) => sum + entry.delta, 0);
    const remainder = totalDelta - contributionSum;
    const list = [...contributions];
    if (Math.abs(remainder) > INTERACTION_EPSILON) {
      list.push({
        key: "interaction",
        label: "Interaction",
        delta: remainder,
        description: "Interaction effects (variables amplify each other).",
      });
    }
    list.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const primaryDriver = list.length > 0 ? list[0] : null;

    return {
      list,
      primaryDriver,
      totalDelta,
    };
  }, [baselineMetrics, baselineVariables, testMetrics, testVariables]);

  const interpretation = useMemo(() => {
    const nearZero =
      Math.abs(deltas.return) < DELTA_EPSILON &&
      Math.abs(deltas.pressure) < DELTA_EPSILON &&
      Math.abs(deltas.stability) < DELTA_EPSILON;

    if (nearZero) {
      return {
        label: "No meaningful shift",
        text: "No meaningful shift detected.",
      };
    }

    if (deltas.return > 0 && deltas.stability < 0) {
      return {
        label: "High-variance posture",
        text: "Higher upside was achieved with lower repeatability.",
      };
    }

    if (deltas.return > 0 && deltas.pressure > 0) {
      return {
        label: "Push posture",
        text: "Upside increased, but load increased too.",
      };
    }

    if (deltas.return > 0 && deltas.stability > 0) {
      return {
        label: "Compounding posture",
        text: "Upside increased with stronger structure.",
      };
    }

    if (deltas.pressure < 0 && deltas.stability > 0) {
      return {
        label: "Stabilizing posture",
        text: "More breathing room, more repeatable execution.",
      };
    }

    if (deltas.return < 0 && deltas.pressure < 0) {
      return {
        label: "Conservative posture",
        text: "Lower ambition, lower load.",
      };
    }

    return {
      label: "Mixed shift",
      text: "The posture shifted in multiple directions.",
    };
  }, [deltas]);

  const applyQuickTest = (changes: Partial<DecisionVariables>) => {
    const next = { ...baselineVariables };
    (Object.keys(changes) as (keyof DecisionVariables)[]).forEach((key) => {
      const delta = changes[key] ?? 0;
      next[key] = clampVariable(next[key] + delta);
    });
    setTestVariables(next);
  };

  const handleBaselineReset = () => {
    setBaselineVariables({ ...baseVariables });
    setTestVariables({ ...baseVariables });
  };

  const handleBaselineFromHistory = (timestamp: string) => {
    const decision = history.find((entry) => entry.ts.toString() === timestamp);
    if (!decision) return;
    const nextBaseline: DecisionVariables = {
      impact: clampVariable(decision.impact),
      cost: clampVariable(decision.cost),
      risk: clampVariable(decision.risk),
      urgency: clampVariable(decision.urgency),
      confidence: clampVariable(decision.confidence),
    };
    setBaselineVariables(nextBaseline);
    setTestVariables(nextBaseline);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto px-6 sm:max-w-[92vw] sm:px-8 lg:max-w-[88vw] lg:px-10 xl:max-w-[80vw]"
      >
        <SheetHeader>
          <SheetTitle>Judgment Lab</SheetTitle>
          <SheetDescription>
            Compare one controlled test against a locked baseline to see what actually moves the
            score.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="text-base font-semibold">Baseline</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Locked inputs pulled from the calculator or a logged decision.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleBaselineReset}>
                    Use current sliders as baseline
                  </Button>
                  {history.length > 0 && (
                    <Select
                      key={historyResetKey}
                      onValueChange={(value) => {
                        handleBaselineFromHistory(value);
                        setHistoryResetKey((prev) => prev + 1);
                      }}
                    >
                      <SelectTrigger size="sm" className="min-w-[180px]">
                        <SelectValue placeholder="Use logged decision" />
                      </SelectTrigger>
                      <SelectContent>
                        {history.map((entry) => {
                          const date = new Date(entry.ts);
                          return (
                            <SelectItem key={entry.ts} value={entry.ts.toString()}>
                              <span className="flex flex-col text-left">
                                <span className="font-medium">
                                  {entry.name || "Untitled decision"}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {date.toLocaleDateString()} • D-NAV {entry.dnav}
                                </span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Inputs
                  </h4>
                  <div className="space-y-2">
                    {(Object.keys(VARIABLE_LABELS) as (keyof DecisionVariables)[]).map((key) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-md border border-muted/40 bg-muted/20 px-3 py-2 text-sm"
                      >
                        <span className="text-muted-foreground">{VARIABLE_LABELS[key]}</span>
                        <span className="font-semibold text-foreground">{baselineVariables[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <MetricTile label="Return" value={baselineMetrics.return} />
                    <MetricTile label="Pressure" value={baselineMetrics.pressure} />
                    <MetricTile label="Stability" value={baselineMetrics.stability} />
                    <MetricTile label="D-NAV" value={baselineMetrics.dnav} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="text-base font-semibold">Test</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Apply one change at a time to understand leverage.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Quick tests
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TESTS.map((test) => (
                      <Button
                        key={test.label}
                        size="sm"
                        variant="outline"
                        onClick={() => applyQuickTest(test.changes)}
                      >
                        {test.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="advanced-mode"
                    checked={advancedMode}
                    onCheckedChange={(checked) => setAdvancedMode(Boolean(checked))}
                  />
                  <label htmlFor="advanced-mode" className="text-sm text-muted-foreground">
                    Advanced sliders
                  </label>
                </div>

                {advancedMode && (
                  <div className="space-y-4">
                    <SliderRow
                      id="test-impact"
                      label="Impact"
                      hint="Expected benefit / upside"
                      value={testVariables.impact}
                      onChange={(value) =>
                        setTestVariables((prev) => ({ ...prev, impact: value }))
                      }
                    />
                    <SliderRow
                      id="test-cost"
                      label="Cost"
                      hint="Money, time, or effort required"
                      value={testVariables.cost}
                      onChange={(value) => setTestVariables((prev) => ({ ...prev, cost: value }))}
                    />
                    <SliderRow
                      id="test-risk"
                      label="Risk"
                      hint="Downside, what could go wrong"
                      value={testVariables.risk}
                      onChange={(value) => setTestVariables((prev) => ({ ...prev, risk: value }))}
                    />
                    <SliderRow
                      id="test-urgency"
                      label="Urgency"
                      hint="How soon action is needed"
                      value={testVariables.urgency}
                      onChange={(value) =>
                        setTestVariables((prev) => ({ ...prev, urgency: value }))
                      }
                    />
                    <SliderRow
                      id="test-confidence"
                      label="Confidence"
                      hint="Evidence, readiness, and conviction"
                      value={testVariables.confidence}
                      onChange={(value) =>
                        setTestVariables((prev) => ({ ...prev, confidence: value }))
                      }
                    />
                  </div>
                )}

                {!advancedMode && (
                  <div className="rounded-md border border-muted/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Advanced sliders are off. Use Quick Tests to adjust a single lever.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="text-base font-semibold">Results</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Delta reflects Test minus Baseline.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-md border border-muted/40 bg-muted/10 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Δ D-NAV</div>
                  <div className="text-3xl font-semibold text-foreground">
                    {formatSigned(deltas.dnav)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <DeltaPill label="Δ Return" value={deltas.return} />
                  <DeltaPill label="Δ Pressure" value={deltas.pressure} />
                  <DeltaPill label="Δ Stability" value={deltas.stability} />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Leverage Breakdown</h4>
                  <div className="space-y-2">
                    {leverageBreakdown.list.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-start justify-between gap-3 rounded-md border border-muted/40 bg-muted/20 px-3 py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium text-foreground">{item.label}</div>
                          {"description" in item && (
                            <div className="text-xs text-muted-foreground">{item.description}</div>
                          )}
                        </div>
                        <div className={valueTone(item.delta)}>{formatSigned(item.delta)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Primary driver:{" "}
                    <span className="font-semibold text-foreground">
                      {leverageBreakdown.primaryDriver
                        ? `${leverageBreakdown.primaryDriver.label} (${formatSigned(
                            leverageBreakdown.primaryDriver.delta
                          )})`
                        : "None"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Interpretation</div>
                  <div className="rounded-md border border-muted/40 bg-muted/20 px-3 py-3">
                    <div className="text-sm font-semibold text-foreground">
                      {interpretation.label}
                    </div>
                    <div className="text-sm text-muted-foreground">{interpretation.text}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Metric guide
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SUMMARY_TOOLTIPS.map((item) => (
                      <Tooltip key={item.term}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 rounded-md border border-muted/40 bg-muted/20 px-3 py-2 text-xs font-medium text-foreground">
                            <Info className="h-3 w-3 text-muted-foreground" />
                            {item.term}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs text-foreground">
                          {item.text}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-muted/40 bg-muted/20 px-3 py-2">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground">{formatValue(value)}</div>
    </div>
  );
}

function DeltaPill({ label, value }: { label: string; value: number }) {
  return (
    <div
      className={`rounded-full border border-muted/40 px-3 py-1 text-xs font-semibold ${valueTone(
        value
      )}`}
    >
      {label}: {formatSigned(value)}
    </div>
  );
}

function formatValue(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatSigned(value: number) {
  if (Math.abs(value) < 0.05) return "0";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value)}`;
}

function valueTone(value: number) {
  if (value > 0.05) return "text-emerald-500";
  if (value < -0.05) return "text-rose-500";
  return "text-muted-foreground";
}
