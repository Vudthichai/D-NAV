"use client";

import React from "react";
import type { CompareResult, VelocityResult } from "@/lib/compare/types";

interface SystemComparePanelProps {
  result: CompareResult;
}

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({ result }) => {
  const { cohortA, cohortB, deltas, velocity, normalizationBasis, explainability, velocityTarget } = result;

  return (
    <section className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Compare</h2>
          <p className="text-sm text-muted-foreground">
            Mode: {result.mode} · Target: {velocityTarget}
          </p>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <VelocityCard label={`Velocity — ${cohortA.label}`} result={velocity.a} />
        <VelocityCard label={`Velocity — ${cohortB.label}`} result={velocity.b} />
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <h3 className="mb-2 text-sm font-semibold">Punchline</h3>
        <p className="text-sm text-muted-foreground">{velocity.punchline}</p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
        <ExplainabilityRow label="Layer 1 · Raw Inputs" value={JSON.stringify(explainability.layer1Raw, null, 2)} />
        <ExplainabilityRow label="Layer 2 · Thresholds" value={JSON.stringify(explainability.layer2Thresholds, null, 2)} />
        <ExplainabilityRow
          label="Layer 3 · Intermediates"
          value={JSON.stringify(explainability.layer3Intermediates, null, 2)}
        />
        <ExplainabilityRow label="Layer 4 · Punchline" value={explainability.layer4Punchline} />
      </div>
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

function ExplainabilityRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-background/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
        {value}
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
