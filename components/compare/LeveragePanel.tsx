"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SliderRow from "@/components/SliderRow";
import LeverageLedger from "@/components/compare/LeverageLedger";
import LeverageInsight from "@/components/compare/LeverageInsight";
import { computeLeverage } from "@/lib/leverage/computeLeverage";
import type { DecisionInputs, DecisionMetrics, LeverageVariable } from "@/types/leverage";

interface LeveragePanelProps {
  baseInputs: DecisionInputs;
}

const variableOptions: { value: LeverageVariable; label: string; hint: string }[] = [
  { value: "impact", label: "Impact", hint: "Expected benefit / upside" },
  { value: "cost", label: "Cost", hint: "Money, time, or effort required" },
  { value: "risk", label: "Risk", hint: "Downside, what could go wrong" },
  { value: "urgency", label: "Urgency", hint: "How soon action is needed" },
  { value: "confidence", label: "Confidence", hint: "Evidence, readiness, and conviction" },
];

const clampVariable = (value: number) => Math.min(10, Math.max(1, value));

const formatMetric = (value: number) => (Number.isFinite(value) ? value.toFixed(1) : "--");

const isDecisionComplete = (inputs: DecisionInputs) =>
  Object.values(inputs).every((value) => Number.isFinite(value));

const buildMetricsSummary = (metrics: DecisionMetrics | null) => [
  { label: "Return", value: metrics ? formatMetric(metrics.return) : "--" },
  { label: "Pressure", value: metrics ? formatMetric(metrics.pressure) : "--" },
  { label: "Stability", value: metrics ? formatMetric(metrics.stability) : "--" },
  { label: "D-NAV", value: metrics ? formatMetric(metrics.dnav) : "--" },
];

export default function LeveragePanel({ baseInputs }: LeveragePanelProps) {
  const [modifiedInputs, setModifiedInputs] = useState<DecisionInputs>(baseInputs);
  const [nudgeVariable, setNudgeVariable] = useState<LeverageVariable>("impact");
  const [nudgeStep, setNudgeStep] = useState<"1" | "-1">("1");

  useEffect(() => {
    setModifiedInputs(baseInputs);
  }, [
    baseInputs.impact,
    baseInputs.cost,
    baseInputs.risk,
    baseInputs.urgency,
    baseInputs.confidence,
  ]);

  const canCompute = isDecisionComplete(baseInputs) && isDecisionComplete(modifiedInputs);
  const leverageData = useMemo(() => {
    if (!canCompute) return null;
    return computeLeverage(baseInputs, modifiedInputs);
  }, [
    baseInputs,
    modifiedInputs,
    canCompute,
  ]);

  const rows = leverageData?.rows ?? [];
  const baseMetrics = leverageData?.baseMetrics ?? null;
  const modifiedMetrics = leverageData?.modifiedMetrics ?? null;
  const hasChanges = rows.some((row) => row.deltaInput !== 0);

  const handleReset = () => {
    setModifiedInputs(baseInputs);
  };

  const handleNudge = () => {
    const step = Number(nudgeStep) as 1 | -1;
    setModifiedInputs((prev) => ({
      ...prev,
      [nudgeVariable]: clampVariable(prev[nudgeVariable] + step),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Baseline</p>
            <CardTitle className="text-base font-semibold">Baseline judgment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Decision inputs
              </h4>
              <div className="space-y-3">
                {variableOptions.map((option) => (
                  <SliderRow
                    key={`baseline-${option.value}`}
                    id={`baseline-${option.value}`}
                    label={option.label}
                    hint={option.hint}
                    value={baseInputs[option.value]}
                    onChange={() => undefined}
                    disabled
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outputs</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {buildMetricsSummary(baseMetrics).map((metric) => (
                  <div key={`baseline-${metric.label}`}>
                    <div className="text-[11px] uppercase text-muted-foreground">{metric.label}</div>
                    <div className="font-semibold text-foreground">{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <LeverageLedger rows={rows} hasChanges={hasChanges} isReady={canCompute} />

        <Card>
          <CardHeader className="pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Modified</p>
            <CardTitle className="text-base font-semibold">Modified judgment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Decision inputs
              </h4>
              <div className="space-y-3">
                {variableOptions.map((option) => {
                  const isChanged = modifiedInputs[option.value] !== baseInputs[option.value];
                  return (
                    <SliderRow
                      key={`modified-${option.value}`}
                      id={`modified-${option.value}`}
                      label={option.label}
                      hint={option.hint}
                      value={modifiedInputs[option.value]}
                      onChange={(value) =>
                        setModifiedInputs((prev) => ({
                          ...prev,
                          [option.value]: value,
                        }))
                      }
                      className={
                        isChanged
                          ? "rounded-lg bg-primary/5 px-2 py-2 ring-1 ring-primary/30"
                          : "rounded-lg px-2 py-2"
                      }
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset modified to baseline
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={nudgeVariable} onValueChange={(value) => setNudgeVariable(value as LeverageVariable)}>
                  <SelectTrigger size="sm" className="min-w-[140px]">
                    <SelectValue placeholder="Variable" />
                  </SelectTrigger>
                  <SelectContent>
                    {variableOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={nudgeStep} onValueChange={(value) => setNudgeStep(value as "1" | "-1")}>
                  <SelectTrigger size="sm" className="min-w-[90px]">
                    <SelectValue placeholder="Step" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">+1</SelectItem>
                    <SelectItem value="-1">-1</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleNudge}>
                  Test nudge
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outputs</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {buildMetricsSummary(modifiedMetrics).map((metric) => (
                  <div key={`modified-${metric.label}`}>
                    <div className="text-[11px] uppercase text-muted-foreground">{metric.label}</div>
                    <div className="font-semibold text-foreground">{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <LeverageInsight
        baseInputs={baseInputs}
        baseMetrics={baseMetrics ?? { return: 0, pressure: 0, stability: 0, dnav: 0 }}
        modifiedMetrics={modifiedMetrics ?? { return: 0, pressure: 0, stability: 0, dnav: 0 }}
        rows={rows}
        insightOverride={
          canCompute ? undefined : "Complete all baseline and modified inputs to calculate leverage."
        }
      />

      <details className="rounded-lg border border-border/60 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          How Leverage is calculated
        </summary>
        <p className="mt-2 text-sm text-muted-foreground">
          We hold the baseline inputs constant and apply each modified input one at a time using the
          same D-NAV engine. Each row shows the marginal change in D-NAV, ranked by absolute impact
          to surface where judgment has leverage in this context.
        </p>
      </details>

      {!canCompute && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Complete all baseline and modified inputs to calculate leverage.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
