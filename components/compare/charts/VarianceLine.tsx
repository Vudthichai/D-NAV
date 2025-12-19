"use client";

import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RPSLineSeries } from "@/lib/compare/types";
import { percentile } from "@/lib/compare/stats";

type VarianceLineProps = {
  series: (RPSLineSeries & { color?: string })[];
  height?: number;
  title?: string;
  subtitle?: string;
};

const metricPalette: Record<"R" | "P", string> = {
  R: "hsl(var(--foreground))",
  P: "hsl(var(--primary))",
};

export function VarianceLine({ series, height = 280, title, subtitle }: VarianceLineProps) {
  const hasData = series.some((entry) => entry.data.length > 0);
  const medianSigma = React.useMemo(() => {
    const values = series.flatMap((entry) => entry.data.flatMap((point) => [point.R, point.P])).filter(Number.isFinite);
    if (values.length === 0) return null;
    return percentile(values, 50);
  }, [series]);

  return (
    <div className="space-y-2">
      {(title || subtitle) && (
        <div className="flex items-start justify-between gap-2">
          <div>
            {title && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>}
            {subtitle && <p className="text-sm font-semibold text-foreground">{subtitle}</p>}
          </div>
          <p className="text-[11px] text-muted-foreground">Rolling σ for Return and Pressure.</p>
        </div>
      )}
      <div className="h-[--chart-height] rounded-xl border bg-background/60 p-3" style={{ "--chart-height": `${height}px` } as React.CSSProperties}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 12, right: 18, bottom: 12, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
              <XAxis dataKey="x" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} domain={[0, "auto"]} />
              <RechartsTooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {medianSigma !== null && (
                <ReferenceLine
                  y={medianSigma}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  label={{ value: "Median σ", position: "insideTopRight", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
              )}
              {series.map((entry) => (
                <React.Fragment key={entry.id}>
                  <Line
                    type="monotone"
                    data={entry.data}
                    dataKey="R"
                    stroke={metricPalette.R}
                    dot={false}
                    name={`${entry.label} · Return σ`}
                    strokeWidth={2}
                    strokeDasharray={entry.id === "B" ? "4 2" : "none"}
                  />
                  <Line
                    type="monotone"
                    data={entry.data}
                    dataKey="P"
                    stroke={metricPalette.P}
                    dot={false}
                    name={`${entry.label} · Pressure σ`}
                    strokeWidth={2}
                    strokeDasharray={entry.id === "B" ? "4 2" : "none"}
                  />
                </React.Fragment>
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Need per-decision data to compute rolling variance.</div>
        )}
      </div>
    </div>
  );
}
