"use client";

import React, { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ReferenceArea, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, Bar, BarChart } from "recharts";

import { percentile } from "@/lib/compare/stats";
import type { VelocityGoalTarget } from "@/lib/compare/types";
import type { RecoveryEvent, RecoveryPoint } from "@/lib/compare/visuals";

type RecoveryTimelineProps = {
  series: {
    id: string;
    label: string;
    color: string;
    points: RecoveryPoint[];
    events: RecoveryEvent[];
    durations: number[];
  }[];
  target: VelocityGoalTarget;
  thresholds: {
    returnLift: number;
    pressureBand: number;
    stabilityFloor: number;
    stabilityBand: number;
  };
  consecutive: number;
  title?: string;
};

export function RecoveryTimeline({ series, target, thresholds, consecutive, title }: RecoveryTimelineProps) {
  const mergedTimeline = useMemo(() => mergeSeries(series), [series]);
  const histogram = useMemo(() => buildHistogram(series.flatMap((entry) => entry.durations)), [series]);
  const summary = useMemo(() => buildSummaryStats(series.flatMap((entry) => entry.durations), consecutive), [series, consecutive]);
  const band = resolveBand(target, thresholds);

  const hasTimeline = mergedTimeline.length > 0;
  const hasHistogram = histogram.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title ?? "Recovery timeline"}</p>
          <p className="text-sm font-semibold text-foreground">Rolling target with exits + re-entries</p>
          <p className="text-[11px] text-muted-foreground">k = {consecutive} consecutive windows to be considered “recovered”.</p>
        </div>
        <p className="text-[11px] text-muted-foreground">Shaded band = target window.</p>
      </div>

      <div className="rounded-xl border bg-muted/40 p-3">
        <div className="h-72">
          {hasTimeline ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mergedTimeline} margin={{ top: 12, right: 18, bottom: 12, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                <XAxis dataKey="window" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} domain={[band.yMin, band.yMax]} />
                <RechartsTooltip content={<TimelineTooltip target={target} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {band.area && <ReferenceArea {...band.area} strokeOpacity={0} fill="hsl(var(--primary)/0.12)" ifOverflow="extendDomain" />}
                {series.flatMap((entry) =>
                  entry.events.map((event, idx) => (
                    <ReferenceArea
                      key={`${entry.id}-event-${idx}`}
                      x1={event.deviationStart}
                      x2={event.recoveredAt}
                      strokeOpacity={0}
                      fill={entry.color}
                      fillOpacity={0.14}
                      ifOverflow="extendDomain"
                    />
                  )),
                )}
                {series.map((entry) => (
                  <Area
                    key={entry.id}
                    type="monotone"
                    dataKey={`${entry.id}Value`}
                    name={`${entry.label} · rolling`}
                    stroke={entry.color}
                    fill={entry.color}
                    fillOpacity={0.12}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Need per-decision data to show recovery trace.</div>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border bg-muted/40 p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recovery time distribution</p>
              <p className="text-sm font-semibold text-foreground">Windows from exit → re-entry</p>
            </div>
            <p className="text-[11px] text-muted-foreground">Durations measured in windows.</p>
          </div>
          <div className="h-60">
            {hasHistogram ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogram} margin={{ top: 12, right: 18, bottom: 12, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                  <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <RechartsTooltip content={<HistogramTooltip />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No recovery events detected yet.</div>
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recovery stats</p>
          <div className="grid gap-2">
            <SummaryStat label="Median" value={summary.median} />
            <SummaryStat label="75th percentile" value={summary.p75} />
            <SummaryStat label={`Recovered within ${consecutive} windows`} value={summary.withinK} suffix="%" />
          </div>
        </div>
      </div>
    </div>
  );
}

function mergeSeries(series: RecoveryTimelineProps["series"]) {
  const longest = Math.max(...series.map((entry) => entry.points.length));
  const rows: Record<string, number | string | boolean>[] = [];
  for (let i = 0; i < longest; i += 1) {
    const row: Record<string, number | string | boolean> = { window: i + 1 };
    series.forEach((entry) => {
      const point = entry.points[i];
      if (point) {
        row[`${entry.id}Value`] = point.value;
        row[`${entry.id}InBand`] = point.inBand;
      }
    });
    rows.push(row);
  }
  return rows;
}
function buildHistogram(values: number[]) {
  if (!values.length) return [];
  const max = Math.max(...values);
  const bucketSize = Math.max(1, Math.ceil(max / 6));
  const buckets: { bucket: string; count: number }[] = [];
  for (let start = 0; start <= max; start += bucketSize) {
    const end = start + bucketSize - 1;
    const count = values.filter((value) => value >= start && value <= end).length;
    buckets.push({ bucket: `${start}–${end}`, count });
  }
  return buckets;
}
function buildSummaryStats(values: number[], k: number) {
  if (!values.length) return { median: 0, p75: 0, withinK: 0 };
  return {
    median: percentile(values, 50),
    p75: percentile(values, 75),
    withinK: Math.round((values.filter((value) => value <= k).length / values.length) * 100),
  };
}
function resolveBand(target: VelocityGoalTarget, thresholds: RecoveryTimelineProps["thresholds"]) {
  if (target === "RETURN_RISE") {
    const ceiling = thresholds.returnLift + 6;
    return { area: { y1: thresholds.returnLift, y2: ceiling }, yMin: thresholds.returnLift - 2, yMax: "auto" as const };
  }
  if (target === "PRESSURE_STABILIZE") {
    return { area: { y1: -thresholds.pressureBand, y2: thresholds.pressureBand }, yMin: -Math.max(3, thresholds.pressureBand * 2), yMax: Math.max(3, thresholds.pressureBand * 2) };
  }
  return { area: { y1: thresholds.stabilityFloor, y2: thresholds.stabilityFloor + thresholds.stabilityBand }, yMin: thresholds.stabilityFloor - 2, yMax: thresholds.stabilityFloor + thresholds.stabilityBand + 2 };
}
function SummaryStat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{formatNumber(value)}{suffix ?? ""}</p>
    </div>
  );
}
function TimelineTooltip({ label, payload, target }: { label?: string; payload?: { dataKey: string; value: number }[]; target: VelocityGoalTarget }) {
  if (!payload || payload.length === 0) return null;
  const entries = payload
    .filter((item) => item.dataKey?.endsWith("Value"))
    .map((item) => ({ name: item.dataKey?.replace("Value", ""), value: item.value }));
  if (!entries.length) return null;
  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-foreground">Window {label}</p>
      {entries.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-semibold text-foreground">{formatNumber(entry.value)}</span>
        </div>
      ))}
      <p className="mt-1 text-[11px] text-muted-foreground">Target: {describeTarget(target)}</p>
    </div>
  );
}
function HistogramTooltip({ payload, label }: { payload?: { value: number }[]; label?: string }) {
  if (!payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-foreground">{label} windows</p>
      <p className="text-muted-foreground">Events: {payload[0].value}</p>
    </div>
  );
}
function describeTarget(target: VelocityGoalTarget) {
  if (target === "RETURN_RISE") return "Rolling return above lift";
  if (target === "PRESSURE_STABILIZE") return "Pressure within band + stability floor";
  return "Stability within band";
}
function formatNumber(value: number) {
  if (Number.isNaN(value)) return "0";
  return Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(2);
}
