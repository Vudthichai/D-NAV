"use client";

import SliderRow from "@/components/SliderRow";
import StatCard from "@/components/StatCard";
import SummaryCard from "@/components/SummaryCard";
import DatasetSelect from "@/components/DatasetSelect";
import { useDataset } from "@/components/DatasetProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import { DecisionEntry, DecisionMetrics, DecisionVariables, coachHint, computeMetrics } from "@/lib/calculations";
import { Check, RotateCcw, Save } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

const DEFAULT_VARIABLES: DecisionVariables = {
  impact: 1,
  cost: 1,
  risk: 1,
  urgency: 1,
  confidence: 1,
};

const determineOptimizeFor = (variables: DecisionVariables, metrics: DecisionMetrics) => {
  if (metrics.stability <= 1) {
    return "Survivability";
  }

  if (metrics.pressure >= 3 && variables.urgency - variables.confidence >= 2) {
    return "Speed";
  }

  if (metrics.return <= 0 && metrics.stability > 0) {
    return "Upside";
  }

  if (variables.confidence >= 7 && variables.risk >= 6) {
    return "Calibration";
  }

  if (variables.confidence <= 4 && variables.urgency >= 7) {
    return "Calibration";
  }

  return "Calibration";
};

export default function StressTestPage() {
  const [decisionName, setDecisionName] = useState("");
  const [decisionCategory, setDecisionCategory] = useState("");
  const [variables, setVariables] = useState<DecisionVariables>(() => ({ ...DEFAULT_VARIABLES }));
  const [metrics, setMetrics] = useState<DecisionMetrics>(() => computeMetrics(DEFAULT_VARIABLES));
  const [isSaved, setIsSaved] = useState(false);

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

  const handleSaveDecision = () => {
    if (!decisionName.trim() || !decisionCategory.trim()) {
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
  };

  const handleReset = () => {
    setDecisionName("");
    setDecisionCategory("");
    setVariables({ ...DEFAULT_VARIABLES });
    setMetrics(computeMetrics(DEFAULT_VARIABLES));
    setIsSaved(false);
  };

  const coachLine = useMemo(() => coachHint(variables, metrics), [metrics, variables]);
  const nextMoveLine = useMemo(
    () => (coachLine ? `Take this step: ${coachLine}` : coachLine),
    [coachLine],
  );
  const optimizeFor = useMemo(() => determineOptimizeFor(variables, metrics), [metrics, variables]);

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

  return (
    <TooltipProvider>
      <main className="min-h-screen">
        <div className="mx-auto max-w-6xl space-y-6 px-4 pb-8 pt-4 md:px-6">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground">Stress Test</h1>
                <p className="text-sm text-muted-foreground">
                  One decision per screen. Adjust the levers, log it, and move on.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <a
                  href="/definitions"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground underline-offset-4 hover:text-foreground"
                >
                  See definitions
                </a>
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                  <DatasetSelect label="Dataset" />
                  <Button variant="ghost" size="sm" className="text-xs font-semibold" onClick={addDataset}>
                    Add
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
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

          <section className="space-y-5">
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1.05fr_0.95fr] lg:grid-cols-[1.2fr_1fr_1fr]">
              <Card className="h-full">
                <CardHeader className="pb-2 space-y-1">
                  <CardTitle className="text-base font-semibold">Decision Frame</CardTitle>
                  <p className="text-sm text-muted-foreground">Title it, set the five levers, and log the move.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      type="text"
                      placeholder="Decision title"
                      value={decisionName}
                      onChange={(e) => setDecisionName(e.target.value)}
                      className="h-11 text-sm"
                    />
                    <Input
                      type="text"
                      placeholder="Category"
                      value={decisionCategory}
                      onChange={(e) => setDecisionCategory(e.target.value)}
                      className="h-11 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleSaveDecision}
                      className="flex-1 min-w-[180px]"
                      disabled={!decisionName || !decisionCategory}
                    >
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
                    <Button variant="outline" onClick={handleReset} className="min-w-[120px]">
                      Reset
                    </Button>
                    <a
                      href="/log"
                      className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Go to log
                    </a>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>Decision variables</span>
                        <a
                          href="/definitions"
                          className="text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground"
                        >
                          See definitions
                        </a>
                      </div>
                      <Badge variant="outline" className="text-[11px] font-medium">
                        1 = minimal · 10 = maximum
                      </Badge>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-4 space-y-4">
                      <SliderRow
                        id="impact"
                        label="Impact"
                        hint="How big is the upside if this works?"
                        value={variables.impact}
                        onChange={(value) => updateVariable("impact", value)}
                        definitionHref="/definitions"
                      />
                      <SliderRow
                        id="cost"
                        label="Cost"
                        hint="What are you really spending — money, time, reputation, focus?"
                        value={variables.cost}
                        onChange={(value) => updateVariable("cost", value)}
                        definitionHref="/definitions"
                      />
                      <SliderRow
                        id="risk"
                        label="Risk"
                        hint="If you’re wrong, what breaks or becomes hard to undo?"
                        value={variables.risk}
                        onChange={(value) => updateVariable("risk", value)}
                        definitionHref="/definitions"
                      />
                      <SliderRow
                        id="urgency"
                        label="Urgency"
                        hint="How soon do you actually need to move?"
                        value={variables.urgency}
                        onChange={(value) => updateVariable("urgency", value)}
                        definitionHref="/definitions"
                      />
                      <SliderRow
                        id="confidence"
                        label="Confidence"
                        hint="How solid is your evidence and experience — not just your hope?"
                        value={variables.confidence}
                        onChange={(value) => updateVariable("confidence", value)}
                        definitionHref="/definitions"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4 md:col-span-1 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                <Card className="flex h-full flex-col">
                  <CardHeader className="pb-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-semibold">Return · Pressure · Stability</CardTitle>
                      <a
                        href="/scenarios"
                        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground underline-offset-4 hover:text-foreground"
                      >
                        What does this mean?
                      </a>
                    </div>
                    <p className="text-sm text-muted-foreground">Three lenses to read this decision without leaving the screen.</p>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <StatCard
                      title="Return"
                      value={metrics.return}
                      pill={getPillColor(metrics.return, "return")}
                      subtitle="Impact − Cost"
                      description="Shows if the upside beats what you burn."
                      definitionHref="/definitions"
                      dense
                    />
                    <StatCard
                      title="Pressure"
                      value={metrics.pressure}
                      pill={getPillColor(metrics.pressure, "pressure")}
                      subtitle="Urgency − Confidence"
                      description="Tells you whether urgency or conviction is steering you."
                      definitionHref="/definitions"
                      dense
                    />
                    <StatCard
                      title="Stability"
                      value={metrics.stability}
                      pill={getPillColor(metrics.stability, "stability")}
                      subtitle="Confidence − Risk"
                      description="Tests if evidence can outlast risk and friction."
                      definitionHref="/definitions"
                      dense
                    />
                  </CardContent>
                </Card>

                <Card className="flex h-full flex-col">
                  <CardHeader className="pb-2 space-y-1">
                    <CardTitle className="text-base font-semibold">Coach Readout</CardTitle>
                    <p className="text-sm text-muted-foreground">Keep the next move sharp and actionable.</p>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <SummaryCard
                      metrics={metrics}
                      coachText={nextMoveLine}
                      optimizeFor={optimizeFor}
                      className="flex flex-1"
                      compact
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">Ready for a deeper pass?</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" asChild>
                    <a href="/contact">Run a Decision Check</a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href="/contact">Book a Decision Audit</a>
                  </Button>
                  <a
                    href="/scenarios"
                    className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Read real-world scenarios
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}
