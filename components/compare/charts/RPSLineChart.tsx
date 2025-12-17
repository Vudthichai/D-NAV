"use client";

import React from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { RPSLineSeries } from "@/lib/compare/types";

const metricLabels: Record<"R" | "P" | "S", string> = {
  R: "Return",
  P: "Pressure",
  S: "Stability",
};

const basePalette = {
  R: "hsl(var(--foreground))",
  P: "hsl(var(--primary))",
  S: "hsl(var(--accent))",
};

const overlayPalette = {
  R: "hsl(var(--foreground)/0.55)",
  P: "hsl(var(--primary)/0.55)",
  S: "hsl(var(--accent)/0.55)",
};

type ChartDatum = Record<string, string | number> & { x: string | number; order: number };

type Props = {
  title?: string;
  series: RPSLineSeries[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
};

export function RPSLineChart({ title, series, xLabel, yLabel, height = 260 }: Props) {
  const mergedData = mergeSeries(series);

  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <div className="h-[--chart-height] rounded-lg border bg-background/60 p-2" style={{ "--chart-height": `${height}px` } as React.CSSProperties}>
        {mergedData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
              <XAxis
                dataKey="x"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={xLabel ? { value: xLabel, position: "insideBottomRight", offset: -6, fontSize: 11 } : undefined}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", offset: 10, fontSize: 11 } : undefined}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((entry, idx) => {
                const palette = idx === 0 ? basePalette : overlayPalette;
                return (Object.keys(metricLabels) as (keyof typeof metricLabels)[]).map((metric) => (
                  <Line
                    key={`${entry.id}-${metric}`}
                    type="monotone"
                    dataKey={`${metric}-${entry.id}`}
                    stroke={palette[metric]}
                    dot={false}
                    name={`${entry.label} · ${metricLabels[metric]}`}
                    strokeWidth={1.8}
                    isAnimationActive={false}
                  />
                ));
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Not enough data to render.</div>
        )}
      </div>
    </div>
  );
}

function mergeSeries(series: RPSLineSeries[]): Omit<ChartDatum, "order">[] {
  const merged = new Map<string, ChartDatum>();

  series.forEach((entry) => {
    entry.data.forEach((point, idx) => {
      const key = `${point.x}`;
      const resolvedOrder = typeof point.x === "number" ? point.x : Number.isNaN(Date.parse(point.x)) ? idx : Date.parse(point.x);
      const baseline = merged.get(key) ?? { x: point.x, order: resolvedOrder };
      merged.set(key, {
        ...baseline,
        [`R-${entry.id}`]: point.R,
        [`P-${entry.id}`]: point.P,
        [`S-${entry.id}`]: point.S,
      });
    });
  });

  return Array.from(merged.values())
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...rest }) => {
      void order;
      return rest;
    });
}

function ChartTooltip({ label, payload }: { label?: string | number; payload?: { name: string; value: number }[] }) {
  if (!payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <div className="space-y-1 text-muted-foreground">
        {payload
          .filter((item) => typeof item.value === "number")
          .map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-6">
              <span>{item.name}</span>
              <span className="font-semibold text-foreground">{Number(item.value).toFixed(2)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
