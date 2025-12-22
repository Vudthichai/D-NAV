"use client";

import { SIGNAL_DELTA_THRESHOLD, type ConsistencyLabel } from "@/lib/adaptation";
import { formatDeltaPp, formatPercent, getDeltaDirection } from "@/lib/compare/adaptation";

export type AdaptationSummaryTilesProps = {
  hasPrevious: boolean;
  returnDelta: number;
  pressureDelta: number;
  stabilityDelta: number;
  pressureShare: number;
  stabilityShare: number;
  consistencyLabel: ConsistencyLabel;
};

export function AdaptationSummaryTiles({
  hasPrevious,
  returnDelta,
  pressureDelta,
  stabilityDelta,
  pressureShare,
  stabilityShare,
  consistencyLabel,
}: AdaptationSummaryTilesProps) {
  const signalLabel = buildSignalLabel(hasPrevious, returnDelta);
  const pressureDeltaLabel = hasPrevious ? `Δ ${formatDeltaPp(pressureDelta)}` : undefined;
  const stabilityDeltaLabel = hasPrevious ? `Δ ${formatDeltaPp(stabilityDelta)}` : undefined;

  return (
    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Adaptation Summary</p>
          <p className="text-xs text-muted-foreground">Signal, consistency, and load</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Signal" value={signalLabel} />
          <SummaryTile label="Consistency" value={consistencyLabel} />
          <SummaryTile
            label="Pressure load"
            value={formatPercent(pressureShare)}
            subLabel={pressureDeltaLabel}
          />
          <SummaryTile
            label="Stability share"
            value={formatPercent(stabilityShare)}
            subLabel={stabilityDeltaLabel}
          />
        </div>
      </div>
    </div>
  );
}

function buildSignalLabel(hasPrevious: boolean, delta: number) {
  if (!hasPrevious) return "—";
  const direction = getDeltaDirection(delta, SIGNAL_DELTA_THRESHOLD);
  if (direction === "up") return "↑ Stronger signal";
  if (direction === "down") return "↓ Weaker signal";
  return "→ Flat signal";
}

type SummaryTileProps = {
  label: string;
  value: string;
  subLabel?: string;
};

function SummaryTile({ label, value, subLabel }: SummaryTileProps) {
  return (
    <div className="rounded-xl border bg-background/70 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {subLabel ? <p className="text-[11px] text-muted-foreground">{subLabel}</p> : null}
    </div>
  );
}
