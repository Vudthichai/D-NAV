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
          subtitle="Rolling σ for R / P / S (aligned axes)"
        />
      </div>
    </div>
  );
}
