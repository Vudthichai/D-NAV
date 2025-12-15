"use client";

import React from "react";
import type { CompareResult, VelocityResult } from "@/lib/compare/types";

interface SystemComparePanelProps {
  result: CompareResult;
}

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({ result }) => {
  const { cohortA, cohortB, deltas, velocity, normalizationBasis, summary, mode } = result;

  return (
    <section className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{mode === "temporal" ? "Temporal Compare" : "Entity Compare"}</h2>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {cohortA.timeframeLabel} · {normalizationBasis.replace("_", " ")}
        </p>
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

      {velocity && (
        <div className="space-y-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <VelocityCard label={`Velocity — ${cohortA.label}`} result={velocity.a} />
            <VelocityCard label={`Velocity — ${cohortB.label}`} result={velocity.b} />
          </div>

          <div className="rounded-xl border bg-muted/40 p-4">
            <h3 className="mb-2 text-sm font-semibold">Velocity insight</h3>
            <p className="text-sm text-muted-foreground">{velocity.punchline}</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default SystemComparePanel;

function VelocityCard({ label, result }: { label: string; result: VelocityResult }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <h3 className="text-sm font-semibold text-foreground">{result.targetLabel}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{result.windowsEvaluated} windows</span>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        {result.targetReached && result.decisionsToTarget ? (
          <p className="text-sm font-semibold text-foreground">
            Reached after {result.decisionsToTarget} decisions
          </p>
        ) : (
          <p className="text-sm font-semibold text-foreground">Target not reached</p>
        )}
        {result.reason && <p className="text-xs text-muted-foreground">{result.reason}</p>}
      </div>
    </div>
  );
}

function formatValue(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatDelta(value: number) {
  if (Math.abs(value) < 0.05) return "0";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value)}`;
}
