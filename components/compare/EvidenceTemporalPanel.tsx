"use client";

import React from "react";
import type { RPSLineSeries } from "@/lib/compare/types";
import { EvidenceRPSScatter, type EvidenceScatterSeries } from "@/components/compare/EvidenceRPSScatter";
import { VarianceLine } from "@/components/compare/charts/VarianceLine";

export type EvidenceTemporalPanelProps = {
  scatterA: EvidenceScatterSeries;
  scatterB: EvidenceScatterSeries;
  scatterDomain: [number, number];
  varianceSeries: (RPSLineSeries & { color?: string })[];
  timeframeLabelA: string;
  timeframeLabelB: string;
  sequenceMode?: boolean;
};

export function EvidenceTemporalPanel({
  scatterA,
  scatterB,
  scatterDomain,
  varianceSeries,
  timeframeLabelA,
  timeframeLabelB,
  sequenceMode,
}: EvidenceTemporalPanelProps) {
  const contextLabel = sequenceMode ? "Sequence Mode: index-based ordering" : undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryStatCard
          label={`Period A · ${timeframeLabelA}`}
          meanR={scatterA.centroid.yReturn}
          meanP={scatterA.centroid.xPressure}
          stdR={scatterA.std.return}
          stdP={scatterA.std.pressure}
        />
        <SummaryStatCard
          label={`Period B · ${timeframeLabelB}`}
          meanR={scatterB.centroid.yReturn}
          meanP={scatterB.centroid.xPressure}
          stdR={scatterB.std.return}
          stdP={scatterB.std.pressure}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-muted/40 p-4">
          <EvidenceRPSScatter
            series={[scatterA]}
            domain={scatterDomain}
            title="Period A"
            subtitle={timeframeLabelA}
            contextLabel={contextLabel}
          />
        </div>
        <div className="rounded-xl border bg-muted/40 p-4">
          <EvidenceRPSScatter
            series={[scatterB]}
            domain={scatterDomain}
            title="Period B"
            subtitle={timeframeLabelB}
            contextLabel={contextLabel}
          />
        </div>
      </div>
      <div className="rounded-xl border bg-muted/40 p-4">
        <VarianceLine
          series={varianceSeries}
          title="Variance over time"
          subtitle="Rolling σ for Return (R) and Pressure (P)"
        />
      </div>
    </div>
  );
}

function SummaryStatCard({
  label,
  meanR,
  meanP,
  stdR,
  stdP,
}: {
  label: string;
  meanR: number;
  meanP: number;
  stdR: number;
  stdP: number;
}) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mean</p>
          <p className="text-sm font-semibold text-foreground">R {meanR.toFixed(2)} · P {meanP.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Std dev</p>
          <p className="text-sm font-semibold text-foreground">R {stdR.toFixed(2)} · P {stdP.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
