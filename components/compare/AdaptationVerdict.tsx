"use client";

import { buildAdaptationVerdict } from "@/lib/adaptationVerdict";

type AdaptationVerdictProps = {
  hasPrevious: boolean;
  returnDelta: number;
  pressureDelta: number;
  stabilityDelta: number;
};

export function AdaptationVerdict({
  hasPrevious,
  returnDelta,
  pressureDelta,
  stabilityDelta,
}: AdaptationVerdictProps) {
  const verdict = buildAdaptationVerdict({
    hasPrevious,
    returnDelta,
    pressureDelta,
    stabilityDelta,
  });

  return (
    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Adaptation Verdict</p>
        <p className="text-sm text-muted-foreground">{verdict}</p>
      </div>
    </div>
  );
}
