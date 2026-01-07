"use client";

import SliderRow from "@/components/SliderRow";
import StatCard from "@/components/StatCard";
import SummaryCard from "@/components/SummaryCard";
import DatasetSelect from "@/components/DatasetSelect";
import { useDataset } from "@/components/DatasetProvider";
import DefinitionsSheet from "@/components/DefinitionsSheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Term from "@/components/ui/Term";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import { DecisionEntry, DecisionMetrics, DecisionVariables, computeMetrics, detectJudgmentSignal } from "@/lib/calculations";
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
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDefinitionsOpen, setIsDefinitionsOpen] = useState(false);

  const { isLoggedIn, logout } = useNetlifyIdentity();
  const { addDataset, setDecisions, isDatasetLoading, loadError } = useDataset();

  const updateVariable = useCallback((key: keyof DecisionVariables, value: number) => {
    setHasInteracted(true);
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
    setHasInteracted(false);
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

  return (
    <TooltipProvider>
      <main className="min-h-screen">
        <div className="mx-auto max-w-6xl space-y-5 px-4 pb-8 pt-4 md:px-6">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground">Stress Test</h1>
                <p className="text-sm text-muted-foreground">Measure the judgment behind a decision.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5">
                  <DatasetSelect label="Dataset" />
                  <Button variant="ghost" size="sm" className="text-xs font-semibold" onClick={addDataset}>
                    Add
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button size="sm" onClick={() => setIsDefinitionsOpen(true)} className="font-semibold">
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

          <section className="space-y-4">
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[0.95fr_1.05fr] lg:grid-cols-[0.95fr_1fr_1fr]">
              <Card className="h-full py-5">
                <CardHeader className="pb-1 space-y-1 px-5">
                  <CardTitle className="text-base font-semibold">Decision Frame</CardTitle>
                  <p className="text-sm text-muted-foreground">Name it and set the five levers.</p>
                </CardHeader>
                <CardContent className="space-y-4 px-5">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Input
                      type="text"
                      placeholder="Decision title"
                      value={decisionName}
                      onChange={(e) => {
                        setDecisionName(e.target.value);
                        setHasInteracted(true);
                      }}
                      className="h-10 text-sm"
                    />
                    <Input
                      type="text"
                      placeholder="Category"
                      value={decisionCategory}
                      onChange={(e) => {
                        setDecisionCategory(e.target.value);
                        setHasInteracted(true);
                      }}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2 sm:items-center">
                    <Button
                      onClick={handleSaveDecision}
                      className="h-10 w-full"
                      variant="secondary"
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
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Button variant="ghost" onClick={handleReset} className="h-10 px-3">
                        Reset
                      </Button>
                      <a
                        href="/log"
                        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Go to log
                      </a>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Decision variables
                      </span>
                      <Badge variant="outline" className="text-[11px] font-medium">
                        1 = low · 10 = high
                      </Badge>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 space-y-2">
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
                </CardContent>
              </Card>

              <div className="space-y-3 md:col-span-1 lg:col-span-2 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-3 lg:space-y-0">
                <Card className="flex h-full flex-col">
                  <CardHeader className="pb-1.5 space-y-1 px-5">
                    <CardTitle className="text-base font-semibold">
                      <Term termKey="return" /> · <Term termKey="pressure" /> · <Term termKey="stability" />
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Three quick reads from the sliders.</p>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4 px-5">
                    <StatCard
                      title={<Term termKey="return">Return</Term>}
                      value={metrics.return}
                      pill={getPillColor(metrics.return, "return")}
                      subtitle={
                        <>
                          <Term termKey="impact">Impact</Term> − <Term termKey="cost">Cost</Term>
                        </>
                      }
                      dense
                    />
                    <StatCard
                      title={<Term termKey="pressure">Pressure</Term>}
                      value={metrics.pressure}
                      pill={getPillColor(metrics.pressure, "pressure")}
                      subtitle={
                        <>
                          <Term termKey="urgency">Urgency</Term> − <Term termKey="confidence">Confidence</Term>
                        </>
                      }
                      dense
                    />
                    <StatCard
                      title={<Term termKey="stability">Stability</Term>}
                      value={metrics.stability}
                      pill={getPillColor(metrics.stability, "stability")}
                      subtitle={
                        <>
                          <Term termKey="confidence">Confidence</Term> − <Term termKey="risk">Risk</Term>
                        </>
                      }
                      dense
                    />
                  </CardContent>
                </Card>

                <Card className="flex h-full flex-col">
                  <CardHeader className="pb-1 space-y-1 px-5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-semibold">
                          <Term termKey="dnav">D-NAV</Term> Readout
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-3">
                        <a
                          href="/scenarios"
                          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Read scenarios
                        </a>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 px-5">
                    <SummaryCard
                      metrics={metrics}
                      judgmentSignal={judgmentSignal}
                      className="flex flex-1"
                      compact
                      showDefinitionLink={false}
                      meaningExpanded
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            {hasInteracted ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-semibold text-foreground">Ready for a deeper pass?</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" asChild>
                      <a href="/contact">Run a Decision Check</a>
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
        <DefinitionsSheet open={isDefinitionsOpen} onOpenChange={setIsDefinitionsOpen} />
      </main>
    </TooltipProvider>
  );
}
