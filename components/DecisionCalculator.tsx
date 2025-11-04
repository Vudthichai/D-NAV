"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useHighlight } from "@/hooks/use-highlight";
import { DecisionMetrics, DecisionVariables, coachHint, computeMetrics } from "@/lib/calculations";
import { useCallback, useEffect, useState } from "react";
import SliderRow from "./SliderRow";
import StatCard from "./StatCard";
import SummaryCard from "./SummaryCard";

interface DecisionCalculatorProps {
  onOpenCompare: () => void;
  onDataChange?: (variables: DecisionVariables, metrics: DecisionMetrics) => void;
}

export default function DecisionCalculator({
  onOpenCompare,
  onDataChange,
}: DecisionCalculatorProps) {
  const [variables, setVariables] = useState<DecisionVariables>({
    impact: 0,
    cost: 0,
    risk: 0,
    urgency: 0,
    confidence: 0,
  });

  const [metrics, setMetrics] = useState<DecisionMetrics>({
    return: 0,
    stability: 0,
    pressure: 0,
    merit: 0,
    energy: 0,
    dnav: 0,
  });

  const [coachText, setCoachText] = useState("");

  // Highlight refs for contextual emphasis
  const variablesRef = useHighlight("variables-section");
  const metricsRef = useHighlight("metrics-section");
  const summaryRef = useHighlight("summary-section");
  const coachRef = useHighlight("coach-section");

  const updateVariable = useCallback((key: keyof DecisionVariables, value: number) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const newMetrics = computeMetrics(variables);
    setMetrics(newMetrics);
    setCoachText(coachHint(variables, newMetrics));

    // Notify parent component of data changes
    if (onDataChange) {
      onDataChange(variables, newMetrics);
    }
  }, [variables, onDataChange]);

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
    <div className="space-y-8">
      {/* Top Section: Variables, Metrics, and Summary */}
      <div className="grid grid-cols-1 gap-6 lg:auto-rows-fr lg:grid-cols-3">
        {/* Variables Section */}
        <Card ref={variablesRef} id="variables-section" className="flex h-full flex-col">
          <CardHeader className="space-y-3 pb-5">
            <CardTitle className="text-xl font-bold">Decision Variables</CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Rate each variable from 1-10 based on your current context and feelings.
            </p>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                0 = minimal
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
              hint="Expected benefit / upside"
              value={variables.impact}
              onChange={(value) => updateVariable("impact", value)}
            />
            <SliderRow
              id="cost"
              label="Cost"
              hint="Money, time, or effort required"
              value={variables.cost}
              onChange={(value) => updateVariable("cost", value)}
            />
            <SliderRow
              id="risk"
              label="Risk"
              hint="Downside, what could go wrong"
              value={variables.risk}
              onChange={(value) => updateVariable("risk", value)}
            />
            <SliderRow
              id="urgency"
              label="Urgency"
              hint="How soon action is needed"
              value={variables.urgency}
              onChange={(value) => updateVariable("urgency", value)}
            />
            <SliderRow
              id="confidence"
              label="Confidence"
              hint="Evidence, readiness, and conviction"
              value={variables.confidence}
              onChange={(value) => updateVariable("confidence", value)}
            />
          </CardContent>
        </Card>

        {/* Metrics Section */}
        <Card ref={metricsRef} id="metrics-section" className="flex h-full flex-col">
          <CardHeader className="space-y-2.5 pb-4">
            <CardTitle className="text-lg">RPS Signals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col space-y-5">
            <StatCard
              title="Return"
              value={metrics.return}
              pill={getPillColor(metrics.return, "return")}
            />
            <StatCard
              title="Stability"
              value={metrics.stability}
              pill={getPillColor(metrics.stability, "stability")}
            />
            <StatCard
              title="Pressure"
              value={metrics.pressure}
              pill={getPillColor(metrics.pressure, "pressure")}
            />
          </CardContent>
        </Card>
        {/* Summary & Coach */}
        <Card ref={summaryRef} id="summary-section" className="flex h-full flex-col">
          <CardHeader className="space-y-2.5 pb-5">
            <CardTitle className="text-lg">Archetype &amp; Coach</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            <SummaryCard
              metrics={metrics}
              urgency={variables.urgency}
              confidence={variables.confidence}
              onOpenCompare={onOpenCompare}
            />
            <Separator />
            <div ref={coachRef} id="coach-section" className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Coach Insight
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{coachText}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
