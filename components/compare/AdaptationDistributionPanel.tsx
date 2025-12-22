"use client";

import { MetricDistribution } from "@/components/reports/MetricDistribution";
import type { AdaptationMetric } from "@/components/compare/AdaptationPanel";

import { AdaptationDeltaColumn } from "@/components/compare/AdaptationDeltaColumn";

type AdaptationDistributionPanelProps = {
  metrics: AdaptationMetric[];
  hasPrevious: boolean;
};

export function AdaptationDistributionPanel({
  metrics,
  hasPrevious,
}: AdaptationDistributionPanelProps) {
  return (
    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Distribution Shift
          </p>
          <p className="text-xs text-muted-foreground">Recent versus prior window distributions</p>
        </div>
        <div
          className={
            hasPrevious
              ? "grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.6fr)_minmax(0,0.95fr)]"
              : "grid gap-4 lg:grid-cols-2"
          }
        >
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recent window
            </div>
            <div className="space-y-4">
              {metrics.map((metric) => (
                <MetricDistribution
                  key={`recent-${metric.key}`}
                  metricLabel={metric.label}
                  segments={metric.recentSegments}
                />
              ))}
            </div>
          </div>

          {hasPrevious && <AdaptationDeltaColumn metrics={metrics} />}

          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Previous window
            </div>
            {hasPrevious ? (
              <div className="space-y-4">
                {metrics.map((metric) => (
                  <MetricDistribution
                    key={`previous-${metric.key}`}
                    metricLabel={metric.label}
                    segments={metric.previousSegments}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-background/60 p-3 text-xs text-muted-foreground">
                Not enough history for a full previous window.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
