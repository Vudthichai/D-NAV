"use client";

import React from "react";
import type { CompareResult, VelocityResult } from "@/lib/compare/types";
import { formatUnitCount, getUnitLabels, type UnitLabels } from "@/utils/judgmentUnits";

interface SystemComparePanelProps {
  result: CompareResult;
  warning?: string;
  showDebug?: boolean;
}

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({ result, warning, showDebug }) => {
  const { cohortA, cohortB, deltas, narrative, velocity, driverDeltas, consistency, topDrivers } = result;
  const unitLabelRaw = result.judgmentUnitLabel || cohortA.judgmentUnitLabel || cohortB.judgmentUnitLabel;
  const unitLabels = getUnitLabels(unitLabelRaw);
  const compareQuestion = getCompareQuestion(result.mode);
  const summaryText = buildSummary(result, unitLabels, unitLabelRaw);
  const datasetLabelA = cohortA.datasetLabel ?? cohortA.label;
  const datasetLabelB = cohortB.datasetLabel ?? cohortB.label;

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

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Compare Thesis</p>
        <h3 className="text-sm font-semibold text-foreground">{compareQuestion}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{summaryText}</p>
      </div>

      <details className="rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Advanced details
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{cohortA.label}</p>
            <p className="text-xs text-muted-foreground">Dataset: {datasetLabelA}</p>
            <p className="text-xs text-muted-foreground">
              Decisions: {formatUnitCount(cohortA.totalDecisions, unitLabelRaw)}
              {cohortA.totalAvailableDecisions && cohortA.totalAvailableDecisions > cohortA.totalDecisions
                ? ` of ${formatUnitCount(cohortA.totalAvailableDecisions, unitLabelRaw)}`
                : ""}
            </p>
            <p className="text-xs text-muted-foreground">Normalization: {cohortA.normalizationBasis}</p>
            <p className="text-xs text-muted-foreground">
              {cohortA.timeframeMode === "sequence" ? "Sequence range" : "Timeframe"}: {cohortA.timeframeLabel}
            </p>
            {cohortA.judgmentUnitLabel && (
              <p className="text-xs text-muted-foreground">Judgment unit: {cohortA.judgmentUnitLabel}</p>
            )}
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{cohortB.label}</p>
            <p className="text-xs text-muted-foreground">Dataset: {datasetLabelB}</p>
            <p className="text-xs text-muted-foreground">
              Decisions: {formatUnitCount(cohortB.totalDecisions, unitLabelRaw)}
              {cohortB.totalAvailableDecisions && cohortB.totalAvailableDecisions > cohortB.totalDecisions
                ? ` of ${formatUnitCount(cohortB.totalAvailableDecisions, unitLabelRaw)}`
                : ""}
            </p>
            <p className="text-xs text-muted-foreground">Normalization: {cohortB.normalizationBasis}</p>
            <p className="text-xs text-muted-foreground">
              {cohortB.timeframeMode === "sequence" ? "Sequence range" : "Timeframe"}: {cohortB.timeframeLabel}
            </p>
            {cohortB.judgmentUnitLabel && (
              <p className="text-xs text-muted-foreground">Judgment unit: {cohortB.judgmentUnitLabel}</p>
            )}
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
          <p className="text-xs text-muted-foreground">
            Lower values mean the system is steadier in the selected window.
          </p>
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
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Posture narrative</p>
        <p className="mt-1 text-sm text-muted-foreground">{narrative}</p>
        {topDrivers.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Top drivers: {topDrivers.slice(0, 2).join(" · ")}</p>
        )}
      </div>

      {velocity && (
        <div className="grid gap-4 lg:grid-cols-3">
          <VelocityCard label={`Velocity — ${cohortA.label}`} result={velocity.a} unitLabels={unitLabels} unitLabelRaw={unitLabelRaw} />
          <VelocityCard label={`Velocity — ${cohortB.label}`} result={velocity.b} unitLabels={unitLabels} unitLabelRaw={unitLabelRaw} />
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

function VelocityCard({
  label,
  result,
  unitLabels,
  unitLabelRaw,
}: {
  label: string;
  result: VelocityResult;
  unitLabels: UnitLabels;
  unitLabelRaw?: string | null;
}) {
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
            Reached after {formatUnitCount(result.decisionsToTarget, unitLabelRaw)} (first time the target rule holds for {result.consecutiveWindows} windows).
          </p>
        ) : (
          <p className="text-sm font-semibold text-foreground">Target not reached in this window set (based on current rule).</p>
        )}
        <p className="text-xs text-muted-foreground">What this means: {describeVelocityRule(result, unitLabels)}</p>
        {result.reason && <p className="text-xs text-muted-foreground">{result.reason}</p>}
      </div>
      <details className="mt-3 rounded-lg border bg-background/60 p-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Show details
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Window size: {result.windowSize} {unitLabels.plural} · Consecutive windows: {result.consecutiveWindows}
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

function describeVelocityRule(result: VelocityResult, unitLabels: UnitLabels) {
  const { thresholds, windowSize, consecutiveWindows } = result;
  if (result.target === "RETURN_RISE") {
    return `Target reached when the rolling return over the last ${windowSize} ${unitLabels.plural} is ≥ ${thresholds.returnLift.toFixed(1)} for ${consecutiveWindows} consecutive windows.`;
  }
  if (result.target === "PRESSURE_STABILIZE") {
    return `Target reached when the rolling pressure over the last ${windowSize} ${unitLabels.plural} stays within ±${thresholds.pressureBand.toFixed(1)} and stability is at least ${thresholds.stabilityFloor.toFixed(1)} for ${consecutiveWindows} consecutive windows.`;
  }
  return `Target reached when the rolling stability over the last ${windowSize} ${unitLabels.plural} stays within ±${thresholds.stabilityBand.toFixed(1)} and above ${thresholds.stabilityFloor.toFixed(1)} for ${consecutiveWindows} consecutive windows.`;
}

function getCompareQuestion(mode: CompareResult["mode"]) {
  if (mode === "temporal") return "What’s different?";
  if (mode === "velocity") return "How fast do meaningful patterns form?";
  return "What kind of judgment system is this?";
}

function buildSummary(result: CompareResult, unitLabels: UnitLabels, unitLabelRaw?: string | null) {
  if (result.mode === "velocity" && result.velocity) {
    return summarizeVelocity(
      result.velocity.a,
      result.velocity.b,
      unitLabels,
      result.cohortA.label,
      result.cohortB.label,
      unitLabelRaw,
    );
  }
  if (result.mode === "temporal") {
    return summarizeTemporal(result, unitLabels, unitLabelRaw);
  }
  return summarizeEntity(result);
}

function summarizeEntity(result: CompareResult) {
  const { cohortA, cohortB, deltas, topDrivers } = result;
  const deltasList = [
    { label: "Return", value: deltas.returnDelta },
    { label: "Pressure", value: deltas.pressureDelta },
    { label: "Stability", value: deltas.stabilityDelta },
  ];
  const meaningful = deltasList
    .map((item) => ({ ...item, magnitude: Math.abs(item.value) }))
    .filter((item) => item.magnitude >= 0.05)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 2)
    .map((item) => {
      const leader = item.value > 0 ? cohortB.label : cohortA.label;
      const trailer = leader === cohortA.label ? cohortB.label : cohortA.label;
      return `${leader} leads on ${item.label.toLowerCase()} (${formatDelta(Math.abs(item.value))} vs ${trailer}).`;
    });

  const driverText = topDrivers.length > 0 ? `Drivers: ${topDrivers.slice(0, 2).join(" · ")}.` : "";
  return [meaningful.join(" "), driverText].filter(Boolean).join(" ");
}

function summarizeTemporal(result: CompareResult, unitLabels: UnitLabels, unitLabelRaw?: string | null) {
  const { deltas, cohortA, cohortB } = result;
  const magnitudes = [Math.abs(deltas.returnDelta), Math.abs(deltas.pressureDelta), Math.abs(deltas.stabilityDelta)];
  const maxDelta = Math.max(...magnitudes);
  if (maxDelta < 0.05) {
    return "Periods A and B are structurally unchanged across R/P/S.";
  }

  const shifts: string[] = [];
  if (Math.abs(deltas.returnDelta) >= 0.05) {
    const leader = deltas.returnDelta > 0 ? cohortB.label : cohortA.label;
    shifts.push(`${leader} is ahead on return (${formatDelta(Math.abs(deltas.returnDelta))}).`);
  }
  if (Math.abs(deltas.pressureDelta) >= 0.05) {
    const hotter = deltas.pressureDelta > 0 ? cohortB.label : cohortA.label;
    shifts.push(`${hotter} carries more pressure (${formatDelta(Math.abs(deltas.pressureDelta))}).`);
  }
  if (Math.abs(deltas.stabilityDelta) >= 0.05) {
    const steadier = deltas.stabilityDelta > 0 ? cohortB.label : cohortA.label;
    shifts.push(`${steadier} is steadier (${formatDelta(Math.abs(deltas.stabilityDelta))}).`);
  }

  const windowNote = `${cohortA.timeframeLabel} vs ${cohortB.timeframeLabel} (${formatUnitCount(cohortA.totalDecisions, unitLabelRaw)} vs ${formatUnitCount(cohortB.totalDecisions, unitLabelRaw)}).`;
  return `${shifts.join(" ")} ${windowNote}`.trim();
}

function summarizeVelocity(
  a: VelocityResult,
  b: VelocityResult,
  unitLabels: UnitLabels,
  labelA: string,
  labelB: string,
  unitLabelRaw?: string | null,
) {
  if (!a.decisionsToTarget && !b.decisionsToTarget) {
    return "Neither cohort reached the target in the observed range.";
  }
  if (a.decisionsToTarget && !b.decisionsToTarget) {
    return `${labelA} reached the target in ${formatUnitCount(a.decisionsToTarget, unitLabelRaw)}; ${labelB} has not reached the target.`;
  }
  if (!a.decisionsToTarget && b.decisionsToTarget) {
    return `${labelB} reached the target in ${formatUnitCount(b.decisionsToTarget, unitLabelRaw)}; ${labelA} has not reached the target.`;
  }

  const fasterIsA = (a.decisionsToTarget ?? Infinity) < (b.decisionsToTarget ?? Infinity);
  const fasterLabel = fasterIsA ? labelA : labelB;
  const slowerLabel = fasterIsA ? labelB : labelA;
  const fasterCount = fasterIsA ? a.decisionsToTarget ?? 0 : b.decisionsToTarget ?? 0;
  const slowerCount = fasterIsA ? b.decisionsToTarget ?? 0 : a.decisionsToTarget ?? 0;
  const multiplier = slowerCount && fasterCount ? (slowerCount / Math.max(1, fasterCount)).toFixed(1) : "1.0";
  return `${fasterLabel} reached the target in ${formatUnitCount(fasterCount, unitLabelRaw)}; ${slowerLabel} needed ${formatUnitCount(slowerCount, unitLabelRaw)} (${multiplier}× difference).`;
}
