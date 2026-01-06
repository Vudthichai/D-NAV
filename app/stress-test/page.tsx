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
        <div className="mx-auto max-w-7xl space-y-6 px-4 pb-8 pt-4 md:px-6">
          <div className="flex flex-col gap-2 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">Stress Test</h1>
              <p className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                Rate one decision. See Return, Pressure, and Stability instantly.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DatasetSelect label="Dataset" />
              <Button variant="outline" size="sm" onClick={addDataset}>
                Add dataset
              </Button>
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

          {loadError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          ) : isDatasetLoading ? (
            <div className="rounded-lg border border-muted/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Loading dataset…
            </div>
          ) : null}

          <section className="space-y-4">
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1.1fr_0.9fr] lg:grid-cols-3">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Decision Inputs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
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
                      className="flex-1 min-w-[160px]"
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
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Decision variables
                      </p>
                      <Badge variant="outline" className="text-[11px] font-medium">
                        1 = minimal · 10 = maximum
                      </Badge>
                    </div>
                    <div className="divide-y divide-border/60 rounded-lg bg-muted/20 px-3 py-2">
                      <SliderRow
                        id="impact"
                        label="Impact"
                        hint="How big is the upside if this works?"
                        value={variables.impact}
                        onChange={(value) => updateVariable("impact", value)}
                        compact
                      />
                      <SliderRow
                        id="cost"
                        label="Cost"
                        hint="What are you really spending — money, time, reputation, focus?"
                        value={variables.cost}
                        onChange={(value) => updateVariable("cost", value)}
                        compact
                      />
                      <SliderRow
                        id="risk"
                        label="Risk"
                        hint="If you’re wrong, what breaks or becomes hard to undo?"
                        value={variables.risk}
                        onChange={(value) => updateVariable("risk", value)}
                        compact
                      />
                      <SliderRow
                        id="urgency"
                        label="Urgency"
                        hint="How soon do you actually need to move?"
                        value={variables.urgency}
                        onChange={(value) => updateVariable("urgency", value)}
                        compact
                      />
                      <SliderRow
                        id="confidence"
                        label="Confidence"
                        hint="How solid is your evidence and experience — not just your hope?"
                        value={variables.confidence}
                        onChange={(value) => updateVariable("confidence", value)}
                        compact
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4 md:col-span-1 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Return · Pressure · Stability</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StatCard
                      title="Return"
                      value={metrics.return}
                      pill={getPillColor(metrics.return, "return")}
                      subtitle="Impact − Cost"
                      description="Return shows if the upside beats the burn."
                      dense
                    />
                    <StatCard
                      title="Pressure"
                      value={metrics.pressure}
                      pill={getPillColor(metrics.pressure, "pressure")}
                      subtitle="Urgency − Confidence"
                      description="Pressure shows whether urgency or conviction is steering you."
                      dense
                    />
                    <StatCard
                      title="Stability"
                      value={metrics.stability}
                      pill={getPillColor(metrics.stability, "stability")}
                      subtitle="Confidence − Risk"
                      description="Stability tests if evidence can outlast fear."
                      dense
                    />
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Coach Readout</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <SummaryCard metrics={metrics} coachText={coachLine} className="flex flex-1" compact />
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}
