"use client";

import React from "react";
import type { CohortSummary, CompareResult, ScatterPoint } from "@/lib/compare/types";
import { buildScatterPoints } from "@/lib/compare/visuals";
import { computeQuadrantShares, computeSteadiness, determineRegimeCall } from "@/lib/compare/evidence";
import { DISTRIBUTION_EPSILON, distributionBuckets, percentile } from "@/lib/compare/stats";
import { CompareSummaryTable } from "@/components/compare/CompareSummaryTable";
import { EvidenceSummary } from "@/components/compare/EvidenceSummary";
import { EvidenceTemporalPanel } from "@/components/compare/EvidenceTemporalPanel";
import { MetricDistribution, type MetricDistributionSegment } from "@/components/reports/MetricDistribution";

interface SystemComparePanelProps {
  result: CompareResult;
  warning?: string;
  showDebug?: boolean;
}

type DistributionMetric = {
  id: string;
  label: string;
  segmentsA: MetricDistributionSegment[];
  segmentsB: MetricDistributionSegment[];
};

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({ result, warning, showDebug }) => {
  const { cohortA, cohortB, deltas } = result;
  const posture = result.posture;
  const postureSeriesA = posture?.cohortA.series ?? [];
  const postureSeriesB = posture?.cohortB.series ?? [];

  const isSequenceMode = cohortA.timeframeMode === "sequence" || cohortB.timeframeMode === "sequence";
  const labelA = result.mode === "temporal" ? "Period A" : cohortA.label;
  const labelB = result.mode === "temporal" ? "Period B" : cohortB.label;

  const scatterPointsA = buildScatterPoints(postureSeriesA, result.mode, { useSequence: isSequenceMode });
  const scatterPointsB = buildScatterPoints(postureSeriesB, result.mode, { useSequence: isSequenceMode });
  const scatterDomain: [number, number] = deriveScatterDomain([...scatterPointsA, ...scatterPointsB]);

  const distributionMetrics = [
    {
      id: "R",
      label: "Return",
      segmentsA: buildReturnSegments(
        distributionBuckets(postureSeriesA.map((point) => point.R), DISTRIBUTION_EPSILON),
      ),
      segmentsB: buildReturnSegments(
        distributionBuckets(postureSeriesB.map((point) => point.R), DISTRIBUTION_EPSILON),
      ),
    },
    {
      id: "P",
      label: "Pressure",
      segmentsA: buildPressureSegments(
        distributionBuckets(postureSeriesA.map((point) => point.P), DISTRIBUTION_EPSILON),
      ),
      segmentsB: buildPressureSegments(
        distributionBuckets(postureSeriesB.map((point) => point.P), DISTRIBUTION_EPSILON),
      ),
    },
    {
      id: "S",
      label: "Stability",
      segmentsA: buildStabilitySegments(
        distributionBuckets(postureSeriesA.map((point) => point.S), DISTRIBUTION_EPSILON),
      ),
      segmentsB: buildStabilitySegments(
        distributionBuckets(postureSeriesB.map((point) => point.S), DISTRIBUTION_EPSILON),
      ),
    },
  ];

  const quadrantSharesA = computeQuadrantShares(scatterPointsA);
  const quadrantSharesB = computeQuadrantShares(scatterPointsB);
  const regimeCall = determineRegimeCall(postureSeriesA, postureSeriesB, deltas);

  const varianceBands = buildVarianceBands([
    cohortA.stdReturn,
    cohortA.stdPressure,
    cohortA.stdStability,
    cohortB.stdReturn,
    cohortB.stdPressure,
    cohortB.stdStability,
  ]);

  const summaryRows = [
    { label: "Average D-NAV", valueA: cohortA.avgDnav, valueB: cohortB.avgDnav },
    {
      label: "Avg Return (R)",
      valueA: cohortA.avgReturn,
      valueB: cohortB.avgReturn,
      varianceA: buildVarianceCell(cohortA.stdReturn, varianceBands),
      varianceB: buildVarianceCell(cohortB.stdReturn, varianceBands),
    },
    {
      label: "Avg Pressure (P)",
      valueA: cohortA.avgPressure,
      valueB: cohortB.avgPressure,
      varianceA: buildVarianceCell(cohortA.stdPressure, varianceBands),
      varianceB: buildVarianceCell(cohortB.stdPressure, varianceBands),
    },
    {
      label: "Avg Stability (S)",
      valueA: cohortA.avgStability,
      valueB: cohortB.avgStability,
      varianceA: buildVarianceCell(cohortA.stdStability, varianceBands),
      varianceB: buildVarianceCell(cohortB.stdStability, varianceBands),
    },
  ];
  const systemSummary = buildSystemSummaryBullets(cohortA, cohortB);
  const distributionSummaryLine = buildDistributionSummaryLine(cohortA, cohortB);

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
          labelA={labelA}
          labelB={labelB}
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
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Distributions (Return / Pressure / Stability)
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{distributionSummaryLine}</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 lg:divide-x lg:divide-muted/40">
                <DistributionColumn label={cohortA.label} metrics={distributionMetrics} variant="A" className="lg:pr-6" />
                <DistributionColumn label={cohortB.label} metrics={distributionMetrics} variant="B" className="lg:pl-6" />
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <CompareSummaryTable
              title="Summary Stats"
              subtitle="Average D-NAV and R / P / S"
              labelA={cohortA.label}
              labelB={cohortB.label}
              rows={summaryRows}
            />
            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">System Summary</p>
                <ul className="list-disc space-y-2 pl-4 text-xs text-muted-foreground">
                  {systemSummary.map((item) => (
                    <li key={item}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {result.mode === "temporal" && (
        <EvidenceTemporalPanel
          scatterA={{
            id: "A",
            label: labelA,
            color: "hsl(var(--foreground))",
            points: scatterPointsA,
            centroid: { xPressure: cohortA.avgPressure, yReturn: cohortA.avgReturn },
            std: { pressure: cohortA.stdPressure, return: cohortA.stdReturn },
          }}
          scatterB={{
            id: "B",
            label: labelB,
            color: "hsl(var(--primary))",
            points: scatterPointsB,
            centroid: { xPressure: cohortB.avgPressure, yReturn: cohortB.avgReturn },
            std: { pressure: cohortB.stdPressure, return: cohortB.stdReturn },
          }}
          scatterDomain={scatterDomain}
          sequenceMode={isSequenceMode}
        />
      )}

      {result.mode === "temporal" && (
        <CompareSummaryTable labelA={labelA} labelB={labelB} rows={summaryRows} />
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

function DistributionColumn({
  label,
  metrics,
  variant,
  className,
}: {
  label: string;
  metrics: DistributionMetric[];
  variant: "A" | "B";
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className ?? ""}`.trim()}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="space-y-5">
        {metrics.map((metric) => (
          <MetricDistribution
            key={`${metric.id}-${variant}`}
            metricLabel={metric.label}
            segments={variant === "A" ? metric.segmentsA : metric.segmentsB}
          />
        ))}
      </div>
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

function buildSystemSummaryBullets(cohortA: CohortSummary, cohortB: CohortSummary) {
  const labelA = cohortA.label;
  const labelB = cohortB.label;

  const returnBullet = buildComparisonBullet(
    "return",
    cohortA.avgReturn,
    cohortB.avgReturn,
    labelA,
    labelB,
  );
  const pressureBullet = buildComparisonBullet(
    "pressure",
    cohortA.avgPressure,
    cohortB.avgPressure,
    labelA,
    labelB,
  );
  const stabilityBullet = buildComparisonBullet(
    "stability",
    cohortA.avgStability,
    cohortB.avgStability,
    labelA,
    labelB,
  );
  const dnavBullet =
    cohortA.avgDnav === cohortB.avgDnav
      ? `Net judgment profile is evenly matched between ${labelA} and ${labelB}.`
      : `Net judgment profile favors ${cohortA.avgDnav > cohortB.avgDnav ? labelA : labelB} for sustained execution.`;

  return [returnBullet, pressureBullet, stabilityBullet, dnavBullet];
}

function buildComparisonBullet(
  metric: string,
  valueA: number,
  valueB: number,
  labelA: string,
  labelB: string,
) {
  if (valueA === valueB) {
    return `${metricLabel(metric)} averages are balanced across ${labelA} and ${labelB}.`;
  }

  const leader = valueA > valueB ? labelA : labelB;
  return `${leader} shows higher average ${metricLabel(metric)}.`;
}

function metricLabel(metric: string) {
  switch (metric) {
    case "return":
      return "return";
    case "pressure":
      return "pressure";
    case "stability":
      return "stability";
    default:
      return metric;
  }
}

function buildReturnSegments(buckets: { pctPositive: number; pctNeutral: number; pctNegative: number }): MetricDistributionSegment[] {
  return [
    { label: "Positive", value: buckets.pctPositive, colorClass: "bg-emerald-500" },
    { label: "Neutral", value: buckets.pctNeutral, colorClass: "bg-muted" },
    { label: "Negative", value: buckets.pctNegative, colorClass: "bg-rose-500" },
  ];
}

function buildPressureSegments(buckets: { pctPositive: number; pctNeutral: number; pctNegative: number }): MetricDistributionSegment[] {
  return [
    { label: "Pressured", value: buckets.pctPositive, colorClass: "bg-amber-500" },
    { label: "Neutral", value: buckets.pctNeutral, colorClass: "bg-muted" },
    { label: "Calm", value: buckets.pctNegative, colorClass: "bg-sky-500" },
  ];
}

function buildStabilitySegments(buckets: { pctPositive: number; pctNeutral: number; pctNegative: number }): MetricDistributionSegment[] {
  return [
    { label: "Stable", value: buckets.pctPositive, colorClass: "bg-emerald-600" },
    { label: "Neutral", value: buckets.pctNeutral, colorClass: "bg-muted" },
    { label: "Fragile", value: buckets.pctNegative, colorClass: "bg-rose-500" },
  ];
}

function buildVarianceBands(values: number[]) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (!safeValues.length) {
    return { lower: 0, upper: 0 };
  }
  return {
    lower: percentile(safeValues, 33),
    upper: percentile(safeValues, 67),
  };
}

function buildVarianceCell(value: number, bands: { lower: number; upper: number }) {
  if (!Number.isFinite(value)) return undefined;
  if (value <= bands.lower) return { value, label: "Tight" };
  if (value <= bands.upper) return { value, label: "Moderate" };
  return { value, label: "Volatile" };
}

function buildDistributionSummaryLine(cohortA: CohortSummary, cohortB: CohortSummary) {
  const returnLeader = compareMetric(cohortA.avgReturn, cohortB.avgReturn);
  const stabilityLeader = compareMetric(cohortA.avgStability, cohortB.avgStability);
  const pressureLeader = compareMetric(cohortA.avgPressure, cohortB.avgPressure);

  const basePhrase = buildReturnStabilityPhrase(
    returnLeader,
    stabilityLeader,
    cohortA.label,
    cohortB.label,
  );

  const pressureClause =
    pressureLeader === "tie"
      ? "with Pressure levels balanced."
      : `with higher Pressure exposure in ${pressureLeader === "A" ? cohortA.label : cohortB.label}.`;

  return `${basePhrase} ${pressureClause}`;
}

type MetricLeader = "A" | "B" | "tie";

function compareMetric(valueA: number, valueB: number): MetricLeader {
  if (valueA === valueB) return "tie";
  return valueA > valueB ? "A" : "B";
}

function buildReturnStabilityPhrase(
  returnLeader: MetricLeader,
  stabilityLeader: MetricLeader,
  labelA: string,
  labelB: string,
) {
  if (returnLeader === "tie" && stabilityLeader === "tie") {
    return `Return and Stability are balanced between ${labelA} and ${labelB}`;
  }

  if (returnLeader !== "tie" && returnLeader === stabilityLeader) {
    const leaderLabel = returnLeader === "A" ? labelA : labelB;
    return `${leaderLabel} shows higher Return and Stability`;
  }

  if (returnLeader === "tie") {
    const leaderLabel = stabilityLeader === "A" ? labelA : labelB;
    return `Return is balanced while ${leaderLabel} shows higher Stability`;
  }

  if (stabilityLeader === "tie") {
    const leaderLabel = returnLeader === "A" ? labelA : labelB;
    return `Stability is balanced while ${leaderLabel} shows higher Return`;
  }

  const returnLabel = returnLeader === "A" ? labelA : labelB;
  const stabilityLabel = stabilityLeader === "A" ? labelA : labelB;
  return `Return is higher for ${returnLabel} while Stability is higher for ${stabilityLabel}`;
}
