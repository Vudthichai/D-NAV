"use client";

import { Info } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";

import { InfoTooltip } from "@/components/InfoTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionVariables, LeverageRowKey, computeMetrics } from "@/lib/calculations";

interface LeveragePanelProps {
  baseInputs: DecisionVariables;
}

const variableLabels: Record<Exclude<LeverageRowKey, "interaction">, string> = {
  impact: "Impact",
  cost: "Cost",
  risk: "Risk",
  urgency: "Urgency",
  confidence: "Confidence",
};

const clampVariable = (value: number) => Math.min(10, Math.max(1, Number.isFinite(value) ? value : 1));

const formatDelta = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));

const formatSigned = (value: number) => {
  if (value === 0) return "0";
  const prefix = value > 0 ? "+" : "-";
  return `${prefix}${formatDelta(Math.abs(value))}`;
};

export default function LeveragePanel({ baseInputs }: LeveragePanelProps) {
  const [modifiedInputs, setModifiedInputs] = useState(baseInputs);

  useEffect(() => {
    startTransition(() => setModifiedInputs(baseInputs));
  }, [baseInputs]);

  const leverageRows = useMemo(() => {
    const baseDnav = computeMetrics(modifiedInputs).dnav;
    const keys = Object.keys(variableLabels) as Array<Exclude<LeverageRowKey, "interaction">>;

    return keys
      .map((key) => {
        const currentValue = modifiedInputs[key];
        let bestDelta = 0;
        let bestDirection: 1 | -1 = 1;

        ([-1, 1] as const).forEach((direction) => {
          const nextValue = clampVariable(currentValue + direction);
          if (nextValue === currentValue) return;
          const trial = { ...modifiedInputs, [key]: nextValue };
          const trialDnav = computeMetrics(trial).dnav;
          const delta = trialDnav - baseDnav;
          const isBetter = Math.abs(delta) > Math.abs(bestDelta) || (Math.abs(delta) === Math.abs(bestDelta) && delta > bestDelta);

          if (isBetter) {
            bestDelta = delta;
            bestDirection = direction;
          }
        });

        return {
          key,
          label: variableLabels[key],
          delta: bestDelta,
          direction: bestDirection,
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [modifiedInputs]);

  const topLever = leverageRows[0];
  const energyTerm = modifiedInputs.urgency * modifiedInputs.confidence;
  const interactionTone =
    modifiedInputs.urgency >= 7
      ? "Urgency multiplies the effect of Confidence in this regime — high urgency makes confidence (and lack of it) expensive."
      : modifiedInputs.urgency <= 3
      ? "Urgency dampens the effect of Confidence right now — low urgency makes confidence swings less explosive."
      : "Urgency moderates the effect of Confidence right now — higher urgency would amplify confidence swings.";

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Leverage Breakdown</CardTitle>
        <p className="text-sm text-muted-foreground">What moves the needle most right now.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {topLever ? (
          <p className="text-sm">
            A {topLever.direction > 0 ? "+1" : "-1"} shift in {topLever.label} moves D-NAV {formatSigned(topLever.delta)} at your
            current baseline.
          </p>
        ) : null}

        <div className="space-y-2">
          {leverageRows.map((row) => (
            <div key={row.key} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {row.label} {row.direction > 0 ? "+1" : "-1"}: {formatSigned(row.delta)} D-NAV
                </p>
              </div>
              <span className={`text-sm font-semibold ${row.delta > 0 ? "text-emerald-600" : row.delta < 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                {formatSigned(row.delta)}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 text-foreground">
            <InfoTooltip term="Interaction">
              <span className="inline-flex items-center gap-1 font-semibold cursor-help">
                Interaction
                <Info className="h-3 w-3 text-muted-foreground" />
              </span>
            </InfoTooltip>
            <span className="text-muted-foreground">(Urgency × Confidence)</span>
          </div>
          <p>
            Interaction contributes {formatDelta(energyTerm)} D-NAV right now. {interactionTone}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          This teaches repeatable judgment, not whether the decision is correct.
        </p>
      </CardContent>
    </Card>
  );
}
