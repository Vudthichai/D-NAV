"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionMetrics, DecisionVariables, coachHint, computeMetrics } from "@/lib/calculations";
import { useCallback, useEffect, useMemo, useState } from "react";
import SliderRow from "./SliderRow";
import StatCard from "./StatCard";
import SummaryCard from "./SummaryCard";

interface DecisionCalculatorProps {
  onDataChange?: (variables: DecisionVariables, metrics: DecisionMetrics) => void;
}

export default function DecisionCalculator({ onDataChange }: DecisionCalculatorProps) {
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
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Return, Pressure, Stability</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between space-y-4">
            <div className="space-y-2">
              <StatCard
                title="Return"
                value={metrics.return}
                pill={getPillColor(metrics.return, "return")}
                subtitle="Impact − Cost"
              />
              <p className="text-xs text-muted-foreground leading-snug">
                Is this decision actually worth the energy? Positive return means the upside justifies what
                you’re spending in time, money, and focus.
              </p>
            </div>
            <div className="space-y-2">
              <StatCard
                title="Pressure"
                value={metrics.pressure}
                pill={getPillColor(metrics.pressure, "pressure")}
                subtitle="Urgency − Confidence"
              />
              <p className="text-xs text-muted-foreground leading-snug">
                High pressure means urgency is running ahead of confidence, and the decision is starting to
                decide you instead of the other way around.
              </p>
            </div>
            <div className="space-y-2">
              <StatCard
                title="Stability"
                value={metrics.stability}
                pill={getPillColor(metrics.stability, "stability")}
                subtitle="Confidence − Risk"
              />
              <p className="text-xs text-muted-foreground leading-snug">
                Stability tells you how likely this decision is to survive turbulence.
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
            <SummaryCard metrics={metrics} coachText={coachText} />
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Your RPS profile is your internal compass.
        <br />
        Return tells you why you’re moving.
        <br />
        Pressure tells you what’s pushing you.
        <br />
        Stability tells you whether you can hold the move.
        <br />
        Together, they reveal the real physics behind this decision.
      </p>
    </div>
  );
}
