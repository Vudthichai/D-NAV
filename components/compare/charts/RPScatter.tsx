"use client";

import React, { useMemo } from "react";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ScatterPoint = { x: number; y: number; label?: string };

type RPScatterProps = {
  a: { label: string; points: ScatterPoint[]; color?: string };
  b: { label: string; points: ScatterPoint[]; color?: string };
  height?: number;
};

const DOMAIN: [number, number] = [-9, 9];

export function RPScatter({ a, b, height = 320 }: RPScatterProps) {
  const sampledA = useMemo(() => samplePoints(a.points), [a.points]);
  const sampledB = useMemo(() => samplePoints(b.points), [b.points]);
  const hasData = sampledA.length > 0 || sampledB.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Return vs Pressure (Tradeoff Scatter)</p>
          <p className="text-sm font-semibold text-foreground">Overlay of per-decision R/P points</p>
          <p className="text-xs text-muted-foreground">Quadrants show where return is earned and how much pressure it costs.</p>
        </div>
        <DefinitionTooltip
          term="Tradeoff coupling"
          definition="Relationship between Return and Pressure — how much pressure is “paid” for the return. Tight coupling means rising returns also raise pressure."
        />
      </div>
      <div className="h-[--chart-height] rounded-xl border bg-background/60 p-3" style={{ "--chart-height": `${height}px` } as React.CSSProperties}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 18, bottom: 12, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.25)" />
              <XAxis
                type="number"
                dataKey="x"
                domain={DOMAIN}
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "Pressure (P)", position: "insideBottomRight", offset: -4, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={DOMAIN}
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "Return (R)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
              />
              <ReferenceLine x={0} stroke="hsl(var(--muted-foreground)/0.45)" strokeDasharray="4 4" />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground)/0.45)" strokeDasharray="4 4" />
              <QuadrantLabel x1={0} x2={DOMAIN[1]} y1={0} y2={DOMAIN[1]} label="Aggressive optionality" />
              <QuadrantLabel x1={0} x2={DOMAIN[1]} y1={DOMAIN[0]} y2={0} label="Compounding zone" />
              <QuadrantLabel x1={DOMAIN[0]} x2={0} y1={DOMAIN[0]} y2={0} label="Debt / fragility" />
              <QuadrantLabel x1={DOMAIN[0]} x2={0} y1={0} y2={DOMAIN[1]} label="Pressure buying options" align="right" />
              <RechartsTooltip content={<ScatterTooltip />} />
              <Scatter name={a.label} data={sampledA} fill={a.color ?? "hsl(var(--primary))"} shape="circle" />
              <Scatter name={b.label} data={sampledB} fill={b.color ?? "hsl(var(--accent))"} shape="triangle" />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Insufficient data for scatter. Add per-decision R/P points to see the tradeoff.
          </div>
        )}
      </div>
      <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
        <p>Mean (average): where the dataset tends to live on the -9..+9 lattice.</p>
        <p>Variance / volatility: how tightly points cluster around the mean. Consolidation = mean improves while variance contracts; Thrash = mean improves while variance stays high.</p>
      </div>
    </div>
  );
}

function QuadrantLabel({
  x1,
  x2,
  y1,
  y2,
  label,
  align = "left",
}: {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  label: string;
  align?: "left" | "right";
}) {
  return (
    <ReferenceArea
      x1={x1}
      x2={x2}
      y1={y1}
      y2={y2}
      fill="transparent"
      label={{
        value: label,
        position: align === "left" ? "insideTopLeft" : "insideTopRight",
        fill: "hsl(var(--muted-foreground))",
        fontSize: 11,
      }}
    />
  );
}

function ScatterTooltip({
  payload,
}: {
  payload?: { name: string; value: number; payload: ScatterPoint }[];
}) {
  if (!payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Return (R)</span>
        <span className="font-semibold text-foreground">{point.y.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Pressure (P)</span>
        <span className="font-semibold text-foreground">{point.x.toFixed(2)}</span>
      </div>
      {point.label && <p className="mt-1 text-[11px] text-muted-foreground">{point.label}</p>}
    </div>
  );
}

function samplePoints(points: ScatterPoint[], limit = 500): ScatterPoint[] {
  if (points.length <= limit) return jitterPoints(points);
  const step = Math.ceil(points.length / limit);
  return jitterPoints(points.filter((_, idx) => idx % step === 0));
}

function jitterPoints(points: ScatterPoint[]): ScatterPoint[] {
  return points.map((point, idx) => {
    const jitter = (Math.sin(idx) + Math.cos(idx * 1.3)) * 0.1;
    return { ...point, x: clamp(point.x + jitter, DOMAIN), y: clamp(point.y - jitter, DOMAIN) };
  });
}

function clamp(value: number, [min, max]: [number, number]) {
  return Math.min(max, Math.max(min, value));
}

function DefinitionTooltip({ term, definition }: { term: string; definition: string }) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground"
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
