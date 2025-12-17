"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PostureSeriesPoint, PostureTrends } from "@/lib/judgment/posture";

export type TemporalSeries = {
  label: string;
  series?: PostureSeriesPoint[];
  trends?: PostureTrends;
};

export function TemporalSeismograph({ data }: { data: TemporalSeries[] }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Temporal Seismograph</p>
          <p className="text-sm font-semibold text-foreground">R · P · S over time</p>
        </div>
        <span className="text-[11px] text-muted-foreground">Drift &amp; inflection</span>
      </div>
      <div className="mt-3 space-y-4">
        {data.map((entry) => (
          <div key={entry.label} className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{entry.label}</span>
              {entry.trends && (
                <span>
                  ΔR {formatSlope(entry.trends.slopes.R)} · ΔP {formatSlope(entry.trends.slopes.P)} · ΔS {formatSlope(entry.trends.slopes.S)}
                </span>
              )}
            </div>
            <div className="h-64 rounded-lg border bg-background/60 p-2">
              {entry.series && entry.series.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={entry.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                    <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend formatter={(value) => value.toString()} />
                    <ReferenceArea y1={1} y2={100} fill="hsl(var(--muted)/0.2)" ifOverflow="extendDomain" />
                    <Line type="monotone" dataKey="R" stroke="hsl(var(--foreground))" dot={false} name="Return" />
                    <Line type="monotone" dataKey="P" stroke="hsl(var(--primary))" dot={false} name="Pressure" />
                    <Line type="monotone" dataKey="S" stroke="hsl(var(--accent))" dot={false} name="Stability" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Not enough data to compute drift.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatSlope(value: number) {
  if (Math.abs(value) < 0.01) return "flat";
  return value > 0 ? `up ${value.toFixed(2)}` : `down ${Math.abs(value).toFixed(2)}`;
}
