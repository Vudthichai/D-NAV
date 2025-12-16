"use client";

import React from "react";
import type { CompareResult, VelocityResult } from "@/lib/compare/types";
import { type DatasetMeta } from "@/types/dataset";

interface SystemComparePanelProps {
  result: CompareResult;
  warning?: string;
  showDebug?: boolean;
  datasetAMeta?: DatasetMeta | null;
  datasetBMeta?: DatasetMeta | null;
}

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({
  result,
  warning,
  showDebug,
  datasetAMeta,
  datasetBMeta,
}) => {
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

      <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What we're analyzing</p>
        <div className="mt-1 flex flex-col gap-1">
          <p className="text-sm text-foreground">
            {renderJudgmentUnitLine(datasetAMeta, datasetBMeta)}
          </p>
          {renderContextNote(datasetAMeta, datasetBMeta)}
        </div>
      </div>

      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {warning}
        </div>
      )}

      <GuidingQuestions result={result} />

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

function GuidingQuestions({ result }: { result: CompareResult }) {
  const { cohortA, cohortB, consistency, driverDeltas, velocity } = result;
  const steadier = determineSteadier(cohortA, cohortB, consistency);
  const aggressor = determineAggressor(cohortA, cohortB, driverDeltas);
  const learner = describeLearning(velocity, cohortA.label, cohortB.label);
  const pressure = describePressure(cohortA, cohortB);
  const recovery = describeRecovery();

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Guiding Questions</p>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {[steadier, aggressor, learner, pressure, recovery].map((item) => (
          <div key={item.question} className="rounded-lg border bg-background/60 p-3 text-sm">
            <p className="font-semibold text-foreground">{item.question}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderJudgmentUnitLine(metaA?: DatasetMeta | null, metaB?: DatasetMeta | null) {
  const unitA = metaA?.judgmentUnit?.trim();
  const unitB = metaB?.judgmentUnit?.trim();

  if (unitA && unitB) {
    if (unitA === unitB) return `Judgment Unit: ${unitA}`;
    return `Judgment Unit: ${unitA} and Judgment Unit: ${unitB}`;
  }

  if (unitA) return `Judgment Unit: ${unitA}`;
  if (unitB) return `Judgment Unit: ${unitB}`;
  return "Judgment Unit: Decisions";
}

function renderContextNote(metaA?: DatasetMeta | null, metaB?: DatasetMeta | null) {
  const notes = [
    metaA?.contextNote?.trim(),
    metaB?.contextNote?.trim(),
  ].filter((note) => Boolean(note)) as string[];

  if (notes.length === 0) return null;

  const uniqueNotes = Array.from(new Set(notes));
  const label = uniqueNotes.length > 1 ? "Context notes" : "Context note";

  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-muted-foreground">{label}</summary>
      <div className="mt-1 space-y-1">
        {uniqueNotes.map((note, index) => (
          <p key={`${note}-${index}`} className="line-clamp-2 text-muted-foreground">
            {note}
          </p>
        ))}
      </div>
    </details>
  );
}

function determineSteadier(
  cohortA: CompareResult["cohortA"],
  cohortB: CompareResult["cohortB"],
  consistency: CompareResult["consistency"],
) {
  const totalStdA =
    consistency.cohortAStd.return + consistency.cohortAStd.pressure + consistency.cohortAStd.stability;
  const totalStdB =
    consistency.cohortBStd.return + consistency.cohortBStd.pressure + consistency.cohortBStd.stability;

  if (Math.abs(totalStdA - totalStdB) < 0.1) {
    return { question: "Who’s steadier?", answer: "Both cohorts show similar steadiness (std dev is nearly identical)." };
  }

  const steadierLabel = totalStdA < totalStdB ? cohortA.label : cohortB.label;
  return { question: "Who’s steadier?", answer: `${steadierLabel} is steadier (lower variability across R/P/S).` };
}

function determineAggressor(
  cohortA: CompareResult["cohortA"],
  cohortB: CompareResult["cohortB"],
  driverDeltas: CompareResult["driverDeltas"],
) {
  const scoreA = cohortA.avgImpact + cohortA.avgRisk + cohortA.avgUrgency + cohortA.avgReturn;
  const scoreB = cohortB.avgImpact + cohortB.avgRisk + cohortB.avgUrgency + cohortB.avgReturn;
  const leader = scoreA > scoreB ? cohortA.label : cohortB.label;
  const signals: string[] = [];
  if (Math.abs(driverDeltas.urgency) > 0.05) signals.push(driverDeltas.urgency > 0 ? "higher urgency" : "lower urgency");
  if (Math.abs(driverDeltas.risk) > 0.05) signals.push(driverDeltas.risk > 0 ? "higher risk" : "lower risk");
  if (Math.abs(driverDeltas.impact) > 0.05) signals.push(driverDeltas.impact > 0 ? "higher impact" : "lower impact");
  const descriptor = signals.length > 0 ? signals.join(" + ") : "overall driver mix";
  return { question: "Who’s more aggressive?", answer: `${leader} is more aggressive (${descriptor}).` };
}

function describeLearning(
  velocity: CompareResult["velocity"] | undefined,
  labelA: string,
  labelB: string,
) {
  if (!velocity) {
    return { question: "Who learns faster?", answer: "Not measured in this mode." };
  }

  const { a, b } = velocity;
  if (!a.decisionsToTarget && !b.decisionsToTarget) {
    return {
      question: "Who learns faster?",
      answer: "Target not established within the observed decisions for either cohort.",
    };
  }

  if (a.decisionsToTarget && !b.decisionsToTarget) {
    return {
      question: "Who learns faster?",
      answer: `${labelA} reached the target after ${a.decisionsToTarget} decisions; ${labelB} has not reached it yet.`,
    };
  }

  if (!a.decisionsToTarget && b.decisionsToTarget) {
    return {
      question: "Who learns faster?",
      answer: `${labelB} reached the target after ${b.decisionsToTarget} decisions; ${labelA} has not reached it yet.`,
    };
  }

  if (a.decisionsToTarget && b.decisionsToTarget) {
    const faster = a.decisionsToTarget <= b.decisionsToTarget ? labelA : labelB;
    const slowerDecisions = Math.max(a.decisionsToTarget, b.decisionsToTarget);
    const fasterDecisions = Math.min(a.decisionsToTarget, b.decisionsToTarget);
    return {
      question: "Who learns faster?",
      answer: `${faster} reached the target sooner (${fasterDecisions} decisions vs ${slowerDecisions}).`,
    };
  }

  return { question: "Who learns faster?", answer: "Learning velocity not established." };
}

function describePressure(cohortA: CompareResult["cohortA"], cohortB: CompareResult["cohortB"]) {
  const leader = cohortA.avgPressure > cohortB.avgPressure ? cohortA : cohortB;
  const trailer = leader === cohortA ? cohortB : cohortA;
  const answer = `${leader.label} runs higher pressure (${leader.avgPressure.toFixed(1)} vs ${trailer.avgPressure.toFixed(1)}), so instability episodes are more likely.`;
  return { question: "Who breaks under pressure?", answer };
}

function describeRecovery() {
  return { question: "Who recovers faster?", answer: "Not yet measured in this version." };
}
