"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHighlight } from "@/hooks/use-highlight";
import { DecisionMetrics, DecisionVariables, coachHint, computeMetrics } from "@/lib/calculations";
import { useEffect, useState } from "react";
import SliderRow from "./SliderRow";
import StatCard from "./StatCard";
import SummaryCard from "./SummaryCard";

interface DecisionCalculatorProps {
  onOpenCompare: () => void;
  isDemoMode?: boolean;
  onDemoStep?: (step: string, action: (value: number) => void) => void;
  onDataChange?: (variables: DecisionVariables, metrics: DecisionMetrics) => void;
}

export default function DecisionCalculator({
  onOpenCompare,
  isDemoMode = false,
  onDemoStep,
  onDataChange,
}: DecisionCalculatorProps) {
  const [variables, setVariables] = useState<DecisionVariables>({
    impact: 1,
    cost: 1,
    risk: 1,
    urgency: 1,
    confidence: 1,
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

  // Highlight refs for demo mode
  const variablesRef = useHighlight("variables-section");
  const metricsRef = useHighlight("metrics-section");
  const summaryRef = useHighlight("summary-section");
  const coachRef = useHighlight("coach-section");

  useEffect(() => {
    const newMetrics = computeMetrics(variables);
    setMetrics(newMetrics);
    setCoachText(coachHint(variables, newMetrics));

    // Notify parent component of data changes
    if (onDataChange) {
      onDataChange(variables, newMetrics);
    }
  }, [variables, onDataChange]);

  // Demo mode setup
  useEffect(() => {
    if (onDemoStep) {
      // Register demo steps
      onDemoStep("impact", (value: number) => updateVariable("impact", value));
      onDemoStep("cost", (value: number) => updateVariable("cost", value));
      onDemoStep("risk", (value: number) => updateVariable("risk", value));
      onDemoStep("urgency", (value: number) => updateVariable("urgency", value));
      onDemoStep("confidence", (value: number) => updateVariable("confidence", value));
    }
  }, [onDemoStep]);

  const updateVariable = (key: keyof DecisionVariables, value: number) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  };

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
      {/* Top Section: Variables and Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Variables Section */}
        <Card ref={variablesRef} id="variables-section" className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold">Decision Variables</CardTitle>
            <p className="text-sm text-muted-foreground">
              Rate each variable from 1-10 based on your current context and feelings.
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
              hint="Expected benefit / upside"
              value={variables.impact}
              onChange={(value) => updateVariable("impact", value)}
              isDemoMode={isDemoMode}
            />
            <SliderRow
              id="cost"
              label="Cost"
              hint="Money, time, or effort required"
              value={variables.cost}
              onChange={(value) => updateVariable("cost", value)}
              isDemoMode={isDemoMode}
            />
            <SliderRow
              id="risk"
              label="Risk"
              hint="Downside, what could go wrong"
              value={variables.risk}
              onChange={(value) => updateVariable("risk", value)}
              isDemoMode={isDemoMode}
            />
            <SliderRow
              id="urgency"
              label="Urgency"
              hint="How soon action is needed"
              value={variables.urgency}
              onChange={(value) => updateVariable("urgency", value)}
              isDemoMode={isDemoMode}
            />
            <SliderRow
              id="confidence"
              label="Confidence"
              hint="Evidence, readiness, and conviction"
              value={variables.confidence}
              onChange={(value) => updateVariable("confidence", value)}
              isDemoMode={isDemoMode}
            />
          </CardContent>
        </Card>

        {/* Metrics Section */}
        <Card ref={metricsRef} id="metrics-section">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Key Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
      </div>

      {/* Bottom Section: Summary and Coach */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary Card */}
        <Card ref={summaryRef} id="summary-section">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Decision Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <SummaryCard
              metrics={metrics}
              urgency={variables.urgency}
              confidence={variables.confidence}
              onOpenCompare={onOpenCompare}
            />
          </CardContent>
        </Card>

        {/* Coach Readout */}
        <Card ref={coachRef} id="coach-section">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Coach Insight</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{coachText}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
