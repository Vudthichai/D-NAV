"use client";

import React from "react";

import type { DistributionBuckets } from "@/lib/compare/stats";

type DistributionMetric = {
  id: string;
  label: string;
  bucketsA: DistributionBuckets;
  bucketsB: DistributionBuckets;
};

type DistributionStackedBarsProps = {
  title: string;
  subtitle?: string;
  labelA: string;
  labelB: string;
  metrics: DistributionMetric[];
};

const SEGMENTS = [
  { key: "negative", label: "Negative", color: "bg-red-500/80 text-white" },
  { key: "neutral", label: "Neutral", color: "bg-slate-400/60 text-foreground" },
  { key: "positive", label: "Positive", color: "bg-emerald-500/80 text-white" },
] as const;

export function DistributionStackedBars({ title, subtitle, labelA, labelB, metrics }: DistributionStackedBarsProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          {subtitle && <p className="text-sm font-semibold text-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {SEGMENTS.map((segment) => (
            <div key={segment.key} className="flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${segment.color}`} />
              <span>{segment.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 lg:divide-x lg:divide-muted/40">
        <DistributionColumn label={labelA} metrics={metrics} variant="A" className="lg:pr-6" />
        <DistributionColumn label={labelB} metrics={metrics} variant="B" className="lg:pl-6" />
      </div>
    </div>
  );
}

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
      <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={`${metric.id}-${variant}`} className="flex items-center gap-3">
            <span className="w-28 text-xs font-medium text-foreground">{metric.label}</span>
            <DistributionBar buckets={variant === "A" ? metric.bucketsA : metric.bucketsB} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionBar({ buckets }: { buckets: DistributionBuckets }) {
  if (buckets.total === 0) {
    return (
      <div className="flex h-5 w-full items-center rounded-md border bg-muted/10 px-2 text-[11px] text-muted-foreground">
        No data
      </div>
    );
  }

  const segments = [
    { key: "negative", value: buckets.pctNegative },
    { key: "neutral", value: buckets.pctNeutral },
    { key: "positive", value: buckets.pctPositive },
  ] as const;

  return (
    <div className="flex h-5 w-full overflow-hidden rounded-md border bg-muted/20 text-[11px] font-semibold">
      {segments.map((segment) => {
        const meta = SEGMENTS.find((entry) => entry.key === segment.key);
        const value = Number.isFinite(segment.value) ? segment.value : 0;
        if (!meta || value <= 0) return null;
        const showLabel = value >= 10;
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
  );
}
