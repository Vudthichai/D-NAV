"use client";

import React from "react";

import type { DistributionBuckets } from "@/lib/compare/stats";

type DistributionMetric = {
  id: string;
  label: string;
  rows: DistributionRow[];
};

type DistributionRow = {
  id: string;
  label: string;
  buckets: DistributionBuckets;
};

type DistributionStackedBarsProps = {
  title: string;
  subtitle?: string;
  metrics: DistributionMetric[];
};

const SEGMENTS = [
  { key: "negative", label: "Negative", color: "bg-red-500/80 text-white" },
  { key: "neutral", label: "Neutral", color: "bg-slate-400/60 text-foreground" },
  { key: "positive", label: "Positive", color: "bg-emerald-500/80 text-white" },
] as const;

export function DistributionStackedBars({ title, subtitle, metrics }: DistributionStackedBarsProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          {subtitle && <p className="text-sm font-semibold text-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {SEGMENTS.map((segment) => (
            <div key={segment.key} className="flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${segment.color}`} />
              <span>{segment.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.id} className="space-y-2">
            <p className="text-xs font-semibold text-foreground">{metric.label}</p>
            <div className="space-y-2">
              {metric.rows.map((row) => (
                <DistributionBarRow key={row.id} row={row} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionBarRow({ row }: { row: DistributionRow }) {
  if (row.buckets.total === 0) {
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="w-24 font-medium text-foreground">{row.label}</span>
        <span>No data</span>
      </div>
    );
  }

  const segments = [
    { key: "negative", value: row.buckets.pctNegative },
    { key: "neutral", value: row.buckets.pctNeutral },
    { key: "positive", value: row.buckets.pctPositive },
  ] as const;

  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs font-medium text-foreground">{row.label}</span>
      <div className="flex-1">
        <div className="flex h-6 overflow-hidden rounded-md border bg-muted/20 text-[11px] font-semibold">
          {segments.map((segment) => {
            const meta = SEGMENTS.find((entry) => entry.key === segment.key);
            const value = Number.isFinite(segment.value) ? segment.value : 0;
            if (!meta || value <= 0) return null;
            const showLabel = value >= 12;
            const label = `${value.toFixed(0)}%`;
            return (
              <div
                key={segment.key}
                className={`flex items-center justify-center ${meta.color}`}
                style={{ width: `${value}%` }}
                title={`${meta.label}: ${label}`}
              >
                {showLabel ? label : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
