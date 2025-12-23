"use client";

import { Info, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { InfoTooltip } from "@/components/InfoTooltip";
import LeveragePanel from "@/components/LeveragePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DecisionEntry,
  DecisionMetrics,
  DecisionVariables,
  computeMetrics,
} from "@/lib/calculations";
import { loadLog } from "@/lib/storage";
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
  isEdited: boolean;
  source: "baseline" | "log";
}

const clampVariable = (value: number) => Math.min(10, Math.max(1, Number.isFinite(value) ? value : 1));

const formatValue = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));

const formatSigned = (value: number) => {
  if (value === 0) return "0";
  const prefix = value > 0 ? "+" : "-";
  return `${prefix}${formatValue(Math.abs(value))}`;
};

const MetricLabel = ({ term, label }: { term: string; label: string }) => (
  <InfoTooltip term={term}>
    <span className="inline-flex items-center gap-1 text-[11px] uppercase text-muted-foreground cursor-help">
      {label}
      <Info className="h-3 w-3" />
    </span>
  </InfoTooltip>
);

const DeltaPill = ({
  label,
  value,
  tooltipTerm,
}: {
  label: string;
  value: number;
  tooltipTerm?: string;
}) => {
  const color = value > 0 ? "text-emerald-600" : value < 0 ? "text-rose-600" : "text-muted-foreground";

  return (
    <div className="flex flex-col rounded-md border bg-muted/30 px-3 py-2">
      {tooltipTerm ? (
        <InfoTooltip term={tooltipTerm}>
          <span className="inline-flex items-center gap-1 text-[11px] uppercase text-muted-foreground cursor-help">
            {label}
            <Info className="h-3 w-3" />
          </span>
        </InfoTooltip>
      ) : (
        <span className="text-[11px] uppercase text-muted-foreground">{label}</span>
      )}
      <span className={`text-sm font-semibold ${color}`}>{formatSigned(value)}</span>
    </div>
  );
};

const getBestNudge = (base: DecisionVariables, scenario: DecisionVariables) => {
  const baseDnav = computeMetrics(base).dnav;
  const keys = Object.keys(base) as Array<keyof DecisionVariables>;
  let best = {
    key: keys[0],
    direction: 1 as 1 | -1,
    delta: -Infinity,
    newDnav: baseDnav,
  };

  keys.forEach((key) => {
    ([-1, 1] as const).forEach((direction) => {
      const nextValue = clampVariable(scenario[key] + direction);
      if (nextValue === scenario[key]) return;
      const trial = { ...scenario, [key]: nextValue } as DecisionVariables;
      const trialDnav = computeMetrics(trial).dnav;
      const delta = trialDnav - baseDnav;
      if (delta > best.delta) {
        best = { key, direction, delta, newDnav: trialDnav };
      }
    });
  });

  if (best.delta === -Infinity) {
    return { ...best, delta: 0, newDnav: baseDnav };
  }

  return best;
};

const labelForKey = (key: keyof DecisionVariables) =>
  ({
    impact: "Impact",
    cost: "Cost",
    risk: "Risk",
    urgency: "Urgency",
    confidence: "Confidence",
  })[key];

export default function CompareSheet({
  open,
  onOpenChange,
  baseVariables,
  baseMetrics,
}: CompareSheetProps) {
  const [scenarios, setScenarios] = useState<ScenarioConfig[]>([]);
  const [historyResetKey, setHistoryResetKey] = useState(0);
  const counter = useRef(1);
  const history = useMemo(() => (open ? loadLog() : []), [open]);

  useEffect(() => {
    if (!open || scenarios.length > 0) return;
    const nextId = counter.current++;
    setScenarios([
      {
        id: `scenario-${nextId}`,
        name: `Scenario ${nextId}`,
        variables: { ...baseVariables },
        isEdited: false,
        source: "baseline",
      },
    ]);
  }, [open, scenarios.length, baseVariables]);

  useEffect(() => {
    setScenarios((prev) =>
      prev.map((scenario) => {
        if (scenario.source !== "baseline" || scenario.isEdited) return scenario;
        return { ...scenario, variables: { ...baseVariables } };
      })
    );
    // Rebase only untouched baseline-derived scenarios when the main calculator changes.
  }, [baseVariables]);

  const addScenario = () => {
    const nextId = counter.current++;
    setScenarios((prev) => [
      ...prev,
      {
        id: `scenario-${nextId}`,
        name: `Scenario ${nextId}`,
        variables: { ...baseVariables },
        isEdited: false,
        source: "baseline",
      },
    ]);
  };

  const addScenarioFromDecision = (decision: DecisionEntry) => {
    const nextId = counter.current++;
    setScenarios((prev) => [
      ...prev,
      {
        id: `scenario-${nextId}`,
        name: decision.name || `Logged decision ${nextId}`,
        variables: {
          impact: clampVariable(decision.impact),
          cost: clampVariable(decision.cost),
          risk: clampVariable(decision.risk),
          urgency: clampVariable(decision.urgency),
          confidence: clampVariable(decision.confidence),
        },
        isEdited: true,
        source: "log",
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
          : scenario
      )
    );
  };

  const updateScenarioVariable = (id: string, key: keyof DecisionVariables, value: number) => {
    setScenarios((prev) =>
      prev.map((scenario) => {
        if (scenario.id !== id) return scenario;

        const updatedVariables = {
          ...scenario.variables,
          [key]: value,
        };

        return {
          ...scenario,
          isEdited: true,
          variables: updatedVariables,
        };
      })
    );
  };

  const handleAddScenarioFromHistory = (timestamp: string) => {
    const decision = history.find((entry) => entry.ts.toString() === timestamp);
    if (!decision) return;
    addScenarioFromDecision(decision);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto px-6 sm:max-w-[92vw] sm:px-8 lg:max-w-[88vw] lg:px-10 xl:max-w-[80vw]"
      >
        <SheetHeader>
          <SheetTitle>Judgment Lab</SheetTitle>
          <SheetDescription>
            Use your base decision as a baseline, then run controlled nudges to see what actually
            moves Return, Pressure, and Stability.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(280px,1fr)_minmax(360px,1.2fr)]">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Base decision</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Snapshot of the current calculator sliders (read-only).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Decision variables
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {(
                      [
                        ["Impact", baseVariables.impact],
                        ["Cost", baseVariables.cost],
                        ["Risk", baseVariables.risk],
                        ["Urgency", baseVariables.urgency],
                        ["Confidence", baseVariables.confidence],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="rounded-lg border bg-muted/30 px-3 py-2">
                        <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
                        <div className="text-sm font-semibold text-foreground">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <MetricLabel term="Return" label="Return" />
                      <div className="font-semibold text-foreground">{baseMetrics.return}</div>
                    </div>
                    <div>
                      <MetricLabel term="Pressure" label="Pressure" />
                      <div className="font-semibold text-foreground">{baseMetrics.pressure}</div>
                    </div>
                    <div>
                      <MetricLabel term="Stability" label="Stability" />
                      <div className="font-semibold text-foreground">{baseMetrics.stability}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-muted-foreground">Energy</div>
                      <div className="font-semibold text-foreground">{baseMetrics.energy}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-muted-foreground">D-NAV</div>
                      <div className="font-semibold text-foreground">{baseMetrics.dnav}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-muted-foreground">Merit</div>
                      <div className="font-semibold text-foreground">{baseMetrics.merit}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <LeveragePanel baseInputs={baseVariables} />

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Scenarios
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Explore how controlled nudges change D-NAV, return, pressure, and stability.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {history.length > 0 && (
                    <Select
                      key={historyResetKey}
                      onValueChange={(value) => {
                        handleAddScenarioFromHistory(value);
                        setHistoryResetKey((prev) => prev + 1);
                      }}
                    >
                      <SelectTrigger size="sm" className="min-w-[180px]">
                        <SelectValue placeholder="Add from log" />
                      </SelectTrigger>
                      <SelectContent>
                        {history.map((entry) => {
                          const date = new Date(entry.ts);
                          return (
                            <SelectItem key={entry.ts} value={entry.ts.toString()}>
                              <span className="flex flex-col text-left">
                                <span className="font-medium">{entry.name || "Untitled decision"}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {date.toLocaleDateString()} • D-NAV {entry.dnav}
                                </span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  <Button onClick={addScenario} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add scenario
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {scenarios.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      No scenarios yet. Click <strong>Add scenario</strong> to start exploring alternatives.
                    </CardContent>
                  </Card>
                ) : (
                  scenarios.map((scenario) => {
                    const { id, name, variables } = scenario;
                    const scenarioMetrics = computeMetrics(variables);
                    const scenarioTitle = name.trim() || "This scenario";
                    const nudge = getBestNudge(baseVariables, variables);

                    return (
                      <Card key={id} className="border">
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
                        <CardContent className="space-y-5">
                          <div className="flex flex-wrap gap-2">
                            <DeltaPill label="ΔD-NAV" value={scenarioMetrics.dnav - baseMetrics.dnav} />
                            <DeltaPill
                              label="ΔReturn"
                              value={scenarioMetrics.return - baseMetrics.return}
                              tooltipTerm="Return"
                            />
                            <DeltaPill
                              label="ΔPressure"
                              value={scenarioMetrics.pressure - baseMetrics.pressure}
                              tooltipTerm="Pressure"
                            />
                            <DeltaPill
                              label="ΔStability"
                              value={scenarioMetrics.stability - baseMetrics.stability}
                              tooltipTerm="Stability"
                            />
                            <DeltaPill
                              label="ΔEnergy"
                              value={scenarioMetrics.energy - baseMetrics.energy}
                            />
                          </div>

                          <div className="text-sm text-muted-foreground">
                            <strong className="text-foreground">Smallest nudge:</strong>{" "}
                            {nudge.delta <= 0
                              ? "No single +/-1 change improves D-NAV vs the base decision."
                              : `${labelForKey(nudge.key)} ${nudge.direction > 0 ? "+1" : "-1"} → ${formatSigned(
                                  nudge.delta
                                )} D-NAV (to ${formatValue(nudge.newDnav)}) vs base`}
                          </div>

                          <Separator />

                          <div className="space-y-2">
                            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Adjust variables
                            </h4>
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
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
