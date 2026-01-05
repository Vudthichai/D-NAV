"use client";

import SliderRow from "@/components/SliderRow";
import StatCard from "@/components/StatCard";
import SummaryCard from "@/components/SummaryCard";
import DatasetSelect from "@/components/DatasetSelect";
import { useDataset } from "@/components/DatasetProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import { DecisionEntry, DecisionMetrics, DecisionVariables, coachHint, computeMetrics } from "@/lib/calculations";
import { Check, RotateCcw, Save, Upload } from "lucide-react";
import Link from "next/link";
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

  const stepSummaries = [
    {
      step: "STEP 1",
      title: "Rate Your Decision",
      description: "Capture one real decision and rate the five forces shaping it.",
    },
    {
      step: "STEP 2",
      title: "See the Physics of Your Decision",
      description: "Your inputs generate the real-time signals shaping the direction of your call.",
    },
    {
      step: "STEP 3",
      title: "See Your Read Out",
      description: "The D-NAV score reads those signals and shows where your energy is going.",
    },
  ];

  return (
    <TooltipProvider>
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto p-6 space-y-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3 max-w-3xl">
              <h1 className="text-3xl font-bold text-foreground">Stress Test</h1>
              <p className="text-base text-muted-foreground leading-relaxed">
                Stress-test a single decision in one screen.
              </p>
            </div>
            <div className="flex gap-2 self-start items-center">
              <div className="flex items-center gap-2">
                <DatasetSelect label="Dataset" />
                <Button variant="outline" size="sm" onClick={addDataset}>
                  Add dataset
                </Button>
              </div>
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={logout}
                  className="logout-btn text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Log out
                </button>
              ) : null}
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
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

          <section className="mt-8 space-y-10">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {stepSummaries.map((summary) => (
                <div key={summary.step} className="space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-orange-500">
                    <span className="uppercase">{summary.step}</span>
                    <span className="text-foreground font-semibold normal-case"> — {summary.title}</span>
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{summary.description}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 items-start md:grid-cols-2 lg:grid-cols-3">
              <div className="flex h-full flex-col">
                <div className="flex flex-1 flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-sm md:p-5 dnav-card-surface">
                  <div className="space-y-3 flex-1">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">Decision Inputs</h3>
                      <p className="text-sm text-muted-foreground">
                        Capture one real decision and rate the five forces shaping it.
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-muted-foreground">Quick Entry</p>
                        <Input
                          type="text"
                          placeholder="What's Your Decision?"
                          value={decisionName}
                          onChange={(e) => setDecisionName(e.target.value)}
                          className="h-12 text-base lg:text-lg"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Input
                          type="text"
                          placeholder="Categorize it"
                          value={decisionCategory}
                          onChange={(e) => setDecisionCategory(e.target.value)}
                        />
                        <Button
                          onClick={handleSaveDecision}
                          className="w-full"
                          disabled={!decisionName || !decisionCategory}
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Saved!
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Save Decision
                            </>
                          )}
                        </Button>
                        <Button variant="outline" className="w-full md:col-span-2" asChild>
                          <Link href="/log#import" className="flex items-center justify-center">
                            <Upload className="w-4 h-4 mr-2" />
                            Import Decisions
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">Decision Variables</p>
                        <p className="text-xs text-muted-foreground">
                          Each slider represents one of the five forces shaping your call.
                        </p>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            1 = minimal
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            10 = maximum
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <SliderRow
                          id="impact"
                          label="Impact"
                          hint="How big is the upside if this works?"
                          value={variables.impact}
                          onChange={(value) => updateVariable("impact", value)}
                        />
                        <SliderRow
                          id="cost"
                          label="Cost"
                          hint="What are you really spending — money, time, reputation, focus?"
                          value={variables.cost}
                          onChange={(value) => updateVariable("cost", value)}
                        />
                        <SliderRow
                          id="risk"
                          label="Risk"
                          hint="If you’re wrong, what breaks or becomes hard to undo?"
                          value={variables.risk}
                          onChange={(value) => updateVariable("risk", value)}
                        />
                        <SliderRow
                          id="urgency"
                          label="Urgency"
                          hint="How soon do you actually need to move?"
                          value={variables.urgency}
                          onChange={(value) => updateVariable("urgency", value)}
                        />
                        <SliderRow
                          id="confidence"
                          label="Confidence"
                          hint="How solid is your evidence and experience — not just your hope?"
                          value={variables.confidence}
                          onChange={(value) => updateVariable("confidence", value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col">
                <div className="flex flex-1 flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-sm md:p-5 dnav-card-surface">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">Return, Pressure, Stability</h3>
                      <p className="text-sm text-muted-foreground">
                        The physics of your decision — upside, execution stress, and survivability.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <StatCard
                        title="Return"
                        value={metrics.return}
                        pill={getPillColor(metrics.return, "return")}
                        subtitle="Impact − Cost"
                        description="Return shows if the upside beats the burn."
                      />
                      <StatCard
                        title="Pressure"
                        value={metrics.pressure}
                        pill={getPillColor(metrics.pressure, "pressure")}
                        subtitle="Urgency − Confidence"
                        description="Pressure shows whether urgency or conviction is steering you."
                      />
                      <StatCard
                        title="Stability"
                        value={metrics.stability}
                        pill={getPillColor(metrics.stability, "stability")}
                        subtitle="Confidence − Risk"
                        description="Stability tests if evidence can outlast fear."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col">
                <div className="flex flex-1 flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-sm md:p-5 dnav-card-surface">
                  <div className="space-y-4 h-full">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">Archetype &amp; Coach</h3>
                      <p className="text-sm text-muted-foreground">
                        Your decision pattern plus the live D-NAV score readout.
                      </p>
                    </div>
                    <SummaryCard metrics={metrics} coachText={coachLine} className="flex flex-1" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}
