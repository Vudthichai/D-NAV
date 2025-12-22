"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import type { MetricDistributionSegment } from "@/components/reports/MetricDistribution";
import type { DecisionEntry } from "@/lib/storage";
import { classifyConsistency } from "@/lib/adaptation";
import { cn } from "@/lib/utils";
import {
  computeBucketShares,
  computeConsistencyStd,
  sliceRecentAndPrevious,
  type BucketShares,
} from "@/lib/compare/adaptation";

import { AdaptationDistributionPanel } from "@/components/compare/AdaptationDistributionPanel";
import { AdaptationSummaryTiles } from "@/components/compare/AdaptationSummaryTiles";
import { AdaptationVerdict } from "@/components/compare/AdaptationVerdict";

export type AdaptationMetric = {
  key: "return" | "pressure" | "stability";
  label: string;
  recent: BucketShares;
  previous: BucketShares;
  recentSegments: MetricDistributionSegment[];
  previousSegments: MetricDistributionSegment[];
  delta: number;
};

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

  const hasRecent = recent.length > 0;
  const hasPrevious = previous.length > 0;

  const consistencyStd = useMemo(() => computeConsistencyStd(recent), [recent]);
  const consistencyLabel = classifyConsistency(consistencyStd);

  const metrics: AdaptationMetric[] = useMemo(
    () => [
      {
        key: "return",
        label: "Return",
        recent: recentShares.return,
        previous: previousShares.return,
        recentSegments: buildReturnSegments(recentShares.return),
        previousSegments: buildReturnSegments(previousShares.return),
        delta: recentShares.return.positive - previousShares.return.positive,
      },
      {
        key: "pressure",
        label: "Pressure",
        recent: recentShares.pressure,
        previous: previousShares.pressure,
        recentSegments: buildPressureSegments(recentShares.pressure),
        previousSegments: buildPressureSegments(previousShares.pressure),
        delta: recentShares.pressure.positive - previousShares.pressure.positive,
      },
      {
        key: "stability",
        label: "Stability",
        recent: recentShares.stability,
        previous: previousShares.stability,
        recentSegments: buildStabilitySegments(recentShares.stability),
        previousSegments: buildStabilitySegments(previousShares.stability),
        delta: recentShares.stability.positive - previousShares.stability.positive,
      },
    ],
    [recentShares, previousShares],
  );

  const windowDescription = describeWindow(decisions.length, windowSize, recent.length, previous.length);

  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Adaptation</p>
          <p className="text-sm font-semibold text-foreground">Recent → delta → previous</p>
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

      <div className="mt-3 text-[11px] text-muted-foreground">{windowDescription}</div>

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

          <AdaptationDistributionPanel metrics={metrics} hasPrevious={hasPrevious} />

          <AdaptationSummaryTiles
            hasPrevious={hasPrevious}
            returnDelta={metrics[0].delta}
            pressureDelta={metrics[1].delta}
            stabilityDelta={metrics[2].delta}
            pressureShare={recentShares.pressure.positive}
            stabilityShare={recentShares.stability.positive}
            consistencyLabel={consistencyLabel}
          />

          {hasPrevious ? (
            <AdaptationVerdict
              hasPrevious={hasPrevious}
              returnDelta={metrics[0].delta}
              pressureDelta={metrics[1].delta}
              stabilityDelta={metrics[2].delta}
            />
          ) : (
            <div className="rounded-2xl border bg-card/70 p-4 text-sm text-muted-foreground shadow-sm">
              Add another window to generate a comparison verdict.
            </div>
          )}
        </div>
      )}
    </div>
  );
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
    return `All decisions · recent ${recentCount} vs previous ${previousCount}.`;
  }
  return `Last ${windowSize} decisions · recent ${recentCount} vs previous ${previousCount}.`;
}
