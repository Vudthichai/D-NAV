"use client";

import React from "react";
import type { CompareResult } from "@/lib/compare/types";

interface SystemComparePanelProps {
  result: CompareResult;
}

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({ result }) => {
  const { cohortA, cohortB, deltas, postureLine } = result;

  return (
    <section className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Compare</h2>
          <p className="text-sm text-muted-foreground">
            A: {cohortA.label} · B: {cohortB.label}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Shared timeframe: {cohortA.timeframeLabel}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Average Return (R)",
            a: cohortA.avgReturn,
            b: cohortB.avgReturn,
            delta: deltas.returnDelta,
          },
          {
            label: "Average Pressure (P)",
            a: cohortA.avgPressure,
            b: cohortB.avgPressure,
            delta: deltas.pressureDelta,
          },
          {
            label: "Average Stability (S)",
            a: cohortA.avgStability,
            b: cohortB.avgStability,
            delta: deltas.stabilityDelta,
          },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border bg-muted/40 p-4">
            <h3 className="mb-2 text-sm font-semibold">{metric.label}</h3>
            <p className="text-xs text-muted-foreground">A: {formatValue(metric.a)}</p>
            <p className="text-xs text-muted-foreground">B: {formatValue(metric.b)}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Δ A→B: {formatDelta(metric.delta)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <h3 className="mb-2 text-sm font-semibold">Posture</h3>
        <p className="text-sm text-muted-foreground">{postureLine}</p>
      </div>
    </section>
  );
};

export default SystemComparePanel;

function formatValue(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatDelta(value: number) {
  if (Math.abs(value) < 0.05) return "0";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value)}`;
}
