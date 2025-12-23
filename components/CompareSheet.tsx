"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import ComparePanel from "@/components/ComparePanel";
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
import { DecisionEntry, DecisionMetrics, DecisionVariables, LeverageKey } from "@/lib/calculations";
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
}

const clampVariable = (value: number) => Math.min(10, Math.max(1, Number.isFinite(value) ? value : 1));

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

  const baseSummary = useMemo(() => {
    return {
      return: baseMetrics.return,
      stability: baseMetrics.stability,
      pressure: baseMetrics.pressure,
      merit: baseMetrics.merit,
      energy: baseMetrics.energy,
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

  const updateScenarioVariable = (id: string, key: LeverageKey, value: number) => {
    setScenarios((prev) =>
      prev.map((scenario) => {
        if (scenario.id !== id) return scenario;
        if (key === "interaction") return scenario;

        const updatedVariables = {
          ...scenario.variables,
          [key]: value,
        };

        return {
          ...scenario,
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
          <SheetTitle>Compare Scenarios</SheetTitle>
          <SheetDescription>
            Use your current decision as the base line, then explore alternative scenarios to see
            how return, stability, and pressure shift.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Scenarios
              </h3>
              <p className="text-sm text-muted-foreground">
                Add a scenario to adjust variables and compare the resulting metrics side-by-side.
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

          <div className="overflow-x-auto">
            <div className="flex items-start gap-4 pb-4">
              <Card className="w-[1000px] shrink-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Base decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Decision variables
                    </h4>
                    <div className="flex flex-nowrap gap-4 overflow-x-auto text-sm">
                      <div className="w-[96px]">
                        <div className="text-[11px] uppercase text-muted-foreground">Impact</div>
                        <div className="font-semibold text-foreground">{baseVariables.impact}</div>
                      </div>
                      <div className="w-[96px]">
                        <div className="text-[11px] uppercase text-muted-foreground">Cost</div>
                        <div className="font-semibold text-foreground">{baseVariables.cost}</div>
                      </div>
                      <div className="w-[96px]">
                        <div className="text-[11px] uppercase text-muted-foreground">Risk</div>
                        <div className="font-semibold text-foreground">{baseVariables.risk}</div>
                      </div>
                      <div className="w-[96px]">
                        <div className="text-[11px] uppercase text-muted-foreground">Urgency</div>
                        <div className="font-semibold text-foreground">{baseVariables.urgency}</div>
                      </div>
                      <div className="w-[110px]">
                        <div className="text-[11px] uppercase text-muted-foreground">
                          Confidence
                        </div>
                        <div className="font-semibold text-foreground">
                          {baseVariables.confidence}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Metrics
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
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
                        <div className="text-[11px] uppercase text-muted-foreground">Merit</div>
                        <div className="font-semibold text-foreground">{baseSummary.merit}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Energy</div>
                        <div className="font-semibold text-foreground">{baseSummary.energy}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">D-NAV</div>
                        <div className="font-semibold text-foreground">{baseSummary.dnav}</div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    These values reflect the sliders from the calculator. Use them as the baseline
                    when crafting scenarios.
                  </p>
                </CardContent>
              </Card>

              {scenarios.length === 0 ? (
                <Card className="w-[480px] shrink-0 border-dashed">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    No scenarios yet. Click <strong>Add scenario</strong> to start exploring
                    alternatives.
                  </CardContent>
                </Card>
              ) : (
                scenarios.map((scenario) => {
                  const { id, name, variables } = scenario;
                  const scenarioTitle = name.trim() || "This scenario";

                  return (
                    <Card key={id} className="w-[480px] shrink-0">
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
                        <ComparePanel base={baseVariables} scenario={variables} title={scenarioTitle} />

                        <Separator />

                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase">
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
      </SheetContent>
    </Sheet>
  );
}
