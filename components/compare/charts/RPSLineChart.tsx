"use client";

import React from "react";
import { Area, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { RPSLineSeries } from "@/lib/compare/types";
import { rollingMean, rollingStd } from "@/lib/compare/stats";

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
  showVariance?: boolean;
  rollingWindow?: number;
};

export function RPSLineChart({ title, series, xLabel, yLabel, height = 260, showVariance = false, rollingWindow = 5 }: Props) {
  const mergedData = mergeSeries(series, { showVariance, rollingWindow });

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
              {showVariance && series.length === 1 && (
                (Object.keys(metricLabels) as (keyof typeof metricLabels)[]).map((metric) => (
                  <React.Fragment key={`variance-${metric}`}>
                    <Area
                      type="monotone"
                      dataKey={`${metric}-${series[0]!.id}-upper`}
                      stroke="none"
                      fill={overlayPalette[metric]}
                      fillOpacity={0.12}
                      activeDot={false}
                      isAnimationActive={false}
                      legendType="none"
                    />
                    <Area
                      type="monotone"
                      dataKey={`${metric}-${series[0]!.id}-lower`}
                      stroke="none"
                      fill={overlayPalette[metric]}
                      fillOpacity={0.12}
                      activeDot={false}
                      isAnimationActive={false}
                      legendType="none"
                    />
                    <Line
                      type="monotone"
                      dataKey={`${metric}-${series[0]!.id}-mean`}
                      stroke={overlayPalette[metric]}
                      strokeDasharray="5 4"
                      dot={false}
                      name={`${metricLabels[metric]} rolling mean`}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                  </React.Fragment>
                ))
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Not enough data to render.</div>
        )}
      </div>
    </div>
  );
}

function mergeSeries(series: RPSLineSeries[], options?: { showVariance?: boolean; rollingWindow?: number }): Omit<ChartDatum, "order">[] {
  const merged = new Map<string, ChartDatum>();

  series.forEach((entry) => {
    const stats = options?.showVariance && series.length === 1 ? buildRollingStats(entry.data, options?.rollingWindow ?? 5) : null;
    entry.data.forEach((point, idx) => {
      const key = `${point.x}`;
      const resolvedOrder = typeof point.x === "number" ? point.x : Number.isNaN(Date.parse(point.x)) ? idx : Date.parse(point.x);
      const baseline = merged.get(key) ?? { x: point.x, order: resolvedOrder };
      merged.set(key, {
        ...baseline,
        [`R-${entry.id}`]: point.R,
        [`P-${entry.id}`]: point.P,
        [`S-${entry.id}`]: point.S,
        ...(stats
          ? {
              [`R-${entry.id}-mean`]: stats[idx]?.R?.mean,
              [`R-${entry.id}-upper`]: stats[idx]?.R?.upper,
              [`R-${entry.id}-lower`]: stats[idx]?.R?.lower,
              [`P-${entry.id}-mean`]: stats[idx]?.P?.mean,
              [`P-${entry.id}-upper`]: stats[idx]?.P?.upper,
              [`P-${entry.id}-lower`]: stats[idx]?.P?.lower,
              [`S-${entry.id}-mean`]: stats[idx]?.S?.mean,
              [`S-${entry.id}-upper`]: stats[idx]?.S?.upper,
              [`S-${entry.id}-lower`]: stats[idx]?.S?.lower,
            }
          : {}),
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
          .filter((item) => typeof item.value === "number" && !item.name?.includes("upper") && !item.name?.includes("lower"))
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

function buildRollingStats(
  data: RPSLineSeries["data"],
  window: number,
): { R: { mean: number; upper: number; lower: number }; P: { mean: number; upper: number; lower: number }; S: { mean: number; upper: number; lower: number } }[] {
  const rValues = data.map((point) => point.R);
  const pValues = data.map((point) => point.P);
  const sValues = data.map((point) => point.S);
  const rMean = rollingMean(rValues, window);
  const pMean = rollingMean(pValues, window);
  const sMean = rollingMean(sValues, window);
  const rStd = rollingStd(rValues, window);
  const pStd = rollingStd(pValues, window);
  const sStd = rollingStd(sValues, window);

  return data.map((_, idx) => ({
    R: { mean: rMean[idx] ?? 0, upper: (rMean[idx] ?? 0) + (rStd[idx] ?? 0), lower: (rMean[idx] ?? 0) - (rStd[idx] ?? 0) },
    P: { mean: pMean[idx] ?? 0, upper: (pMean[idx] ?? 0) + (pStd[idx] ?? 0), lower: (pMean[idx] ?? 0) - (pStd[idx] ?? 0) },
    S: { mean: sMean[idx] ?? 0, upper: (sMean[idx] ?? 0) + (sStd[idx] ?? 0), lower: (sMean[idx] ?? 0) - (sStd[idx] ?? 0) },
  }));
}
