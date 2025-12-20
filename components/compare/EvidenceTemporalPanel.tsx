"use client";

import React from "react";
import { EvidenceRPSScatter, type EvidenceScatterSeries } from "@/components/compare/EvidenceRPSScatter";

export type EvidenceTemporalPanelProps = {
  scatterA: EvidenceScatterSeries;
  scatterB: EvidenceScatterSeries;
  scatterDomain: [number, number];
  sequenceMode?: boolean;
};

export function EvidenceTemporalPanel({ scatterA, scatterB, scatterDomain, sequenceMode }: EvidenceTemporalPanelProps) {
  const contextLabel = sequenceMode ? "Sequence Mode: index-based ordering" : undefined;

  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <EvidenceRPSScatter
        series={[scatterA, scatterB]}
        domain={scatterDomain}
        title="Return vs Pressure"
        subtitle="Period A vs Period B"
        contextLabel={contextLabel}
        height={380}
      />
    </div>
  );
}
