"use client";

import React, { useMemo } from "react";
import {
  CartesianGrid,
  Customized,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ScatterPoint } from "@/lib/compare/types";

export type EvidenceScatterSeries = {
  id: string;
  label: string;
  color: string;
  points: ScatterPoint[];
  centroid: { xPressure: number; yReturn: number };
  std: { pressure: number; return: number };
};

type EvidenceRPSScatterProps = {
  series: EvidenceScatterSeries[];
  height?: number;
  domain: [number, number];
  title?: string;
  subtitle?: string;
  contextLabel?: string;
};

export function EvidenceRPSScatter({ series, height = 360, domain, title, subtitle, contextLabel }: EvidenceRPSScatterProps) {
  const sampled = useMemo(
    () => series.map((entry) => ({ ...entry, points: samplePoints(entry.points, domain) })),
    [series, domain],
  );
  const hasData = sampled.some((entry) => entry.points.length > 0);

  return (
    <div className="space-y-2">
      {(title || subtitle || contextLabel) && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>}
            {subtitle && <p className="text-sm font-semibold text-foreground">{subtitle}</p>}
            {contextLabel && <p className="text-[11px] text-muted-foreground">{contextLabel}</p>}
          </div>
          <p className="text-[11px] text-muted-foreground">Pressure →, Return ↑. Centroids + variance rings included.</p>
        </div>
      )}
      <div className="h-[--chart-height] rounded-xl border bg-background/60 p-3" style={{ "--chart-height": `${height}px` } as React.CSSProperties}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 18, bottom: 12, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.25)" />
              <XAxis
                type="number"
                dataKey="xPressure"
                domain={domain}
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "Pressure (P)", position: "insideBottomRight", offset: -4, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="yReturn"
                domain={domain}
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "Return (R)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
              />
              <ReferenceLine x={0} stroke="hsl(var(--muted-foreground)/0.4)" strokeDasharray="4 4" />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground)/0.4)" strokeDasharray="4 4" />
              <QuadrantLabel x1={0} x2={domain[1]} y1={0} y2={domain[1]} label="Aggressive optionality" align="right" />
              <QuadrantLabel x1={domain[0]} x2={0} y1={0} y2={domain[1]} label="Efficient upside" />
              <QuadrantLabel x1={0} x2={domain[1]} y1={domain[0]} y2={0} label="Fragility / debt" align="right" />
              <QuadrantLabel x1={domain[0]} x2={0} y1={domain[0]} y2={0} label="Low-signal / stagnation" />
              <RechartsTooltip content={<ScatterTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 0.5 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {sampled.map((entry) => (
                <Scatter
                  key={entry.id}
                  name={entry.label}
                  data={entry.points}
                  fill={entry.color}
                  shape={entry.id === "A" ? "circle" : "triangle"}
                />
              ))}
              {sampled.map((entry) => (
                <ReferenceDot
                  key={`${entry.id}-centroid`}
                  x={entry.centroid.xPressure}
                  y={entry.centroid.yReturn}
                  r={5}
                  stroke={entry.color}
                  fill={entry.color}
                />
              ))}
              <Customized component={<VarianceEllipses series={sampled} />} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Add per-decision points to see the scatter.</div>
        )}
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
      fill="hsl(var(--muted)/0.15)"
      label={{
        value: label,
        position: align === "left" ? "insideTopLeft" : "insideTopRight",
        fill: "hsl(var(--muted-foreground))",
        fontSize: 11,
      }}
    />
  );
}

function ScatterTooltip({ payload }: { payload?: { payload: ScatterPoint }[] }) {
  if (!payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
      {point.label && <p className="mb-1 text-[11px] text-muted-foreground">{point.label}</p>}
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Return (R)</span>
        <span className="font-semibold text-foreground">{point.yReturn.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Pressure (P)</span>
        <span className="font-semibold text-foreground">{point.xPressure.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Stability (S)</span>
        <span className="font-semibold text-foreground">{point.stability.toFixed(2)}</span>
      </div>
    </div>
  );
}

function samplePoints(points: ScatterPoint[], domain: [number, number], limit = 500): ScatterPoint[] {
  if (points.length <= limit) return jitterPoints(points, domain);
  const step = Math.ceil(points.length / limit);
  return jitterPoints(points.filter((_, idx) => idx % step === 0), domain);
}

function jitterPoints(points: ScatterPoint[], domain: [number, number]): ScatterPoint[] {
  return points.map((point, idx) => {
    const jitter = (Math.sin(idx) + Math.cos(idx * 1.3)) * 0.1;
    return {
      ...point,
      xPressure: clamp(point.xPressure + jitter, domain),
      yReturn: clamp(point.yReturn - jitter, domain),
    };
  });
}

function clamp(value: number, [min, max]: [number, number]) {
  return Math.min(max, Math.max(min, value));
}

function VarianceEllipses({
  series,
  xAxisMap,
  yAxisMap,
}: {
  series: EvidenceScatterSeries[];
  xAxisMap?: Record<string, { scale: (value: number) => number }>;
  yAxisMap?: Record<string, { scale: (value: number) => number }>;
}) {
  const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : null;
  const yAxis = yAxisMap ? Object.values(yAxisMap)[0] : null;
  if (!xAxis || !yAxis) return null;

  return (
    <g>
      {series.map((entry) => {
        const cx = xAxis.scale(entry.centroid.xPressure);
        const cy = yAxis.scale(entry.centroid.yReturn);
        const rx = Math.abs(xAxis.scale(entry.centroid.xPressure + entry.std.pressure) - cx);
        const ry = Math.abs(yAxis.scale(entry.centroid.yReturn + entry.std.return) - cy);
        return (
          <ellipse
            key={`${entry.id}-variance`}
            cx={cx}
            cy={cy}
            rx={Math.max(6, rx)}
            ry={Math.max(6, ry)}
            fill={entry.color}
            fillOpacity={0.08}
            stroke={entry.color}
            strokeOpacity={0.4}
          />
        );
      })}
    </g>
  );
}

VarianceEllipses.displayName = "VarianceEllipses";
