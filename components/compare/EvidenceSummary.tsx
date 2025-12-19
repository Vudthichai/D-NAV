"use client";

import React from "react";
import { formatNumber, formatPercent } from "@/lib/compare/evidence";

export type EvidenceSummaryMetric = {
  centroid: { R: number; P: number; S: number };
  steadiness: number;
  quadrantShares: {
    upperRight: number;
    upperLeft: number;
    lowerRight: number;
    lowerLeft: number;
  };
};

type EvidenceSummaryProps = {
  labelA: string;
  labelB: string;
  summaryA: EvidenceSummaryMetric;
  summaryB: EvidenceSummaryMetric;
  drift: { returnDelta: number; pressureDelta: number; stabilityDelta: number };
  regimeCall: string;
  sequenceMode?: boolean;
};

export function EvidenceSummary({ labelA, labelB, summaryA, summaryB, drift, regimeCall, sequenceMode }: EvidenceSummaryProps) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Evidence summary</p>
          <p className="text-sm font-semibold text-foreground">Quadrants, centroids, steadiness</p>
          {sequenceMode && <p className="text-[11px] text-muted-foreground">Sequence Mode: order index used for time.</p>}
        </div>
        <div className="text-[11px] text-muted-foreground">
          <p className="uppercase tracking-wide">Regime call</p>
          <p className="text-sm font-semibold text-foreground">{regimeCall}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <SummaryColumn label={labelA} metric={summaryA} />
        <SummaryColumn label={labelB} metric={summaryB} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border bg-background/60 p-3 text-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Drift (Δ centroid)</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            R {formatDelta(drift.returnDelta)} · P {formatDelta(drift.pressureDelta)} · S {formatDelta(drift.stabilityDelta)}
          </p>
        </div>
        <div className="rounded-lg border bg-background/60 p-3 text-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Steadiness definition</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Steadiness = 1 / (1 + mean(σR, σP, σS)). Higher = tighter clustering.
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryColumn({ label, metric }: { label: string; metric: EvidenceSummaryMetric }) {
  return (
    <div className="rounded-lg border bg-background/60 p-3 text-xs text-muted-foreground">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 grid gap-2">
        <SummaryLine label="Centroid (R̄, P̄)" value={`${formatNumber(metric.centroid.R)} · ${formatNumber(metric.centroid.P)}`} />
        <SummaryLine label="Stability mean (S̄)" value={formatNumber(metric.centroid.S)} />
        <SummaryLine label="Steadiness score" value={formatNumber(metric.steadiness, 3)} />
        <SummaryLine label="Aggressive optionality" value={formatPercent(metric.quadrantShares.upperRight, 0)} />
      </div>
      <div className="mt-2 grid gap-1 text-[11px]">
        <QuadrantItem label="Efficient upside" value={metric.quadrantShares.upperLeft} />
        <QuadrantItem label="Fragility / debt" value={metric.quadrantShares.lowerRight} />
        <QuadrantItem label="Low-signal / stagnation" value={metric.quadrantShares.lowerLeft} />
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function QuadrantItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-semibold text-foreground">{formatPercent(value, 0)}</span>
    </div>
  );
}

function formatDelta(value: number) {
  if (Math.abs(value) < 0.05) return "0";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value, 2)}`;
}
