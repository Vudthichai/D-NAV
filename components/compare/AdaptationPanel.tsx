"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { MetricDistribution, type MetricDistributionSegment } from "@/components/reports/MetricDistribution";
import type { DecisionEntry } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  computeBasicStats,
  computeBucketShares,
  formatDelta,
  formatPercent,
  getConsistencyLabel,
  getDeltaDirection,
  scoreConsistency,
  sliceRecentAndPrevious,
  type BucketShares,
} from "@/lib/compare/adaptation";

type AdaptationPanelProps = {
  decisions: DecisionEntry[];
  windowSize: number;
  onWindowSizeChange: (value: number) => void;
  windowOptions?: number[];
};

export function AdaptationPanel({
  decisions,
  windowSize,
  onWindowSizeChange,
  windowOptions = [25, 50, 100],
}: AdaptationPanelProps) {
  const { recent, previous } = useMemo(
    () => sliceRecentAndPrevious(decisions, windowSize),
    [decisions, windowSize],
  );

  const recentShares = useMemo(() => computeBucketShares(recent), [recent]);
  const previousShares = useMemo(() => computeBucketShares(previous), [previous]);

  const recentStats = useMemo(() => computeBasicStats(recent), [recent]);
  const previousStats = useMemo(() => computeBasicStats(previous), [previous]);

  const hasRecent = recent.length > 0;
  const hasPrevious = previous.length > 0;

  const meanDelta = hasPrevious && recentStats.meanDnav !== null && previousStats.meanDnav !== null
    ? recentStats.meanDnav - previousStats.meanDnav
    : null;

  const consistencyRecent = getConsistencyLabel(recentStats.stdDnav);
  const consistencyPrevious = getConsistencyLabel(previousStats.stdDnav);

  const signalArrow = meanDelta === null
    ? "—"
    : meanDelta > 0
      ? "↑"
      : meanDelta < 0
        ? "↓"
        : "→";

  const pressureWarningShare = formatPercent(recentShares.pressure.positive);
  const stableShare = formatPercent(recentShares.stability.positive);

  const metrics = [
    {
      key: "return",
      label: "Return",
      positiveLabel: "Positive Return",
      previous: previousShares.return,
      recent: recentShares.return,
      segments: {
        previous: buildReturnSegments(previousShares.return),
        recent: buildReturnSegments(recentShares.return),
      },
    },
    {
      key: "pressure",
      label: "Pressure",
      positiveLabel: "Pressure warning",
      previous: previousShares.pressure,
      recent: recentShares.pressure,
      segments: {
        previous: buildPressureSegments(previousShares.pressure),
        recent: buildPressureSegments(recentShares.pressure),
      },
    },
    {
      key: "stability",
      label: "Stability",
      positiveLabel: "Stable share",
      previous: previousShares.stability,
      recent: recentShares.stability,
      segments: {
        previous: buildStabilitySegments(previousShares.stability),
        recent: buildStabilitySegments(recentShares.stability),
      },
    },
  ];

  const windowDescription = describeWindow(decisions.length, windowSize, recent.length, previous.length);

  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Adaptation</p>
          <p className="text-sm font-semibold text-foreground">Recent vs previous decision windows</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Window</span>
          <Button
            variant={windowSize === 0 ? "default" : "outline"}
            size="sm"
            onClick={() => onWindowSizeChange(0)}
            className={cn(
              "rounded-full px-3 text-xs",
              windowSize === 0 ? "shadow-sm" : "bg-muted/60 text-foreground",
            )}
          >
            All
          </Button>
          {windowOptions.map((option) => (
            <Button
              key={option}
              variant={windowSize === option ? "default" : "outline"}
              size="sm"
              onClick={() => onWindowSizeChange(option)}
              className={cn(
                "rounded-full px-3 text-xs",
                windowSize === option ? "shadow-sm" : "bg-muted/60 text-foreground",
              )}
            >
              Last {option}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-3 text-[11px] text-muted-foreground">
        {windowDescription}
      </div>

      {!hasRecent ? (
        <div className="mt-4 rounded-xl border bg-background/60 p-6 text-sm text-muted-foreground">
          No decision history yet. Log decisions to see adaptation.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {!hasPrevious && (
            <div className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
              Not enough history to compare the previous window yet. Recent window stats are shown below.
            </div>
          )}

          <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Distribution Shift
                </p>
                <p className="text-xs text-muted-foreground">Return · Pressure · Stability</p>
              </div>
              <div className="grid gap-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid-cols-2">
                <span className="lg:pl-1">Previous window</span>
                <span className="lg:pl-1">Recent window</span>
              </div>
              <div className="space-y-5">
                {metrics.map((metric) => (
                  <div key={metric.key} className="space-y-2">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="opacity-60">
                        <MetricDistribution metricLabel={metric.label} segments={metric.segments.previous} />
                      </div>
                      <div>
                        <MetricDistribution metricLabel={metric.label} segments={metric.segments.recent} />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {buildDeltaLabel(metric.positiveLabel, metric.previous.positive, metric.recent.positive, hasPrevious)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Adaptation Summary</p>
                <p className="text-xs text-muted-foreground">Signal, consistency, and pressure mix</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryChip label="Signal" value={signalArrow} />
                <SummaryChip label="Consistency" value={consistencyRecent} />
                <SummaryChip label="Pressure warning" value={pressureWarningShare} />
                <SummaryChip label="Stable share" value={stableShare} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Adaptation Verdict</p>
              <p className="text-sm text-muted-foreground">
                {buildVerdict({
                  hasPrevious,
                  meanDelta,
                  pressureDelta: recentShares.pressure.positive - previousShares.pressure.positive,
                  stabilityDelta: recentShares.stability.positive - previousShares.stability.positive,
                  consistencyRecent,
                  consistencyPrevious,
                  recentCount: recent.length,
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildDeltaLabel(
  label: string,
  previousValue: number,
  recentValue: number,
  hasPrevious: boolean,
) {
  if (!hasPrevious) return "Awaiting previous window to compare.";
  const delta = recentValue - previousValue;
  const direction = getDeltaDirection(delta);
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  return `${label} ${arrow} ${formatDelta(delta)}`;
}

function buildVerdict({
  hasPrevious,
  meanDelta,
  pressureDelta,
  stabilityDelta,
  consistencyRecent,
  consistencyPrevious,
  recentCount,
}: {
  hasPrevious: boolean;
  meanDelta: number | null;
  pressureDelta: number;
  stabilityDelta: number;
  consistencyRecent: "Tight" | "Moderate" | "Volatile" | "—";
  consistencyPrevious: "Tight" | "Moderate" | "Volatile" | "—";
  recentCount: number;
}): string {
  if (!hasPrevious) {
    return "Not enough history to compare yet—log more decisions to see adaptation.";
  }

  const dnavTrend = meanDelta === null
    ? "steady"
    : meanDelta > 0
      ? "higher"
      : meanDelta < 0
        ? "lower"
        : "steady";
  const pressureTrend = pressureDelta < 0 ? "lower" : pressureDelta > 0 ? "higher" : "steady";
  const stabilityTrend = stabilityDelta > 0 ? "higher" : stabilityDelta < 0 ? "lower" : "steady";

  const consistencyScoreRecent = scoreConsistency(consistencyRecent);
  const consistencyScorePrevious = scoreConsistency(consistencyPrevious);
  const consistencyTrend =
    consistencyScoreRecent > consistencyScorePrevious
      ? "tighter"
      : consistencyScoreRecent < consistencyScorePrevious
        ? "more volatile"
        : "steady";

  const positiveSignals = [
    meanDelta !== null && meanDelta > 0,
    pressureDelta < 0,
    stabilityDelta > 0,
    consistencyScoreRecent > consistencyScorePrevious,
  ].filter(Boolean).length;

  const negativeSignals = [
    meanDelta !== null && meanDelta < 0,
    pressureDelta > 0,
    stabilityDelta < 0,
    consistencyScoreRecent < consistencyScorePrevious,
  ].filter(Boolean).length;

  const prefix =
    positiveSignals >= 3 && negativeSignals === 0
      ? "Judgment quality is improving: "
      : negativeSignals >= 3 && positiveSignals === 0
        ? "Judgment quality is slipping: "
        : "Mixed signals: ";

  return `${prefix}Mean D-NAV is ${dnavTrend}, pressure warnings are ${pressureTrend}, stable share is ${stabilityTrend}, and consistency is ${consistencyTrend} over the last ${recentCount} decisions.`;
}

function buildReturnSegments(shares: BucketShares): MetricDistributionSegment[] {
  return [
    { label: "Positive", value: shares.positive, colorClass: "bg-emerald-500" },
    { label: "Neutral", value: shares.neutral, colorClass: "bg-muted" },
    { label: "Negative", value: shares.negative, colorClass: "bg-rose-500" },
  ];
}

function buildPressureSegments(shares: BucketShares): MetricDistributionSegment[] {
  return [
    { label: "Pressured", value: shares.positive, colorClass: "bg-amber-500" },
    { label: "Neutral", value: shares.neutral, colorClass: "bg-muted" },
    { label: "Calm", value: shares.negative, colorClass: "bg-sky-500" },
  ];
}

function buildStabilitySegments(shares: BucketShares): MetricDistributionSegment[] {
  return [
    { label: "Stable", value: shares.positive, colorClass: "bg-emerald-600" },
    { label: "Neutral", value: shares.neutral, colorClass: "bg-muted" },
    { label: "Fragile", value: shares.negative, colorClass: "bg-rose-500" },
  ];
}

function describeWindow(total: number, windowSize: number, recentCount: number, previousCount: number) {
  if (total === 0) return "No decisions logged yet.";
  if (windowSize <= 0) {
    if (total >= 100) {
      return "All decisions · recent 50 vs previous 50.";
    }
    return `All decisions · recent ${recentCount} vs previous ${previousCount}.`;
  }
  return `Last ${windowSize} decisions · recent ${recentCount} vs previous ${previousCount}.`;
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/70 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
