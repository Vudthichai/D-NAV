"use client";

import React from "react";
import type { CompareResult, VelocityResult } from "@/lib/compare/types";

interface SystemComparePanelProps {
  result: CompareResult;
  warning?: string;
}

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({ result, warning }) => {
  const { cohortA, cohortB, deltas, narrative, velocity, developerDetails } = result;

  const metrics = [
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
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Results</h2>
          <p className="text-xs text-muted-foreground">
            {cohortA.timeframeLabel} · {cohortB.timeframeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-3 py-1 uppercase tracking-wide">{result.mode}</span>
          <span>
            {cohortA.label} vs {cohortB.label}
          </span>
        </div>
      </div>

      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {warning}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border bg-muted/40 p-4">
            <h3 className="mb-2 text-sm font-semibold">{metric.label}</h3>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{formatValue(metric.a)} · {cohortA.label}</span>
              <span>{formatValue(metric.b)} · {cohortB.label}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">Δ A→B: {formatDelta(metric.delta)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Posture</p>
        <p className="mt-1 text-sm text-muted-foreground">{narrative}</p>
      </div>

      {velocity && (
        <div className="grid gap-4 lg:grid-cols-3">
          <VelocityCard label={`Velocity — ${cohortA.label}`} result={velocity.a} />
          <VelocityCard label={`Velocity — ${cohortB.label}`} result={velocity.b} />
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Punchline</p>
            <p className="mt-1 text-sm text-muted-foreground">{velocity.punchline}</p>
          </div>
        </div>
      )}

      {developerDetails && (
        <details className="rounded-xl border bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm font-semibold">Developer details</summary>
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            <ExplainabilityRow label="Layer 1 · Raw Inputs" value={developerDetails.layer1Raw} />
            <ExplainabilityRow label="Layer 2 · Thresholds" value={developerDetails.layer2Thresholds} />
            <ExplainabilityRow label="Layer 3 · Intermediates" value={developerDetails.layer3Intermediates} />
            <ExplainabilityRow label="Layer 4 · Punchline" value={developerDetails.layer4Punchline} />
          </div>
        </details>
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
          <p className="text-xs text-muted-foreground">Windowed velocity</p>
        </div>
        <span className="text-xs text-muted-foreground">{result.windowsEvaluated} windows</span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {result.targetReached && result.decisionsToTarget ? (
          <p className="text-sm font-semibold text-foreground">Reached after {result.decisionsToTarget} decisions</p>
        ) : (
          <p className="text-sm font-semibold text-foreground">Target not reached</p>
        )}
        {result.reason && <p className="text-xs text-muted-foreground">{result.reason}</p>}
      </div>
    </div>
  );
}

function ExplainabilityRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
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
