"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import {
  CONSISTENCY_STD_THRESHOLDS,
  SIGNAL_DELTA_THRESHOLD,
  formatPP,
  formatPct,
  type ConsistencyLabel,
} from "@/lib/adaptation";
import type { DispersionStats } from "@/lib/compare/adaptation";
import { getDeltaDirection } from "@/lib/compare/adaptation";
import { buildAdaptationCopy } from "@/lib/adaptationCopy";

export type AdaptationSummaryTilesProps = {
  hasPrevious: boolean;
  returnDelta: number;
  pressureDelta: number;
  stabilityDelta: number;
  returnShare: number;
  pressureShare: number;
  stabilityShare: number;
  consistencyLabel: ConsistencyLabel;
  dispersion: DispersionStats;
  previousDispersion: DispersionStats;
  windowSize: number;
  recentCount: number;
};

export function AdaptationSummaryTiles({
  hasPrevious,
  returnDelta,
  pressureDelta,
  stabilityDelta,
  returnShare,
  pressureShare,
  stabilityShare,
  consistencyLabel,
  dispersion,
  previousDispersion,
  windowSize,
  recentCount,
}: AdaptationSummaryTilesProps) {
  const signalLabel = buildSignalLabel(hasPrevious, returnDelta);
  const pressureDeltaLabel = `Δ ${hasPrevious ? formatPP(pressureDelta) : "—"}`;
  const stabilityDeltaLabel = `Δ ${hasPrevious ? formatPP(stabilityDelta) : "—"}`;
  const signalDeltaLabel = hasPrevious ? formatPP(returnDelta) : "—";
  const consistencyDelta = computeDelta(dispersion.stddev, previousDispersion.stddev);
  const consistencyDeltaLabel = hasPrevious ? formatDelta(consistencyDelta) : "—";
  const windowLabel = resolveWindowLabel(windowSize, recentCount);
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
      spread: dispersion.stddev ?? undefined,
      rangeMin: dispersion.min ?? undefined,
      rangeMax: dispersion.max ?? undefined,
    },
  });

  return (
    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Summary · last {windowLabel} decisions
          </p>
          <p className="text-xs text-muted-foreground">{copy.headlineSummary}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SignalTile
            label="Signal"
            value={signalLabel}
            shareLabel={formatPct(returnShare)}
            deltaLabel={signalDeltaLabel}
          />
          <ConsistencyTile
            label="Consistency"
            value={consistencyLabel}
            dispersion={dispersion}
            deltaLabel={consistencyDeltaLabel}
            helperText="Repeatability reflects how consistent your judgment is — not whether it was correct."
          />
          <SummaryTile
            label="Pressure load"
            value={formatPct(pressureShare)}
            subLabel={pressureDeltaLabel}
            infoContent="Pressure-positive share in this window; delta vs previous."
          />
          <SummaryTile
            label="Stability share"
            value={formatPct(stabilityShare)}
            subLabel={stabilityDeltaLabel}
            infoContent="Stability-positive share in this window; delta vs previous."
          />
        </div>
      </div>
    </div>
  );
}

function buildSignalLabel(hasPrevious: boolean, delta: number) {
  if (!hasPrevious) return "—";
  const direction = getDeltaDirection(delta, SIGNAL_DELTA_THRESHOLD);
  if (direction === "up") return "↑ Stronger";
  if (direction === "down") return "↓ Weaker";
  return "→ Flat";
}

type SummaryTileProps = {
  label: string;
  value: string;
  subLabel?: string;
  infoContent?: string;
};

function SummaryTile({ label, value, subLabel, infoContent }: SummaryTileProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-background/70 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {infoContent ? (
          <InfoButton label={`${label} details`} isOpen={open} onToggle={() => setOpen((prev) => !prev)} />
        ) : null}
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {subLabel ? <p className="text-[11px] text-muted-foreground">{subLabel}</p> : null}
      {open && infoContent ? (
        <div className="mt-2 rounded-md border bg-muted/40 p-2 text-[11px] text-muted-foreground">
          {infoContent}
        </div>
      ) : null}
    </div>
  );
}

type SignalTileProps = {
  label: string;
  value: string;
  shareLabel: string;
  deltaLabel: string;
};

function SignalTile({ label, value, shareLabel, deltaLabel }: SignalTileProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-background/70 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <InfoButton label="Signal details" isOpen={open} onToggle={() => setOpen((prev) => !prev)} />
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">Positive Return: {shareLabel}</p>
      <p className="text-[11px] text-muted-foreground">Δ {deltaLabel}</p>
      {open ? (
        <div className="mt-2 rounded-md border bg-muted/40 p-2 text-[11px] text-muted-foreground">
          Positive Return share in this window; delta vs previous.
          <br />
          Threshold: {formatPP(SIGNAL_DELTA_THRESHOLD)}.
        </div>
      ) : null}
    </div>
  );
}

type ConsistencyTileProps = {
  label: string;
  value: ConsistencyLabel;
  dispersion: DispersionStats;
  deltaLabel: string;
  helperText: string;
};

function ConsistencyTile({ label, value, dispersion, deltaLabel, helperText }: ConsistencyTileProps) {
  const [open, setOpen] = useState(false);
  const spreadLabel = formatNumber(dispersion.stddev);
  const rangeLabel = formatRange(dispersion.min, dispersion.max);
  const meaning = getConsistencyMeaning(value);

  return (
    <div className="rounded-xl border bg-background/70 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <InfoButton
          label="Consistency details"
          isOpen={open}
          onToggle={() => setOpen((prev) => !prev)}
        />
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{meaning}</p>
      <p className="text-[11px] text-muted-foreground">{helperText}</p>
      <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
        <p>Spread σ: {spreadLabel}</p>
        <p>Range: {rangeLabel}</p>
        <p>Δσ: {deltaLabel}</p>
      </div>
      {open ? (
        <div className="mt-2 rounded-md border bg-muted/40 p-2 text-[11px] text-muted-foreground">
          Dispersion (std dev) of D-NAV within this window; thresholds: Tight ≤ {CONSISTENCY_STD_THRESHOLDS.tight},
          Moderate ≤ {CONSISTENCY_STD_THRESHOLDS.moderate}, Volatile &gt; {CONSISTENCY_STD_THRESHOLDS.moderate}.
        </div>
      ) : null}
    </div>
  );
}

type InfoButtonProps = {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
};

function InfoButton({ label, isOpen, onToggle }: InfoButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={isOpen}
      className="rounded-full border border-muted bg-background/70 p-1 text-muted-foreground transition hover:text-foreground"
    >
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

function getConsistencyMeaning(label: ConsistencyLabel): string {
  if (label === "Tight") return "Scores cluster tightly.";
  if (label === "Moderate") return "Some swing, mostly steady.";
  if (label === "Volatile") return "Large swings between decisions.";
  return "—";
}

function formatNumber(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatRange(min: number | null, max: number | null): string {
  if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max)) return "—";
  return `${min.toFixed(1)} → ${max.toFixed(1)}`;
}

function formatDelta(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const formatted = Math.abs(value).toFixed(digits);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

function computeDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

function resolveWindowLabel(windowSize: number, recentCount: number): string {
  if (windowSize <= 0) return `${recentCount}`;
  return `${Math.min(windowSize, recentCount)}`;
}
