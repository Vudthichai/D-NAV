"use client";

import React from "react";
import { Info } from "lucide-react";

import { describeVolatility, mean, std } from "@/lib/compare/stats";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DistributionStripProps = {
  label: string;
  valuesA: number[];
  valuesB: number[];
  colorA?: string;
  colorB?: string;
  labelA?: string;
  labelB?: string;
};

const DOMAIN: [number, number] = [-9, 9];

export function DistributionStrip({ label, valuesA, valuesB, colorA, colorB, labelA = "A", labelB = "B" }: DistributionStripProps) {
  const statsA = buildStats(valuesA);
  const statsB = buildStats(valuesB);
  const hasData = valuesA.length > 0 || valuesB.length > 0;
  const showB = valuesB.length > 0;

  return (
    <div className="space-y-2 rounded-lg border bg-background/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <DefinitionTooltip
          term="Variance / steadiness"
          definition="Variance (volatility) measures how tightly points cluster around the mean. Lower variance = steadier judgment; high variance = chaotic swings."
        />
      </div>
      {hasData ? (
        <div className="relative h-14 overflow-hidden rounded-md border bg-muted/50">
          <AxisGuides />
          {statsA.mean !== null && <VarianceBand mean={statsA.mean} std={statsA.std} color={colorA ?? "hsl(var(--primary))"} verticalOffset="30%" />}
          {showB && statsB.mean !== null && <VarianceBand mean={statsB.mean} std={statsB.std} color={colorB ?? "hsl(var(--accent))"} verticalOffset="68%" />}
          <PointRow values={valuesA} color={colorA ?? "hsl(var(--primary))"} verticalOffset="35%" label={labelA} />
          {showB && <PointRow values={valuesB} color={colorB ?? "hsl(var(--accent))"} verticalOffset="73%" label={labelB} />}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Not enough data to show distribution.</p>
      )}
      <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{labelA} — μ {formatNumber(statsA.mean)} · σ {formatNumber(statsA.std)}</span>
          <span>{describeVolatility(statsA.std)} spread.</span>
        </div>
        {showB && (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{labelB} — μ {formatNumber(statsB.mean)} · σ {formatNumber(statsB.std)}</span>
            <span>{describeVolatility(statsB.std)} spread.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AxisGuides() {
  return (
    <>
      <div className="absolute inset-y-0 left-[50%] w-px bg-muted" />
      <div className="absolute inset-x-1 top-1 flex justify-between text-[10px] text-muted-foreground">
        <span>-9</span>
        <span>0</span>
        <span>+9</span>
      </div>
    </>
  );
}

function PointRow({
  values,
  color,
  verticalOffset,
  label,
}: {
  values: number[];
  color: string;
  verticalOffset: string;
  label: string;
}) {
  if (!values.length) return null;
  return (
    <div className="absolute left-2 right-2" style={{ top: verticalOffset }}>
      <div className="relative h-4">
        {values.slice(0, 200).map((value, idx) => (
          <span
            key={`${label}-${idx}`}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${toPercent(value)}%`,
              backgroundColor: color,
              opacity: 0.75,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function VarianceBand({ mean, std, color, verticalOffset }: { mean: number | null; std: number; color: string; verticalOffset: string }) {
  if (mean === null) return null;
  const lower = toPercent(mean - std);
  const upper = toPercent(mean + std);
  return (
    <div className="absolute left-2 right-2" style={{ top: verticalOffset }}>
      <div
        className="absolute h-6 -translate-y-1/2 rounded-md opacity-30"
        style={{ left: `${lower}%`, right: `${100 - upper}%`, backgroundColor: color }}
      />
      <span
        className="absolute h-3 w-[2px] -translate-x-1/2 rounded-sm"
        style={{ left: `${toPercent(mean)}%`, backgroundColor: color }}
        aria-label="Mean marker"
      />
    </div>
  );
}

function buildStats(values: number[]) {
  if (!values.length) return { mean: null as number | null, std: 0 };
  return { mean: mean(values), std: std(values) };
}

function toPercent(value: number) {
  const clamped = Math.min(DOMAIN[1], Math.max(DOMAIN[0], value));
  return ((clamped - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * 100;
}

function formatNumber(value: number | null) {
  if (value === null) return "–";
  return Math.abs(value - Math.round(value)) < 0.01 ? value.toFixed(0) : value.toFixed(2);
}

function DefinitionTooltip({ term, definition }: { term: string; definition: string }) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground"
            aria-label={`${term} definition`}
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs" side="left">
          <p className="font-semibold text-foreground">{term}</p>
          <p className="text-muted-foreground">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
