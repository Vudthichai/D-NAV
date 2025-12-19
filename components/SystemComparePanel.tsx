"use client";

import React from "react";
import { Info } from "lucide-react";
import type { CompareResult, ScatterPoint, VelocityResult } from "@/lib/compare/types";
import { formatUnitCount, getUnitLabels, type UnitLabels } from "@/utils/judgmentUnits";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildRecoverySeries, buildScatterPoints, buildVarianceSeries } from "@/lib/compare/visuals";
import { computeQuadrantShares, computeSteadiness, determineRegimeCall } from "@/lib/compare/evidence";
import { DISTRIBUTION_EPSILON, distributionBuckets } from "@/lib/compare/stats";
import { EvidenceSummary } from "@/components/compare/EvidenceSummary";
import { EvidenceRPSScatter } from "@/components/compare/EvidenceRPSScatter";
import { EvidenceTemporalPanel } from "@/components/compare/EvidenceTemporalPanel";
import { EvidenceRecoveryPanel } from "@/components/compare/EvidenceRecoveryPanel";
import { JudgmentRegimeBadge } from "./compare/JudgmentRegimeBadge";
import { EarlyWarningFlags } from "./compare/EarlyWarningFlags";
import { DistributionStackedBars } from "./compare/charts/DistributionStackedBars";

interface SystemComparePanelProps {
  result: CompareResult;
  warning?: string;
  showDebug?: boolean;
}

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({ result, warning, showDebug }) => {
  const { cohortA, cohortB, deltas, velocity, driverDeltas, consistency, topDrivers } = result;
  const unitLabelRaw = result.judgmentUnitLabel || cohortA.judgmentUnitLabel || cohortB.judgmentUnitLabel;
  const unitLabels = getUnitLabels(unitLabelRaw);
  const datasetLabelA = cohortA.datasetLabel ?? cohortA.label;
  const datasetLabelB = cohortB.datasetLabel ?? cohortB.label;
  const posture = result.posture;
  const postureSeriesA = posture?.cohortA.series ?? [];
  const postureSeriesB = posture?.cohortB.series ?? [];

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

  const isSequenceMode = cohortA.timeframeMode === "sequence" || cohortB.timeframeMode === "sequence";

  const scatterPointsA = buildScatterPoints(postureSeriesA, result.mode, { useSequence: isSequenceMode });
  const scatterPointsB = buildScatterPoints(postureSeriesB, result.mode, { useSequence: isSequenceMode });
  const scatterDomain: [number, number] = deriveScatterDomain([...scatterPointsA, ...scatterPointsB]);

  const varianceSeries = [
    { id: "A", label: cohortA.label, data: buildVarianceSeries(postureSeriesA, 5, { useSequence: isSequenceMode }) },
    { id: "B", label: cohortB.label, data: buildVarianceSeries(postureSeriesB, 5, { useSequence: isSequenceMode }) },
  ].filter((entry) => entry.data.length > 0);

  const recoverySeries = velocity
    ? [
        { id: "A", label: cohortA.label, color: "hsl(var(--foreground))", ...buildRecoverySeries(postureSeriesA, velocity.a, velocity.target) },
        { id: "B", label: cohortB.label, color: "hsl(var(--primary))", ...buildRecoverySeries(postureSeriesB, velocity.b, velocity.target) },
      ]
    : [];

  const distributionMetrics = [
    {
      id: "R",
      label: "Return (R)",
      valuesA: postureSeriesA.map((point) => point.R),
      valuesB: postureSeriesB.map((point) => point.R),
    },
    {
      id: "P",
      label: "Pressure (P)",
      valuesA: postureSeriesA.map((point) => point.P),
      valuesB: postureSeriesB.map((point) => point.P),
    },
    {
      id: "S",
      label: "Stability (S)",
      valuesA: postureSeriesA.map((point) => point.S),
      valuesB: postureSeriesB.map((point) => point.S),
    },
  ];

  const quadrantSharesA = computeQuadrantShares(scatterPointsA);
  const quadrantSharesB = computeQuadrantShares(scatterPointsB);
  const regimeCall = determineRegimeCall(postureSeriesA, postureSeriesB, deltas);

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

      {result.mode !== "entity" && (
        <EvidenceSummary
          labelA={cohortA.label}
          labelB={cohortB.label}
          summaryA={{
            centroid: { R: cohortA.avgReturn, P: cohortA.avgPressure, S: cohortA.avgStability },
            steadiness: computeSteadiness(cohortA.stdReturn, cohortA.stdPressure, cohortA.stdStability),
            quadrantShares: quadrantSharesA,
          }}
          summaryB={{
            centroid: { R: cohortB.avgReturn, P: cohortB.avgPressure, S: cohortB.avgStability },
            steadiness: computeSteadiness(cohortB.stdReturn, cohortB.stdPressure, cohortB.stdStability),
            quadrantShares: quadrantSharesB,
          }}
          drift={deltas}
          regimeCall={regimeCall}
          sequenceMode={isSequenceMode}
        />
      )}

      {result.mode === "entity" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-muted/40 p-4">
            <EvidenceRPSScatter
              series={[
                {
                  id: "A",
                  label: cohortA.label,
                  color: "hsl(var(--foreground))",
                  points: scatterPointsA,
                  centroid: { xPressure: cohortA.avgPressure, yReturn: cohortA.avgReturn },
                  std: { pressure: cohortA.stdPressure, return: cohortA.stdReturn },
                },
                {
                  id: "B",
                  label: cohortB.label,
                  color: "hsl(var(--primary))",
                  points: scatterPointsB,
                  centroid: { xPressure: cohortB.avgPressure, yReturn: cohortB.avgReturn },
                  std: { pressure: cohortB.stdPressure, return: cohortB.stdReturn },
                },
              ]}
              domain={scatterDomain}
              title="Return vs Pressure"
              subtitle="Overlayed posture scatter (shared axes)"
              contextLabel={isSequenceMode ? "Sequence Mode: index-based ordering" : undefined}
            />
          </div>
          <div className="rounded-xl border bg-muted/40 p-4">
            <DistributionStackedBars
              title="Distributions (Return / Pressure / Stability)"
              subtitle={`Buckets use ε = ${DISTRIBUTION_EPSILON}`}
              metrics={distributionMetrics.map((metric) => ({
                id: metric.id,
                label: metric.label,
                rows: [
                  {
                    id: `${metric.id}-A`,
                    label: cohortA.label,
                    buckets: distributionBuckets(metric.valuesA, DISTRIBUTION_EPSILON),
                  },
                  {
                    id: `${metric.id}-B`,
                    label: cohortB.label,
                    buckets: distributionBuckets(metric.valuesB, DISTRIBUTION_EPSILON),
                  },
                ],
              }))}
            />
          </div>
        </div>
      )}

      {result.mode === "temporal" && (
        <EvidenceTemporalPanel
          scatterA={{
            id: "A",
            label: cohortA.label,
            color: "hsl(var(--foreground))",
            points: scatterPointsA,
            centroid: { xPressure: cohortA.avgPressure, yReturn: cohortA.avgReturn },
            std: { pressure: cohortA.stdPressure, return: cohortA.stdReturn },
          }}
          scatterB={{
            id: "B",
            label: cohortB.label,
            color: "hsl(var(--primary))",
            points: scatterPointsB,
            centroid: { xPressure: cohortB.avgPressure, yReturn: cohortB.avgReturn },
            std: { pressure: cohortB.stdPressure, return: cohortB.stdReturn },
          }}
          scatterDomain={scatterDomain}
          varianceSeries={varianceSeries}
          timeframeLabelA={cohortA.timeframeLabel}
          timeframeLabelB={cohortB.timeframeLabel}
          sequenceMode={isSequenceMode}
        />
      )}

      {result.mode === "velocity" && velocity && (
        <EvidenceRecoveryPanel
          series={recoverySeries}
          target={velocity.target}
          thresholds={velocity.a.thresholds}
          consecutive={velocity.a.consecutiveWindows}
          title={velocity.targetLabel}
        />
      )}

      {result.mode !== "entity" && (
        <details className="rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Advanced metrics
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
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

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border bg-background/60 p-4">
                <h3 className="mb-2 text-sm font-semibold">{metric.label}</h3>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{formatValue(metric.a)} · {cohortA.label}</span>
                  <span>{formatValue(metric.b)} · {cohortB.label}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">Δ A→B: {formatDelta(metric.delta)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-background/60 p-4">
              <h3 className="mb-2 text-sm font-semibold">Consistency (std dev)</h3>
              <p className="text-xs text-muted-foreground">
                Lower values mean the system is steadier in the selected window.
              </p>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{cohortA.label}</span>
                  <span>
                    R {formatValue(consistency.cohortAStd.return)} · P {formatValue(consistency.cohortAStd.pressure)} · S{" "}
                    {formatValue(consistency.cohortAStd.stability)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{cohortB.label}</span>
                  <span>
                    R {formatValue(consistency.cohortBStd.return)} · P {formatValue(consistency.cohortBStd.pressure)} · S{" "}
                    {formatValue(consistency.cohortBStd.stability)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-background/60 p-4 md:col-span-2">
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

          {posture && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <JudgmentRegimeBadge label={cohortA.label} regime={posture.cohortA.regime} />
              <JudgmentRegimeBadge label={cohortB.label} regime={posture.cohortB.regime} />
            </div>
          )}

          {posture && result.mode === "temporal" && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <EarlyWarningFlags label={cohortA.label} posture={posture.cohortA} />
              <EarlyWarningFlags label={cohortB.label} posture={posture.cohortB} />
            </div>
          )}

          {velocity && (
            <div className="mt-4 space-y-4">
              <VelocitySettingsSummary velocity={velocity} unitLabels={unitLabels} />
              <div className="grid gap-4 lg:grid-cols-2">
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
              </div>
            </div>
          )}

          {topDrivers.length > 0 && (
            <p className="text-xs text-muted-foreground">Top drivers: {topDrivers.slice(0, 2).join(" · ")}</p>
          )}
        </details>
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

function VelocitySettingsSummary({
  velocity,
  unitLabels,
}: {
  velocity: NonNullable<CompareResult["velocity"]>;
  unitLabels: UnitLabels;
}) {
  const thresholds = velocity.a.thresholds;
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Targets & Settings</p>
          <p className="text-sm font-semibold text-foreground">{velocity.targetLabel}</p>
          <p className="text-xs text-muted-foreground">Settings sit directly above the outputs; adjust in Compare controls.</p>
        </div>
        <DefinitionPill
          term="Recovery (Decisions-to-Target)"
          definition="Recovery (Decisions-to-Target) = number of decisions required to re-enter the target band after deviation, using the rolling window + consecutive windows rule."
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <SettingStat label="Window size" value={`${velocity.a.windowSize} ${unitLabels.plural}`} />
        <SettingStat label="Consecutive windows (k)" value={velocity.a.consecutiveWindows.toString()} />
        <SettingStat label="Windows evaluated" value={`${velocity.a.windowsEvaluated}`} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs text-muted-foreground">
        {velocity.target === "RETURN_RISE" && <SettingStat label="Return lift (ΔR)" value={thresholds.returnLift.toFixed(1)} muted />}
        {velocity.target === "PRESSURE_STABILIZE" && (
          <>
            <SettingStat label="Pressure band (±)" value={thresholds.pressureBand.toFixed(1)} muted />
            <SettingStat label="Stability floor" value={thresholds.stabilityFloor.toFixed(1)} muted />
          </>
        )}
        {velocity.target === "STABILITY_STABILIZE" && (
          <>
            <SettingStat label="Stability floor" value={thresholds.stabilityFloor.toFixed(1)} muted />
            <SettingStat label="Stability band (±)" value={thresholds.stabilityBand.toFixed(1)} muted />
          </>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        The shaded timeline below shows the first hit index for each cohort and the “inside target” band after that point.
      </p>
    </div>
  );
}

function SettingStat({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded-lg border bg-background/60 p-2 ${muted ? "text-muted-foreground" : "text-foreground"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function deriveScatterDomain(points: ScatterPoint[]): [number, number] {
  if (!points.length) return [-9, 9];
  const values = points.flatMap((point) => [point.xPressure, point.yReturn]);
  const min = Math.max(-9, Math.min(...values) - 0.5);
  const max = Math.min(9, Math.max(...values) + 0.5);
  return [min, max];
}

function DefinitionPill({ term, definition, size = "md" }: { term: string; definition: string; size?: "md" | "sm" }) {
  const dimension = size === "sm" ? "h-7 px-2 text-[11px]" : "h-8 px-3 text-xs";
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/50 bg-background/60 font-semibold text-foreground ${dimension}`}
            aria-label={`${term} definition`}
          >
            <Info className="h-4 w-4" />
            <span>{term}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-xs">
          <p className="font-semibold text-background">{term}</p>
          <p className="text-muted-foreground">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
