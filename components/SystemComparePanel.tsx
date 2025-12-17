"use client";

import React from "react";
import type { CompareResult, VelocityResult } from "@/lib/compare/types";
import { formatUnitCount, getUnitLabels, type UnitLabels } from "@/utils/judgmentUnits";
import { JudgmentRegimeBadge } from "./compare/JudgmentRegimeBadge";
import { PostureGeometryPanel } from "./compare/PostureGeometryPanel";
import { TemporalSeismograph } from "./compare/TemporalSeismograph";
import { EarlyWarningFlags } from "./compare/EarlyWarningFlags";

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
  const comparisonLabels = getComparisonLabels(result.mode, cohortA.label, cohortB.label);
  const executiveSummary = buildExecutiveSummary(result, unitLabelRaw, comparisonLabels, unitLabels);
  const postureNarrative = buildPostureNarrative(executiveSummary, comparisonLabels);
  const datasetLabelA = cohortA.datasetLabel ?? cohortA.label;
  const datasetLabelB = cohortB.datasetLabel ?? cohortB.label;
  const posture = result.posture;

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

      {posture && (
        <div className="grid gap-4 md:grid-cols-2">
          <JudgmentRegimeBadge label={cohortA.label} regime={posture.cohortA.regime} />
          <JudgmentRegimeBadge label={cohortB.label} regime={posture.cohortB.regime} />
        </div>
      )}

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Judgment Executive Summary</p>
        <div className="mt-2 space-y-3">
          {executiveSummary.map((item) => (
            <div key={item.question} className="rounded-lg border bg-background/60 p-3">
              <p className="text-xs font-semibold text-foreground">{item.question}</p>
              <p className="text-sm text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {posture && (
        <div className="grid gap-4 md:grid-cols-2">
          <PostureGeometryPanel
            label={cohortA.label}
            posture={posture.cohortA}
            interpretation={posture.contrast.postureSummary}
          />
          <PostureGeometryPanel
            label={cohortB.label}
            posture={posture.cohortB}
            interpretation={posture.contrast.primaryRisk}
          />
        </div>
      )}

      {posture && result.mode === "temporal" && (
        <>
          <TemporalSeismograph
            data={[
              { label: cohortA.label, series: posture.cohortA.series, trends: posture.cohortA.trends },
              { label: cohortB.label, series: posture.cohortB.series, trends: posture.cohortB.trends },
            ]}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <EarlyWarningFlags label={cohortA.label} posture={posture.cohortA} />
            <EarlyWarningFlags label={cohortB.label} posture={posture.cohortB} />
          </div>
        </>
      )}

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
        {posture ? (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <NarrativeTile title="Posture Summary" body={posture.contrast.postureSummary} />
            <NarrativeTile title="Regime Contrast" body={posture.contrast.regimeContrast} />
            <NarrativeTile title="Primary Risk" body={posture.contrast.primaryRisk} />
            <NarrativeTile title="Best Use Case" body={posture.contrast.bestUseCase} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{postureNarrative || narrative}</p>
        )}
        {topDrivers.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Top drivers: {topDrivers.slice(0, 2).join(" · ")}</p>
        )}
      </div>

      {velocity && (
        <div className="grid gap-4 lg:grid-cols-3">
          <VelocityCard
            label={`Recovery Index — ${cohortA.label}`}
            result={velocity.a}
            unitLabels={unitLabels}
            unitLabelRaw={unitLabelRaw}
          />
          <VelocityCard
            label={`Recovery Index — ${cohortB.label}`}
            result={velocity.b}
            unitLabels={unitLabels}
            unitLabelRaw={unitLabelRaw}
          />
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
          <p className="text-xs text-muted-foreground">How quickly the system re-enters stability after deviation.</p>
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

function NarrativeTile({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
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
  if (mode === "velocity") return "How quickly does the system re-enter stability?";
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

type ComparisonLabels = {
  labelA: string;
  labelB: string;
  subject: string;
};

type JudgmentInsight = {
  question: string;
  answer: string;
  theme: "system" | "steady" | "aggressive" | "adapt" | "pressure" | "recover";
  leader?: "A" | "B" | "tie";
};

const SIGNIFICANT_DELTA = 0.05;

function getComparisonLabels(mode: CompareResult["mode"], labelA: string, labelB: string): ComparisonLabels {
  if (mode === "temporal") return { labelA, labelB, subject: "Period" };
  if (mode === "velocity") return { labelA, labelB, subject: "System (speed to stability)" };
  return { labelA, labelB, subject: "System" };
}

function describeSystemIdentity(
  result: CompareResult,
  labels: ComparisonLabels,
  unitLabels: UnitLabels,
  unitLabelRaw: string | null | undefined,
) {
  const { cohortA, cohortB } = result;
  const unitSummary =
    cohortA.totalDecisions && cohortB.totalDecisions
      ? `Built on ${formatUnitCount(cohortA.totalDecisions, unitLabelRaw)} vs ${formatUnitCount(
          cohortB.totalDecisions,
          unitLabelRaw,
        )} ${unitLabels.plural}.`
      : "";

  if (result.mode === "temporal") {
    return [
      `Same system viewed twice (${cohortA.timeframeLabel} vs ${cohortB.timeframeLabel}) to check how judgment physics shifted.`,
      unitSummary,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (result.mode === "velocity" && result.velocity) {
    return [
      `Which system locks into the target pattern faster (${result.velocity.a.targetLabel}).`,
      unitSummary,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `Side-by-side view of ${labels.labelA} vs ${labels.labelB} in the same window to see how their decision posture differs.`,
    unitSummary,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildExecutiveSummary(
  result: CompareResult,
  unitLabelRaw: string | null | undefined,
  labels: ComparisonLabels,
  unitLabels: UnitLabels,
): JudgmentInsight[] {
  const { cohortA, cohortB, deltas, driverDeltas, consistency, velocity } = result;
  const identityAnswer = describeSystemIdentity(result, labels, unitLabels, unitLabelRaw);

  const steadierDelta = deltas.stabilityDelta;
  const steadierLead = determineLeader(
    steadierDelta,
    consistency.cohortAStd.stability,
    consistency.cohortBStd.stability,
  );
  const steadierAnswer =
    steadierLead === "tie"
      ? `${labels.labelA} and ${labels.labelB} keep stability about the same.`
      : `${labelsLabel(steadierLead, labels)} holds steadier patterns than ${labelsLabel(oppositeLeader(steadierLead), labels)}.`;

  const aggressionLead = determineAggressionLeader(deltas.returnDelta, driverDeltas);
  const aggressionAnswer =
    aggressionLead === "tie"
      ? "Aggression looks similar — no one is obviously pushing harder."
      : `${labelsLabel(aggressionLead, labels)} leans more aggressive in pursuit of returns.`;

  const adaptationInsight = buildAdaptationInsight(
    result.mode,
    velocity,
    unitLabelRaw,
    labels,
    consistency,
    driverDeltas.confidence,
  );

  const pressureLead = determineLeader(
    deltas.pressureDelta,
    consistency.cohortAStd.pressure,
    consistency.cohortBStd.pressure,
  );

  const recoveryInsight = buildRecoveryInsight(
    result.mode,
    velocity,
    unitLabelRaw,
    labels,
    consistency,
    deltas,
  );

  const recoverAnswer = buildPressureRecoveryAnswer(
    pressureLead,
    recoveryInsight,
    labels,
  );

  return [
    { question: "What kind of judgment system is this?", answer: identityAnswer, theme: "system" },
    { question: "Who is steadier?", answer: steadierAnswer, theme: "steady", leader: steadierLead },
    { question: "Who is more aggressive?", answer: aggressionAnswer, theme: "aggressive", leader: aggressionLead },
    { question: "Who adapts faster?", answer: adaptationInsight.answer, theme: "adapt", leader: adaptationInsight.leader },
    { question: "Who recovers better under pressure?", answer: recoverAnswer, theme: "recover", leader: recoveryInsight.leader },
  ];
}

function determineAggressionLeader(returnDelta: number, driverDeltas: CompareResult["driverDeltas"]): "A" | "B" | "tie" {
  if (Math.abs(returnDelta) >= SIGNIFICANT_DELTA) return returnDelta > 0 ? "B" : "A";
  const combinedDriverSignal = (driverDeltas.impact + driverDeltas.urgency) / 2;
  if (Math.abs(combinedDriverSignal) < SIGNIFICANT_DELTA) return "tie";
  return combinedDriverSignal > 0 ? "B" : "A";
}

function buildAdaptationInsight(
  mode: CompareResult["mode"],
  velocity: CompareResult["velocity"] | undefined,
  unitLabelRaw: string | null | undefined,
  labels: ComparisonLabels,
  consistency: CompareResult["consistency"],
  confidenceDelta: number,
): { answer: string; leader: "A" | "B" | "tie" } {
  if (mode === "velocity" && velocity) {
    const decisionsA = velocity.a.decisionsToTarget;
    const decisionsB = velocity.b.decisionsToTarget;
    if (decisionsA && decisionsB) {
      if (decisionsA === decisionsB) {
        return { answer: "Both reach stability at a similar pace.", leader: "tie" };
      }
      const leader = decisionsA < decisionsB ? "A" : "B";
      const fasterCount = leader === "A" ? decisionsA : decisionsB;
      const slowerCount = leader === "A" ? decisionsB : decisionsA;
      return {
        answer: `${labelsLabel(leader, labels)} adapts faster, reaching stability in ${formatUnitCount(
          fasterCount,
          unitLabelRaw,
        )} versus ${formatUnitCount(slowerCount, unitLabelRaw)} for ${labelsLabel(oppositeLeader(leader), labels)}.`,
        leader,
      };
    }
    if (decisionsA && !decisionsB)
      return {
        answer: `${labels.labelA} adapts faster, reaching the target in ${formatUnitCount(decisionsA, unitLabelRaw)} while ${labels.labelB} has not reached it yet.`,
        leader: "A",
      };
    if (!decisionsA && decisionsB)
      return {
        answer: `${labels.labelB} adapts faster, reaching the target in ${formatUnitCount(decisionsB, unitLabelRaw)} while ${labels.labelA} has not reached it yet.`,
        leader: "B",
      };
    return { answer: "Neither group reached the target within the observed window.", leader: "tie" };
  }

  const consistencyScoreA =
    (consistency.cohortAStd.return + consistency.cohortAStd.pressure + consistency.cohortAStd.stability) / 3;
  const consistencyScoreB =
    (consistency.cohortBStd.return + consistency.cohortBStd.pressure + consistency.cohortBStd.stability) / 3;
  if (Math.abs(consistencyScoreA - consistencyScoreB) >= SIGNIFICANT_DELTA) {
    const leader = consistencyScoreA < consistencyScoreB ? "A" : "B";
    return {
      answer: `${labelsLabel(leader, labels)} adapts faster, stabilizing earlier than ${labelsLabel(oppositeLeader(leader), labels)}.`,
      leader,
    };
  }

  if (Math.abs(confidenceDelta) >= SIGNIFICANT_DELTA) {
    const leader = confidenceDelta > 0 ? "B" : "A";
    return {
      answer: `${labelsLabel(leader, labels)} shows quicker adaptation, reflected in stronger confidence shifts.`,
      leader,
    };
  }

  return { answer: "Both adapt at a similar pace.", leader: "tie" };
}

function buildRecoveryInsight(
  mode: CompareResult["mode"],
  velocity: CompareResult["velocity"] | undefined,
  unitLabelRaw: string | null | undefined,
  labels: ComparisonLabels,
  consistency: CompareResult["consistency"],
  deltas: CompareResult["deltas"],
): { answer: string; leader: "A" | "B" | "tie" } {
  if (mode === "velocity" && velocity) {
    const { decisionsToTarget: decisionsA } = velocity.a;
    const { decisionsToTarget: decisionsB } = velocity.b;
    if (decisionsA && decisionsB) {
      if (decisionsA === decisionsB) {
        return { answer: "Recovery speed is similar for both.", leader: "tie" };
      }
      const leader = decisionsA < decisionsB ? "A" : "B";
      const fasterCount = leader === "A" ? decisionsA : decisionsB;
      const slowerCount = leader === "A" ? decisionsB : decisionsA;
      return {
        answer: `${labelsLabel(leader, labels)} recovers faster after instability, returning inside the target band in ${formatUnitCount(
          fasterCount,
          unitLabelRaw,
        )} versus ${formatUnitCount(slowerCount, unitLabelRaw)}.`,
        leader,
      };
    }
    if (decisionsA && !decisionsB)
      return {
        answer: `${labels.labelA} recovers faster, re-entering stability in ${formatUnitCount(decisionsA, unitLabelRaw)} while ${labels.labelB} remains outside the band.`,
        leader: "A",
      };
    if (!decisionsA && decisionsB)
      return {
        answer: `${labels.labelB} recovers faster, re-entering stability in ${formatUnitCount(decisionsB, unitLabelRaw)} while ${labels.labelA} remains outside the band.`,
        leader: "B",
      };
    return { answer: "Recovery speed is similar; neither reached the target band yet.", leader: "tie" };
  }

  const recoveryScoreA = consistency.cohortAStd.pressure + consistency.cohortAStd.stability;
  const recoveryScoreB = consistency.cohortBStd.pressure + consistency.cohortBStd.stability;
  if (Math.abs(recoveryScoreA - recoveryScoreB) >= SIGNIFICANT_DELTA) {
    const leader = recoveryScoreA < recoveryScoreB ? "A" : "B";
    return {
      answer: `${labelsLabel(leader, labels)} recovers faster after instability.`,
      leader,
    };
  }

  if (Math.abs(deltas.stabilityDelta) >= SIGNIFICANT_DELTA) {
    const leader = deltas.stabilityDelta > 0 ? "B" : "A";
    return {
      answer: `${labelsLabel(leader, labels)} shows a slight edge in recovery pace.`,
      leader,
    };
  }

  return { answer: "Recovery speed is similar.", leader: "tie" };
}

function buildPressureRecoveryAnswer(
  pressureLeader: "A" | "B" | "tie",
  recoveryInsight: { answer: string; leader: "A" | "B" | "tie" },
  labels: ComparisonLabels,
) {
  const calmSide =
    pressureLeader === "tie"
      ? "Both groups take on similar pressure."
      : `${labelsLabel(oppositeLeader(pressureLeader), labels)} stays calmer when pressure rises.`;

  if (recoveryInsight.leader === "tie") {
    return `${calmSide} Recovery pace is comparable when things wobble.`;
  }

  return `${recoveryInsight.answer} ${calmSide}`.trim();
}

function determineLeader(delta: number, stdA: number, stdB: number): "A" | "B" | "tie" {
  if (Math.abs(delta) >= SIGNIFICANT_DELTA) return delta > 0 ? "B" : "A";
  if (Math.abs(stdA - stdB) < SIGNIFICANT_DELTA) return "tie";
  return stdA < stdB ? "A" : "B";
}

function labelsLabel(leader: "A" | "B" | "tie", labels: ComparisonLabels) {
  if (leader === "tie") return `${labels.labelA} and ${labels.labelB}`;
  return leader === "A" ? labels.labelA : labels.labelB;
}

function oppositeLeader(leader: "A" | "B" | "tie"): "A" | "B" | "tie" {
  if (leader === "A") return "B";
  if (leader === "B") return "A";
  return "tie";
}

function buildPostureNarrative(insights: JudgmentInsight[], labels: ComparisonLabels) {
  const findLeader = (theme: JudgmentInsight["theme"]) =>
    insights.find((item) => item.theme === theme)?.leader ?? "tie";

  const aggressive = findLeader("aggressive");
  const adapt = findLeader("adapt");
  const steady = findLeader("steady");
  const pressure = findLeader("pressure");
  const recover = findLeader("recover");

  const headlineParts: string[] = [];
  if (aggressive !== "tie") headlineParts.push(`${labelsLabel(aggressive, labels)} is more aggressive`);
  if (adapt !== "tie") headlineParts.push(`${labelsLabel(adapt, labels)} adapts faster`);
  if (steady !== "tie") headlineParts.push(`${labelsLabel(steady, labels)} stays steadier`);

  const pressureParts: string[] = [];
  if (pressure !== "tie") {
    pressureParts.push(`${labelsLabel(pressure, labels)} shows more pressure sensitivity`);
  }
  if (recover !== "tie") {
    pressureParts.push(`${labelsLabel(recover, labels)} recovers faster`);
  }

  const firstSentence = headlineParts.length
    ? `${headlineParts.join(", ").replace(/, ([^,]*)$/, " and $1")}.`
    : "Both groups track closely on the core questions.";
  const secondSentence = pressureParts.length
    ? `${pressureParts.join(" while ")}.`
    : "Pressure response and recovery look similar.";

  return `${firstSentence} ${secondSentence}`.trim();
}
