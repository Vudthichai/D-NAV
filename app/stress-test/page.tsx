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
import Term from "@/components/ui/Term";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import { DecisionEntry, DecisionMetrics, DecisionVariables, computeMetrics, detectJudgmentSignal } from "@/lib/calculations";
import { Check, Save } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

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
  const decisionNameRef = useRef<HTMLInputElement>(null);
  const decisionCategoryRef = useRef<HTMLInputElement>(null);
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
