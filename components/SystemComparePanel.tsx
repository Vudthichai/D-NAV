"use client";

import React from "react";
import type { CompareResult, VelocityResult } from "@/lib/compare/types";

interface SystemComparePanelProps {
  result: CompareResult;
  warning?: string;
  showDebug?: boolean;
}

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({ result, warning, showDebug }) => {
  const { cohortA, cohortB, deltas, narrative, velocity, driverDeltas, consistency, topDrivers } = result;

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

  const driverMetrics = [
    { label: "Impact", delta: driverDeltas.impact },
    { label: "Cost", delta: driverDeltas.cost },
    { label: "Risk", delta: driverDeltas.risk },
    { label: "Urgency", delta: driverDeltas.urgency },
    { label: "Confidence", delta: driverDeltas.confidence },
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

      <details className="rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Advanced details
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{cohortA.label}</p>
            <p className="text-xs text-muted-foreground">Decisions: {cohortA.totalDecisions}</p>
            <p className="text-xs text-muted-foreground">Normalization: {cohortA.normalizationBasis}</p>
            <p className="text-xs text-muted-foreground">Timeframe: {cohortA.timeframeLabel}</p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{cohortB.label}</p>
            <p className="text-xs text-muted-foreground">Decisions: {cohortB.totalDecisions}</p>
            <p className="text-xs text-muted-foreground">Normalization: {cohortB.normalizationBasis}</p>
            <p className="text-xs text-muted-foreground">Timeframe: {cohortB.timeframeLabel}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Mode summary: {result.modeSummary}</p>
      </details>

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

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-muted/40 p-4">
          <h3 className="mb-2 text-sm font-semibold">Consistency (std dev)</h3>
          <p className="text-xs text-muted-foreground">Lower values mean steadier outcomes in the timeframe.</p>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{cohortA.label}</span>
              <span>
                R {formatValue(consistency.cohortAStd.return)} · P {formatValue(consistency.cohortAStd.pressure)} · S {" "}
                {formatValue(consistency.cohortAStd.stability)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{cohortB.label}</span>
              <span>
                R {formatValue(consistency.cohortBStd.return)} · P {formatValue(consistency.cohortBStd.pressure)} · S {" "}
                {formatValue(consistency.cohortBStd.stability)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/40 p-4 md:col-span-2">
          <h3 className="mb-1 text-sm font-semibold">Drivers (A → B)</h3>
          <p className="text-xs text-muted-foreground">Comparing averages for Impact, Cost, Risk, Urgency, Confidence.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {driverMetrics.map((driver) => (
              <div key={driver.label} className="rounded-lg border border-dashed bg-background/60 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{driver.label}</span>
                  <span className="text-muted-foreground">Δ {formatDelta(driver.delta)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {describeDriverShift(driver.label, driver.delta, cohortA.label, cohortB.label)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Posture</p>
        <p className="mt-1 text-sm text-muted-foreground">{narrative}</p>
        {topDrivers.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Top drivers: {topDrivers.slice(0, 2).join(" · ")}</p>
        )}
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

      {showDebug && result.developerDetails && (
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Developer details (debug)</p>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-3 text-[11px] text-muted-foreground">
            {JSON.stringify(result.developerDetails, null, 2)}
          </pre>
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
          <p className="text-xs text-muted-foreground">Windowed velocity</p>
        </div>
        <span className="text-xs text-muted-foreground">{result.windowsEvaluated} windows</span>
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {result.targetReached && result.decisionsToTarget ? (
          <p className="text-sm font-semibold text-foreground">
            Reached after {result.decisionsToTarget} decisions (first time the target rule holds for {result.consecutiveWindows} windows).
          </p>
        ) : (
          <p className="text-sm font-semibold text-foreground">Target not reached in this timeframe (based on current rule).</p>
        )}
        <p className="text-xs text-muted-foreground">What this means: {describeVelocityRule(result)}</p>
        {result.reason && <p className="text-xs text-muted-foreground">{result.reason}</p>}
      </div>
      <details className="mt-3 rounded-lg border bg-background/60 p-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Show details
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Window size: {result.windowSize} · Consecutive windows: {result.consecutiveWindows}
          </p>
          <div className="rounded-md border bg-muted/30 p-2">
            <p className="text-[11px] font-semibold text-foreground">Thresholds</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
              <li>Return lift: {result.thresholds.returnLift.toFixed(1)}</li>
              <li>Pressure band: ±{result.thresholds.pressureBand.toFixed(1)}</li>
              <li>Stability floor: {result.thresholds.stabilityFloor.toFixed(1)}</li>
              <li>Stability band: ±{result.thresholds.stabilityBand.toFixed(1)}</li>
            </ul>
          </div>
          {result.explainability?.layer4Punchline && (
            <div className="rounded-md border bg-muted/30 p-2">
              <p className="text-[11px] font-semibold text-foreground">Advanced details</p>
              <p className="text-[11px] text-muted-foreground">{result.explainability.layer4Punchline}</p>
            </div>
          )}
        </div>
      </details>
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

function describeDriverShift(label: string, delta: number, cohortALabel: string, cohortBLabel: string) {
  if (Math.abs(delta) < 0.05) return `${label} is similar across both.`;
  return delta > 0
    ? `${cohortBLabel} shows higher ${label.toLowerCase()} than ${cohortALabel}.`
    : `${cohortBLabel} shows lower ${label.toLowerCase()} than ${cohortALabel}.`;
}

function describeVelocityRule(result: VelocityResult) {
  const { thresholds, windowSize, consecutiveWindows } = result;
  if (result.target === "RETURN_RISE") {
    return `Target reached when the rolling return over the last ${windowSize} decisions is ≥ ${thresholds.returnLift.toFixed(1)} for ${consecutiveWindows} consecutive windows.`;
  }
  if (result.target === "PRESSURE_STABILIZE") {
    return `Target reached when the rolling pressure over the last ${windowSize} decisions stays within ±${thresholds.pressureBand.toFixed(1)} and stability is at least ${thresholds.stabilityFloor.toFixed(1)} for ${consecutiveWindows} consecutive windows.`;
  }
  return `Target reached when the rolling stability over the last ${windowSize} decisions stays within ±${thresholds.stabilityBand.toFixed(1)} and above ${thresholds.stabilityFloor.toFixed(1)} for ${consecutiveWindows} consecutive windows.`;
}
