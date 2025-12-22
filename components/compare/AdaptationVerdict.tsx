"use client";

import type { ConsistencyLabel } from "@/lib/adaptation";
import { buildAdaptationCopy } from "@/lib/adaptation/copy";

type AdaptationVerdictProps = {
  hasPrevious: boolean;
  returnDelta: number;
  pressureDelta: number;
  stabilityDelta: number;
  returnShare: number;
  pressureShare: number;
  stabilityShare: number;
  consistencyLabel: ConsistencyLabel;
};

export function AdaptationVerdict({
  hasPrevious,
  returnDelta,
  pressureDelta,
  stabilityDelta,
  returnShare,
  pressureShare,
  stabilityShare,
  consistencyLabel,
}: AdaptationVerdictProps) {
  const copy = buildAdaptationCopy({
    hasPreviousWindow: hasPrevious,
    deltas: {
      returnPosPP: hasPrevious ? returnDelta : null,
      pressurePressuredPP: hasPrevious ? pressureDelta : null,
      stabilityStablePP: hasPrevious ? stabilityDelta : null,
    },
    levels: {
      returnPosPct: returnShare,
      pressurePressuredPct: pressureShare,
      stabilityStablePct: stabilityShare,
    },
    consistency: {
      label: consistencyLabel,
    },
  });

  return (
    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Adaptation Verdict</p>
        <p className="text-sm text-muted-foreground">{copy.verdict}</p>
      </div>
    </div>
  );
}
