"use client";

import React from "react";
import type { CompareResult } from "@/lib/compare/types";
import { buildScatterPoints } from "@/lib/compare/visuals";
import { computeQuadrantShares, computeSteadiness, determineRegimeCall } from "@/lib/compare/evidence";
import { DISTRIBUTION_EPSILON, distributionBuckets, percentile } from "@/lib/compare/stats";
import { CompareSummaryTable } from "@/components/compare/CompareSummaryTable";
import { EvidenceSummary } from "@/components/compare/EvidenceSummary";
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
  const labelA = cohortA.label;
  const labelB = cohortB.label;

  const scatterPointsA = buildScatterPoints(postureSeriesA, result.mode, { useSequence: isSequenceMode });
  const scatterPointsB = buildScatterPoints(postureSeriesB, result.mode, { useSequence: isSequenceMode });
  const returnBucketsA = distributionBuckets(postureSeriesA.map((point) => point.R), DISTRIBUTION_EPSILON);
  const returnBucketsB = distributionBuckets(postureSeriesB.map((point) => point.R), DISTRIBUTION_EPSILON);
  const pressureBucketsA = distributionBuckets(postureSeriesA.map((point) => point.P), DISTRIBUTION_EPSILON);
  const pressureBucketsB = distributionBuckets(postureSeriesB.map((point) => point.P), DISTRIBUTION_EPSILON);
  const stabilityBucketsA = distributionBuckets(postureSeriesA.map((point) => point.S), DISTRIBUTION_EPSILON);
  const stabilityBucketsB = distributionBuckets(postureSeriesB.map((point) => point.S), DISTRIBUTION_EPSILON);

  const distributionMetrics = [
    {
      id: "R",
      label: "Return",
      segmentsA: buildReturnSegments(returnBucketsA),
      segmentsB: buildReturnSegments(returnBucketsB),
    },
    {
      id: "P",
      label: "Pressure",
      segmentsA: buildPressureSegments(pressureBucketsA),
      segmentsB: buildPressureSegments(pressureBucketsB),
    },
    {
      id: "S",
      label: "Stability",
      segmentsA: buildStabilitySegments(stabilityBucketsA),
      segmentsB: buildStabilitySegments(stabilityBucketsB),
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

  const varianceReturnA = buildVarianceCell(cohortA.stdReturn, varianceBands);
  const varianceReturnB = buildVarianceCell(cohortB.stdReturn, varianceBands);
  const variancePressureA = buildVarianceCell(cohortA.stdPressure, varianceBands);
  const variancePressureB = buildVarianceCell(cohortB.stdPressure, varianceBands);
  const varianceStabilityA = buildVarianceCell(cohortA.stdStability, varianceBands);
  const varianceStabilityB = buildVarianceCell(cohortB.stdStability, varianceBands);

  const summaryRows = [
    { label: "Average D-NAV", valueA: cohortA.avgDnav, valueB: cohortB.avgDnav },
    {
      label: "Avg Return (R)",
      valueA: cohortA.avgReturn,
      valueB: cohortB.avgReturn,
      varianceA: varianceReturnA,
      varianceB: varianceReturnB,
    },
    {
      label: "Avg Pressure (P)",
      valueA: cohortA.avgPressure,
      valueB: cohortB.avgPressure,
      varianceA: variancePressureA,
      varianceB: variancePressureB,
    },
    {
      label: "Avg Stability (S)",
      valueA: cohortA.avgStability,
      valueB: cohortB.avgStability,
      varianceA: varianceStabilityA,
      varianceB: varianceStabilityB,
    },
  ];

  const systemSummary = buildEntityCompareSummary({
    labelA: cohortA.label,
    labelB: cohortB.label,
    averages: {
      return: cohortA.avgReturn,
      pressure: cohortA.avgPressure,
      stability: cohortA.avgStability,
      dnavA: cohortA.avgDnav,
      dnavB: cohortB.avgDnav,
      returnB: cohortB.avgReturn,
      pressureB: cohortB.avgPressure,
      stabilityB: cohortB.avgStability,
    },
    varianceLabels: {
      returnA: varianceReturnA?.label ?? "Moderate",
      returnB: varianceReturnB?.label ?? "Moderate",
      pressureA: variancePressureA?.label ?? "Moderate",
      pressureB: variancePressureB?.label ?? "Moderate",
      stabilityA: varianceStabilityA?.label ?? "Moderate",
      stabilityB: varianceStabilityB?.label ?? "Moderate",
    },
    distributions: {
      returnPositiveA: returnBucketsA.pctPositive,
      returnPositiveB: returnBucketsB.pctPositive,
      pressureCalmA: pressureBucketsA.pctNegative,
      pressureCalmB: pressureBucketsB.pctNegative,
      stabilityPositiveA: stabilityBucketsA.pctPositive,
      stabilityPositiveB: stabilityBucketsB.pctPositive,
    },
  });

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
                <p className="text-xs text-muted-foreground">{systemSummary.header}</p>
                <ul className="list-disc space-y-2 pl-4 text-xs text-muted-foreground">
                  {systemSummary.bullets.map((item) => (
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

      {result.mode !== "entity" && <CompareSummaryTable labelA={labelA} labelB={labelB} rows={summaryRows} />}

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

type SummaryInput = {
  labelA: string;
  labelB: string;
  averages: {
    return: number;
    returnB: number;
    pressure: number;
    pressureB: number;
    stability: number;
    stabilityB: number;
    dnavA: number;
    dnavB: number;
  };
  varianceLabels: {
    returnA: string;
    returnB: string;
    pressureA: string;
    pressureB: string;
    stabilityA: string;
    stabilityB: string;
  };
  distributions: {
    returnPositiveA: number;
    returnPositiveB: number;
    pressureCalmA: number;
    pressureCalmB: number;
    stabilityPositiveA: number;
    stabilityPositiveB: number;
  };
};

function buildEntityCompareSummary(input: SummaryInput) {
  const { labelA, labelB, averages, varianceLabels, distributions } = input;
  const returnAvgPhrase = describeAvgComparison("Return", averages.return, averages.returnB, labelA, labelB);
  const pressureAvgPhrase = describeAvgComparison("Pressure", averages.pressure, averages.pressureB, labelA, labelB);
  const stabilityAvgPhrase = describeAvgComparison("Stability", averages.stability, averages.stabilityB, labelA, labelB);

  const returnSharePhrase = describeShareComparison(
    "positive",
    distributions.returnPositiveA,
    distributions.returnPositiveB,
    labelA,
    labelB,
  );
  const pressureSharePhrase = describeShareComparison(
    "calm",
    distributions.pressureCalmA,
    distributions.pressureCalmB,
    labelA,
    labelB,
  );
  const stabilitySharePhrase = describeShareComparison(
    "stable",
    distributions.stabilityPositiveA,
    distributions.stabilityPositiveB,
    labelA,
    labelB,
  );

  const returnVariancePhrase = describeVarianceComparison(
    varianceLabels.returnA,
    varianceLabels.returnB,
    labelA,
    labelB,
  );
  const pressureVariancePhrase = describeVarianceComparison(
    varianceLabels.pressureA,
    varianceLabels.pressureB,
    labelA,
    labelB,
  );
  const stabilityVariancePhrase = describeVarianceComparison(
    varianceLabels.stabilityA,
    varianceLabels.stabilityB,
    labelA,
    labelB,
  );

  const header = buildSummaryHeader({
    labelA,
    labelB,
    returnAvg: averages.return,
    returnAvgB: averages.returnB,
    stabilityAvg: averages.stability,
    stabilityAvgB: averages.stabilityB,
    returnVariance: varianceLabels.returnA,
    returnVarianceB: varianceLabels.returnB,
  });

  const netClassification = describeNetClassification(averages.dnavA, averages.dnavB, labelA, labelB);

  const bullets = [
    `Return: ${returnAvgPhrase}, ${returnSharePhrase}; variance indicates ${returnVariancePhrase}.`,
    `Pressure: ${pressureAvgPhrase}, ${pressureSharePhrase}; variance indicates ${pressureVariancePhrase}.`,
    `Stability: ${stabilityAvgPhrase}, ${stabilitySharePhrase}; variance indicates ${stabilityVariancePhrase}.`,
    `Net: ${netClassification}.`,
  ];

  return { header, bullets };
}

function describeAvgComparison(metric: string, valueA: number, valueB: number, labelA: string, labelB: string) {
  if (valueA === valueB) {
    return `average ${metric.toLowerCase()} is comparable between ${labelA} and ${labelB}`;
  }
  const leader = valueA > valueB ? labelA : labelB;
  return `${leader} shows higher average ${metric.toLowerCase()}`;
}

function describeShareComparison(
  shareLabel: string,
  valueA: number,
  valueB: number,
  labelA: string,
  labelB: string,
) {
  const diff = Math.abs(valueA - valueB);
  const formattedA = formatPct(valueA);
  const formattedB = formatPct(valueB);

  if (diff <= 3) {
    return `${shareLabel} share is comparable (${formattedA} vs ${formattedB})`;
  }

  const leader = valueA > valueB ? labelA : labelB;
  return `${leader} has higher ${shareLabel} share (${formattedA} vs ${formattedB})`;
}

function describeVarianceComparison(labelA: string, labelB: string, labelAName: string, labelBName: string) {
  if (labelA === labelB) {
    return `both are ${varianceLabelToPhrase(labelA)} (${labelA})`;
  }

  const scoreA = varianceLabelScore(labelA);
  const scoreB = varianceLabelScore(labelB);

  if (scoreA < scoreB) {
    return `${labelAName} is ${varianceLabelToPhrase(labelA)} while ${labelBName} is ${varianceLabelToPhrase(labelB)} (${labelA} vs ${labelB})`;
  }

  return `${labelBName} is ${varianceLabelToPhrase(labelB)} while ${labelAName} is ${varianceLabelToPhrase(labelA)} (${labelB} vs ${labelA})`;
}

function varianceLabelScore(label: string) {
  switch (label) {
    case "Tight":
      return 0;
    case "Moderate":
      return 1;
    case "Volatile":
      return 2;
    default:
      return 1;
  }
}

function varianceLabelToPhrase(label: string) {
  switch (label) {
    case "Tight":
      return "more consistent / tighter signal";
    case "Moderate":
      return "moderately consistent";
    case "Volatile":
      return "more variable / less predictable";
    default:
      return "moderately consistent";
  }
}

function buildSummaryHeader({
  labelA,
  labelB,
  returnAvg,
  returnAvgB,
  stabilityAvg,
  stabilityAvgB,
  returnVariance,
  returnVarianceB,
}: {
  labelA: string;
  labelB: string;
  returnAvg: number;
  returnAvgB: number;
  stabilityAvg: number;
  stabilityAvgB: number;
  returnVariance: string;
  returnVarianceB: string;
}) {
  const returnLeader = describeLeader(returnAvg, returnAvgB, labelA, labelB);
  const stabilityLeader = describeLeader(stabilityAvg, stabilityAvgB, labelA, labelB);
  const returnConsistency = describeConsistencyComparison(returnVariance, returnVarianceB, labelA, labelB);

  if (returnLeader === "comparable" && stabilityLeader === "comparable") {
    return `Return and Stability are comparable across ${labelA} and ${labelB}, with ${returnConsistency}.`;
  }

  if (returnLeader === stabilityLeader) {
    return `${returnLeader} shows higher Return and Stability, with ${returnConsistency}.`;
  }

  if (returnLeader === "comparable") {
    return `Stability favors ${stabilityLeader} while Return is comparable, with ${returnConsistency}.`;
  }

  if (stabilityLeader === "comparable") {
    return `Return favors ${returnLeader} while Stability is comparable, with ${returnConsistency}.`;
  }

  return `Return favors ${returnLeader} while Stability favors ${stabilityLeader}, with ${returnConsistency}.`;
}

function describeLeader(valueA: number, valueB: number, labelA: string, labelB: string) {
  if (valueA === valueB) return "comparable";
  return valueA > valueB ? labelA : labelB;
}

function describeConsistencyComparison(labelA: string, labelB: string, labelAName: string, labelBName: string) {
  if (labelA === labelB) {
    return `comparable Return consistency (${labelA})`;
  }

  const scoreA = varianceLabelScore(labelA);
  const scoreB = varianceLabelScore(labelB);

  if (scoreA < scoreB) {
    return `${labelAName} showing ${varianceLabelToPhrase(labelA)} Return`;
  }
  return `${labelBName} showing ${varianceLabelToPhrase(labelB)} Return`;
}

function describeNetClassification(dnavA: number, dnavB: number, labelA: string, labelB: string) {
  if (dnavA === dnavB) {
    return `overall D-NAV levels are comparable between ${labelA} and ${labelB}`;
  }
  const leader = dnavA > dnavB ? labelA : labelB;
  return `${leader} operates with higher overall D-NAV`;
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
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
