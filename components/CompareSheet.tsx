"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { computeMetrics, DecisionMetrics, DecisionVariables } from "@/lib/calculations";
import { cn } from "@/lib/utils";
import SliderRow from "./SliderRow";

interface CompareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseVariables: DecisionVariables;
  baseMetrics: DecisionMetrics;
}

interface ScenarioConfig {
  id: string;
  name: string;
  variables: DecisionVariables;
}

const METRIC_ROWS: { key: keyof Pick<DecisionMetrics, "return" | "stability" | "pressure">; label: string }[] = [
  { key: "return", label: "Return" },
  { key: "stability", label: "Stability" },
  { key: "pressure", label: "Pressure" },
];

function formatDelta(value: number): string {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
}

function formatList(items: string[]): string {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function buildScenarioFeedback(base: DecisionMetrics, scenario: DecisionMetrics, scenarioName: string): string {
  const returnDelta = scenario.return - base.return;
  const stabilityDelta = scenario.stability - base.stability;
  const pressureDelta = scenario.pressure - base.pressure;
  const dnavDelta = scenario.dnav - base.dnav;

  const upsides: string[] = [];
  const tradeoffs: string[] = [];

  if (returnDelta > 0) upsides.push(`higher return (${formatDelta(returnDelta)})`);
  if (stabilityDelta > 0) upsides.push(`stronger stability (${formatDelta(stabilityDelta)})`);
  if (pressureDelta < 0) upsides.push(`lower pressure (${formatDelta(pressureDelta)})`);

  if (returnDelta < 0) tradeoffs.push(`return drops (${formatDelta(returnDelta)})`);
  if (stabilityDelta < 0) tradeoffs.push(`stability weakens (${formatDelta(stabilityDelta)})`);
  if (pressureDelta > 0) tradeoffs.push(`pressure climbs (${formatDelta(pressureDelta)})`);

  const parts: string[] = [];
  if (upsides.length) parts.push(`Upsides: ${formatList(upsides)}.`);
  if (tradeoffs.length) parts.push(`Trade-offs: ${formatList(tradeoffs)}.`);

  let verdict: string;
  if (dnavDelta > 5) {
    verdict = `${scenarioName} is clearly stronger than the base decision (+${dnavDelta} D-NAV).`;
  } else if (dnavDelta > 0) {
    verdict = `${scenarioName} edges past the base decision (+${dnavDelta} D-NAV).`;
  } else if (dnavDelta === 0) {
    verdict = `${scenarioName} matches the base decision (no D-NAV change).`;
  } else if (dnavDelta >= -5) {
    verdict = `The base decision still holds a slight edge (${formatDelta(dnavDelta)} D-NAV).`;
  } else {
    verdict = `The base decision remains the better option (${formatDelta(dnavDelta)} D-NAV).`;
  }

  parts.push(verdict);

  return parts.join(" ");
}

function getDeltaBadge(delta: number, metric: "return" | "stability" | "pressure") {
  const isImprovement =
    metric === "pressure" ? delta < 0 : delta > 0;
  const badgeText =
    delta === 0
      ? "No change"
      : isImprovement
        ? `Better (${formatDelta(delta)})`
        : `Worse (${formatDelta(delta)})`;

  const badgeClass = cn(
    "px-2.5 py-1 text-xs font-semibold border",
    delta === 0 && "border-muted bg-muted/40 text-muted-foreground",
    delta !== 0 &&
      (isImprovement
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
        : "border-red-500/40 bg-red-500/10 text-red-600"),
  );

  return <Badge variant="outline" className={badgeClass}>{badgeText}</Badge>;
}

export default function CompareSheet({
  open,
  onOpenChange,
  baseVariables,
  baseMetrics,
}: CompareSheetProps) {
  const [scenarios, setScenarios] = useState<ScenarioConfig[]>([]);
  const counter = useRef(1);

  const baseSummary = useMemo(() => {
    return {
      return: baseMetrics.return,
      stability: baseMetrics.stability,
      pressure: baseMetrics.pressure,
      dnav: baseMetrics.dnav,
    };
  }, [baseMetrics]);

  const addScenario = () => {
    const nextId = counter.current++;
    setScenarios((prev) => [
      ...prev,
      {
        id: `scenario-${nextId}`,
        name: `Scenario ${nextId}`,
        variables: { ...baseVariables },
      },
    ]);
  };

  const removeScenario = (id: string) => {
    setScenarios((prev) => prev.filter((scenario) => scenario.id !== id));
  };

  const updateScenarioName = (id: string, name: string) => {
    setScenarios((prev) =>
      prev.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              name,
            }
          : scenario,
      ),
    );
  };

  const updateScenarioVariable = (
    id: string,
    key: keyof DecisionVariables,
    value: number,
  ) => {
    setScenarios((prev) =>
      prev.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              variables: {
                ...scenario.variables,
                [key]: value,
              },
            }
          : scenario,
      ),
    );
  };

  const scenariosWithMetrics = useMemo(
    () =>
      scenarios.map((scenario) => ({
        ...scenario,
        metrics: computeMetrics(scenario.variables),
      })),
    [scenarios],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-[92vw] lg:max-w-[88vw] xl:max-w-[80vw]"
      >
        <SheetHeader>
          <SheetTitle>Compare Scenarios</SheetTitle>
          <SheetDescription>
            Use your current decision as the base line, then explore alternative scenarios to see how return,
            stability, and pressure shift.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Scenarios</h3>
              <p className="text-sm text-muted-foreground">
                Add a scenario to adjust variables and compare the resulting metrics side-by-side.
              </p>
            </div>
            <Button onClick={addScenario} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add scenario
            </Button>
          </div>

          <div className="overflow-x-auto">
            <div className="flex items-start gap-4 pb-4">
              <Card className="min-w-[320px] shrink-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Base decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Decision variables
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Impact</div>
                        <div className="font-semibold text-foreground">{baseVariables.impact}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Cost</div>
                        <div className="font-semibold text-foreground">{baseVariables.cost}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Risk</div>
                        <div className="font-semibold text-foreground">{baseVariables.risk}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Urgency</div>
                        <div className="font-semibold text-foreground">{baseVariables.urgency}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Confidence</div>
                        <div className="font-semibold text-foreground">{baseVariables.confidence}</div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Metrics</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Return</div>
                        <div className="font-semibold text-foreground">{baseSummary.return}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Stability</div>
                        <div className="font-semibold text-foreground">{baseSummary.stability}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Pressure</div>
                        <div className="font-semibold text-foreground">{baseSummary.pressure}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">D-NAV</div>
                        <div className="font-semibold text-foreground">{baseSummary.dnav}</div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    These values reflect the sliders from the calculator. Use them as the baseline when crafting
                    scenarios.
                  </p>
                </CardContent>
              </Card>

              {scenariosWithMetrics.length === 0 ? (
                <Card className="min-w-[320px] shrink-0 border-dashed">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    No scenarios yet. Click <strong>Add scenario</strong> to start exploring alternatives.
                  </CardContent>
                </Card>
              ) : (
                scenariosWithMetrics.map((scenario) => {
                  const { metrics, id, name, variables } = scenario;
                  const deltas = {
                    return: metrics.return - baseMetrics.return,
                    stability: metrics.stability - baseMetrics.stability,
                    pressure: metrics.pressure - baseMetrics.pressure,
                  } as const;

                  const scenarioTitle = name.trim() || "This scenario";
                  const feedback = buildScenarioFeedback(baseMetrics, metrics, scenarioTitle);

                  return (
                    <Card key={id} className="min-w-[320px] shrink-0">
                      <CardHeader className="pb-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <CardTitle className="flex-1 text-base font-semibold">
                            <Input
                            value={name}
                            onChange={(event) => updateScenarioName(id, event.target.value)}
                            placeholder="Scenario name"
                            className="h-10"
                          />
                        </CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeScenario(id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase">Adjust variables</h4>
                          <div className="space-y-4">
                          <SliderRow
                            id={`${id}-impact`}
                            label="Impact"
                            hint="Expected benefit / upside"
                            value={variables.impact}
                            onChange={(value) => updateScenarioVariable(id, "impact", value)}
                          />
                          <SliderRow
                            id={`${id}-cost`}
                            label="Cost"
                            hint="Money, time, or effort required"
                            value={variables.cost}
                            onChange={(value) => updateScenarioVariable(id, "cost", value)}
                          />
                          <SliderRow
                            id={`${id}-risk`}
                            label="Risk"
                            hint="Downside, what could go wrong"
                            value={variables.risk}
                            onChange={(value) => updateScenarioVariable(id, "risk", value)}
                          />
                          <SliderRow
                            id={`${id}-urgency`}
                            label="Urgency"
                            hint="How soon action is needed"
                            value={variables.urgency}
                            onChange={(value) => updateScenarioVariable(id, "urgency", value)}
                          />
                          <SliderRow
                            id={`${id}-confidence`}
                            label="Confidence"
                            hint="Evidence, readiness, and conviction"
                            value={variables.confidence}
                            onChange={(value) => updateScenarioVariable(id, "confidence", value)}
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase">Metric comparison</h4>
                        <div className="overflow-hidden rounded-lg border">
                          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <span>Metric</span>
                            <span className="text-right">Base</span>
                            <span className="text-right">Scenario</span>
                            <span className="text-right">Delta</span>
                          </div>
                          {METRIC_ROWS.map(({ key, label }) => (
                            <div
                              key={key}
                              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 text-sm"
                            >
                              <span className="font-medium text-foreground">{label}</span>
                              <span className="text-right font-mono text-sm text-muted-foreground">
                                {baseMetrics[key]}
                              </span>
                              <span className="text-right font-mono text-sm text-foreground">
                                {metrics[key]}
                              </span>
                              <span className="flex justify-end">
                                {getDeltaBadge(deltas[key], key)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                        {feedback}
                      </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
