"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Save } from "lucide-react";

import SliderRow from "@/components/SliderRow";
import StatCard from "@/components/StatCard";
import SummaryCard from "@/components/SummaryCard";
import { useDataset } from "@/components/DatasetProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  coachHint,
  computeMetrics,
  type DecisionEntry,
  type DecisionMetrics,
  type DecisionVariables,
} from "@/lib/calculations";

const DEFAULT_VARIABLES: DecisionVariables = {
  impact: 1,
  cost: 1,
  risk: 1,
  urgency: 1,
  confidence: 1,
};

export default function StressTestPage() {
  const { decisions, setDecisions } = useDataset();
  const [decisionName, setDecisionName] = useState("");
  const [decisionCategory, setDecisionCategory] = useState("");
  const [variables, setVariables] = useState<DecisionVariables>({ ...DEFAULT_VARIABLES });
  const [metrics, setMetrics] = useState<DecisionMetrics>(() => computeMetrics(DEFAULT_VARIABLES));
  const [isSaved, setIsSaved] = useState(false);

  const updateVariable = useCallback((key: keyof DecisionVariables, value: number) => {
    setVariables((prev) => {
      const updated = { ...prev, [key]: value };
      setMetrics(computeMetrics(updated));
      return updated;
    });
    setIsSaved(false);
  }, []);

  const handleSaveDecision = useCallback(() => {
    if (!decisionName.trim() || !decisionCategory.trim()) {
      alert("Please enter both a decision name and category before logging.");
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
    setTimeout(() => setIsSaved(false), 2000);
  }, [decisionCategory, decisionName, metrics, setDecisions, variables]);

  const handleReset = useCallback(() => {
    setDecisionName("");
    setDecisionCategory("");
    setVariables({ ...DEFAULT_VARIABLES });
    setMetrics(computeMetrics(DEFAULT_VARIABLES));
    setIsSaved(false);
  }, []);

  const coachLine = useMemo(() => coachHint(variables, metrics), [metrics, variables]);
  const hasPatterns = decisions.length > 1;

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
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-500">Stress Test</p>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Stress-test a single decision in one screen.</h1>
            <p className="text-base text-muted-foreground max-w-3xl">
              Rapidly rate one decision across the five D-NAV forces, see Return / Pressure / Stability in real time,
              and share a lightweight readout before you commit.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:gap-3">
            <span>Keep it focused: no history, no reports, just the live calculator.</span>
            <span className="hidden md:inline">•</span>
            <span>
              Need full analytics? Visit <Link href="/reports" className="underline">The D-NAV analytics view</Link>.
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader className="pb-4">
              <CardTitle>Decision inputs</CardTitle>
              <p className="text-sm text-muted-foreground">Rate the decision once. Everything updates instantly.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input
                  type="text"
                  placeholder="Decision title"
                  value={decisionName}
                  onChange={(e) => setDecisionName(e.target.value)}
                  className="md:col-span-2"
                />
                <Input
                  type="text"
                  placeholder="Category"
                  value={decisionCategory}
                  onChange={(e) => setDecisionCategory(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Decision variables</span>
                  <Badge variant="outline">1 = minimal</Badge>
                  <Badge variant="outline">10 = maximum</Badge>
                </div>
                <div className="space-y-3">
                  <SliderRow
                    id="impact"
                    label="Impact"
                    hint="Upside if this works."
                    value={variables.impact}
                    onChange={(value) => updateVariable("impact", value)}
                  />
                  <SliderRow
                    id="cost"
                    label="Cost"
                    hint="Time, money, reputation, or focus required."
                    value={variables.cost}
                    onChange={(value) => updateVariable("cost", value)}
                  />
                  <SliderRow
                    id="risk"
                    label="Risk"
                    hint="What breaks or is hard to unwind if you're wrong."
                    value={variables.risk}
                    onChange={(value) => updateVariable("risk", value)}
                  />
                  <SliderRow
                    id="urgency"
                    label="Urgency"
                    hint="How soon you truly need to act."
                    value={variables.urgency}
                    onChange={(value) => updateVariable("urgency", value)}
                  />
                  <SliderRow
                    id="confidence"
                    label="Confidence"
                    hint="Evidence backing your call—not just optimism."
                    value={variables.confidence}
                    onChange={(value) => updateVariable("confidence", value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Button onClick={handleSaveDecision} className="flex-1" disabled={!decisionName || !decisionCategory}>
                  {isSaved ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Logged
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Log this decision
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleReset} className="sm:w-auto">
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Return, Pressure, Stability</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Your live readout. Lightweight interpretations keep the whole picture on one screen.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatCard
                  title="Return"
                  value={metrics.return}
                  pill={getPillColor(metrics.return, "return")}
                  subtitle="Impact − Cost"
                  description="Shows if the upside beats the burn."
                />
                <StatCard
                  title="Pressure"
                  value={metrics.pressure}
                  pill={getPillColor(metrics.pressure, "pressure")}
                  subtitle="Urgency − Confidence"
                  description="Highlights whether urgency or conviction is steering you."
                />
                <StatCard
                  title="Stability"
                  value={metrics.stability}
                  pill={getPillColor(metrics.stability, "stability")}
                  subtitle="Confidence − Risk"
                  description="Tests if your evidence can outlast fear."
                />
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle>D-NAV score &amp; coaching</CardTitle>
                <p className="text-sm text-muted-foreground">Fast insight for a single call—no extra noise.</p>
              </CardHeader>
              <CardContent className="h-full">
                <SummaryCard metrics={metrics} coachText={coachLine} className="h-full" />
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Next moves</p>
              <p className="text-sm text-muted-foreground">
                Keep momentum: log it, spot patterns, or pull us in for an audit.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button onClick={handleSaveDecision} disabled={!decisionName || !decisionCategory}>
                Log decision
              </Button>
              <Button asChild variant="outline" disabled={!hasPatterns}>
                <Link href="/reports" aria-disabled={!hasPatterns}>
                  View patterns
                  {!hasPatterns ? " (add another)" : null}
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/contact">
                  Book a decision audit
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
