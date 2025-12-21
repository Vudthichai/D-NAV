"use client";

import React from "react";

export type MetricDistributionSegment = {
  label: string;
  value: number;
  colorClass: string;
};

type MetricDistributionProps = {
  metricLabel: string;
  segments: MetricDistributionSegment[];
};

const formatPct = (value: number) => `${value.toFixed(1)}%`;

export function MetricDistribution({ metricLabel, segments }: MetricDistributionProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{metricLabel}</span>
        <span>
          {segments
            .map((segment) => {
              const safeValue = Number.isFinite(segment.value) ? segment.value : 0;
              return `${segment.label} ${formatPct(safeValue)}`;
            })
            .join(" · ")}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted/60">
        {segments.map((segment) => {
          const safeValue = Number.isFinite(segment.value) ? segment.value : 0;
          return (
            <div
              key={segment.label}
              className={segment.colorClass}
              style={{ width: `${safeValue}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
