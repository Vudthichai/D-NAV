"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionMetrics, DecisionVariables, coachHint, computeMetrics } from "@/lib/calculations";
import { useCallback, useEffect, useMemo, useState } from "react";
import SliderRow from "./SliderRow";
import StatCard from "./StatCard";
import SummaryCard from "./SummaryCard";

interface DecisionCalculatorProps {
  onOpenCompare: () => void;
  onDataChange?: (variables: DecisionVariables, metrics: DecisionMetrics) => void;
}

export default function DecisionCalculator({ onOpenCompare, onDataChange }: DecisionCalculatorProps) {
  const [variables, setVariables] = useState<DecisionVariables>({
    impact: 1,
    cost: 1,
    risk: 1,
    urgency: 1,
    confidence: 1,
  });

  const metrics = useMemo(() => computeMetrics(variables), [variables]);
  const coachText = useMemo(() => coachHint(variables, metrics), [variables, metrics]);

  const updateVariable = useCallback((key: keyof DecisionVariables, value: number) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (onDataChange) {
      onDataChange(variables, metrics);
    }
  }, [variables, metrics, onDataChange]);

  const getPillColor = (value: number, type: "return" | "stability" | "pressure") => {
    if (type === "pressure") {
      if (value > 0) return { text: "Pressured", color: "red" as const };
      if (value < 0) return { text: "Calm", color: "green" as const };
      return { text: "Balanced", color: "amber" as const };
    }

    if (value > 0)
      return { text: type === "return" ? "Positive" : "Stable", color: "green" as const };
    if (value < 0)
      return { text: type === "return" ? "Negative" : "Fragile", color: "red" as const };
    return { text: type === "return" ? "Neutral" : "Uncertain", color: "amber" as const };
  };

  return (
    <div className="space-y-6">
      {/* Top Section: Variables, Metrics, and Summary */}
      <div className="grid grid-cols-1 gap-6 lg:auto-rows-fr lg:grid-cols-3 lg:items-stretch">
        {/* Variables Section */}
        <Card id="variables-section" className="flex h-full flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold">Decision Variables</CardTitle>
            <p className="text-sm text-muted-foreground">
              Each slider represents one of the five forces shaping your call.
            </p>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                1 = minimal
              </Badge>
              <Badge variant="outline" className="text-xs">
                10 = maximum
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
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
          </CardContent>
        </Card>

        {/* Metrics Section */}
        <Card id="metrics-section" className="flex h-full flex-col">
          <CardHeader className="pb-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              2. See the Physics of This Decision
            </p>
            <CardTitle className="text-lg">Return, Stability, Pressure</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between space-y-4">
            <StatCard
              title="Return"
              value={metrics.return}
              pill={getPillColor(metrics.return, "return")}
              subtitle="Impact − Cost"
            />
            <StatCard
              title="Stability"
              value={metrics.stability}
              pill={getPillColor(metrics.stability, "stability")}
              subtitle="Confidence − Risk"
            />
            <StatCard
              title="Pressure"
              value={metrics.pressure}
              pill={getPillColor(metrics.pressure, "pressure")}
              subtitle="Urgency − Confidence"
            />
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    D-NAV Score
                  </p>
                </div>
                <p className="text-3xl font-black text-foreground">{metrics.dnav}</p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                D-NAV Composite: A single score that captures the overall health of this decision.
              </p>
            </div>
          </CardContent>
        </Card>
        {/* Summary & Coach */}
        <Card id="summary-section" className="flex h-full flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Archetype &amp; Coach</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <SummaryCard metrics={metrics} coachText={coachText} onOpenCompare={onOpenCompare} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
