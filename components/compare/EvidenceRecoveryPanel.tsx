"use client";

import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { percentile } from "@/lib/compare/stats";
import type { VelocityGoalTarget } from "@/lib/compare/types";
import type { RecoveryEvent, RecoveryPoint } from "@/lib/compare/visuals";
import { formatNumber } from "@/lib/compare/evidence";

export type EvidenceRecoverySeries = {
  id: string;
  label: string;
  color: string;
  points: RecoveryPoint[];
  events: RecoveryEvent[];
  durations: number[];
};

type EvidenceRecoveryPanelProps = {
  series: EvidenceRecoverySeries[];
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

export function EvidenceRecoveryPanel({ series, target, thresholds, consecutive, title }: EvidenceRecoveryPanelProps) {
  const mergedTimeline = useMemo(() => mergeSeries(series), [series]);
  const histogram = useMemo(() => buildHistogram(series), [series]);
  const summary = useMemo(() => buildSummaryStats(series, consecutive), [series, consecutive]);
  const band = resolveBand(target, thresholds);

  const hasTimeline = mergedTimeline.length > 0;
  const hasHistogram = histogram.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title ?? "Recovery & adaptation"}</p>
            <p className="text-sm font-semibold text-foreground">Time to re-enter stability band</p>
            <p className="text-[11px] text-muted-foreground">k = {consecutive} consecutive windows to be counted as recovered.</p>
          </div>
          <div className="grid gap-2 text-xs">
            <TopStat label="Median recovery" value={summary.median} />
            <TopStat label="75th percentile" value={summary.p75} />
            <TopStat label={`Recovered within ${consecutive}`} value={summary.withinK} suffix="%" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recovery timeline</p>
        <p className="text-sm font-semibold text-foreground">Rolling value vs target band</p>
        <div className="mt-3 h-72">
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

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recovery distribution</p>
        <p className="text-sm font-semibold text-foreground">How many decisions to re-enter the band</p>
        <div className="mt-3 h-60">
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
    </div>
  );
}

function mergeSeries(series: EvidenceRecoverySeries[]) {
  const longest = Math.max(0, ...series.map((entry) => entry.points.length));
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

function buildHistogram(series: EvidenceRecoverySeries[]) {
  const values = series.flatMap((entry) => entry.durations);
  if (!values.length) return [] as { bucket: string; count: number }[];
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

function buildSummaryStats(series: EvidenceRecoverySeries[], k: number) {
  const values = series.flatMap((entry) => entry.durations);
  if (!values.length) return { median: 0, p75: 0, withinK: 0 };
  return {
    median: percentile(values, 50),
    p75: percentile(values, 75),
    withinK: Math.round((values.filter((value) => value <= k).length / values.length) * 100),
  };
}

function resolveBand(target: VelocityGoalTarget, thresholds: EvidenceRecoveryPanelProps["thresholds"]) {
  if (target === "RETURN_RISE") {
    const ceiling = thresholds.returnLift + 6;
    return { area: { y1: thresholds.returnLift, y2: ceiling }, yMin: thresholds.returnLift - 2, yMax: "auto" as const };
  }
  if (target === "PRESSURE_STABILIZE") {
    return {
      area: { y1: -thresholds.pressureBand, y2: thresholds.pressureBand },
      yMin: -Math.max(3, thresholds.pressureBand * 2),
      yMax: Math.max(3, thresholds.pressureBand * 2),
    };
  }
  return {
    area: { y1: thresholds.stabilityFloor, y2: thresholds.stabilityFloor + thresholds.stabilityBand },
    yMin: thresholds.stabilityFloor - 2,
    yMax: thresholds.stabilityFloor + thresholds.stabilityBand + 2,
  };
}

function TopStat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border bg-background/60 px-2 py-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatNumber(value)}{suffix ?? ""}</p>
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
      <p className="font-semibold text-foreground">{label} decisions</p>
      <p className="text-muted-foreground">Events: {payload[0].value}</p>
    </div>
  );
}

function describeTarget(target: VelocityGoalTarget) {
  if (target === "RETURN_RISE") return "Rolling return above lift";
  if (target === "PRESSURE_STABILIZE") return "Pressure within band + stability floor";
  return "Stability within band";
}
