"use client";

import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type TemporalTrajectoryPoint = {
  xIndex: number;
  return: number;
  pressure: number;
  stability: number;
  dnav: number;
};

type TemporalTrajectoryPanelProps = {
  data: TemporalTrajectoryPoint[];
  windowSize: number;
  onWindowSizeChange: (value: number) => void;
  overlay: boolean;
  onOverlayChange: (value: boolean) => void;
  windowOptions?: number[];
};

const rpsPalette = {
  return: "hsl(var(--foreground))",
  pressure: "hsl(var(--primary))",
  stability: "hsl(var(--accent))",
};

const dnavColor = "hsl(var(--chart-4))";

const rpsTicks = [-9, -6, -3, 0, 3, 6, 9];
const dnavTicks = [-18, 0, 18, 36, 54, 72, 90, 108];

export function TemporalTrajectoryPanel({
  data,
  windowSize,
  onWindowSizeChange,
  overlay,
  onOverlayChange,
  windowOptions = [25, 50, 100],
}: TemporalTrajectoryPanelProps) {
  const hasData = data.length > 0;

  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Temporal trajectory</p>
          <p className="text-sm font-semibold text-foreground">Decision index view</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Window</span>
          <Button
            variant={windowSize === 0 ? "default" : "outline"}
            size="sm"
            onClick={() => onWindowSizeChange(0)}
            className={cn(
              "rounded-full px-3 text-xs",
              windowSize === 0 ? "shadow-sm" : "bg-muted/60 text-foreground",
            )}
          >
            All
          </Button>
          {windowOptions.map((option) => (
            <Button
              key={option}
              variant={windowSize === option ? "default" : "outline"}
              size="sm"
              onClick={() => onWindowSizeChange(option)}
              className={cn(
                "rounded-full px-3 text-xs",
                windowSize === option ? "shadow-sm" : "bg-muted/60 text-foreground",
              )}
            >
              Last {option}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>X-axis uses decision order (1 → N) within the selected window.</span>
        <div className="flex items-center gap-2">
          <span>Overlay view</span>
          <Switch checked={overlay} onCheckedChange={onOverlayChange} />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {!hasData ? (
          <div className="rounded-xl border bg-background/60 p-6 text-sm text-muted-foreground">
            No decision history yet. Log decisions to reveal trajectory trends.
          </div>
        ) : overlay ? (
          <div className="h-[320px] rounded-xl border bg-background/60 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                <XAxis dataKey="xIndex" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  yAxisId="rps"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  domain={[-9, 9]}
                  ticks={rpsTicks}
                  label={{ value: "R · P · S", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
                />
                <YAxis
                  yAxisId="dnav"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  domain={[-18, 108]}
                  ticks={dnavTicks}
                  label={{ value: "D-NAV", angle: 90, position: "insideRight", offset: 10, fontSize: 11 }}
                />
                <Tooltip content={<TrajectoryTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="return" stroke={rpsPalette.return} dot={false} name="Return" strokeWidth={1.8} yAxisId="rps" isAnimationActive={false} />
                <Line type="monotone" dataKey="pressure" stroke={rpsPalette.pressure} dot={false} name="Pressure" strokeWidth={1.8} yAxisId="rps" isAnimationActive={false} />
                <Line type="monotone" dataKey="stability" stroke={rpsPalette.stability} dot={false} name="Stability" strokeWidth={1.8} yAxisId="rps" isAnimationActive={false} />
                <Line type="monotone" dataKey="dnav" stroke={dnavColor} dot={false} name="D-NAV" strokeWidth={2} yAxisId="dnav" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">R · P · S trajectory</p>
              <div className="h-[220px] rounded-xl border bg-background/60 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                    <XAxis
                      dataKey="xIndex"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      label={{ value: "Decision index", position: "insideBottomRight", offset: -6, fontSize: 11 }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      domain={[-9, 9]}
                      ticks={rpsTicks}
                    />
                    <Tooltip content={<TrajectoryTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="return" stroke={rpsPalette.return} dot={false} name="Return" strokeWidth={1.8} isAnimationActive={false} />
                    <Line type="monotone" dataKey="pressure" stroke={rpsPalette.pressure} dot={false} name="Pressure" strokeWidth={1.8} isAnimationActive={false} />
                    <Line type="monotone" dataKey="stability" stroke={rpsPalette.stability} dot={false} name="Stability" strokeWidth={1.8} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">D-NAV trajectory</p>
              <div className="h-[180px] rounded-xl border bg-background/60 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                    <XAxis
                      dataKey="xIndex"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      label={{ value: "Decision index", position: "insideBottomRight", offset: -6, fontSize: 11 }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      domain={[-18, 108]}
                      ticks={dnavTicks}
                    />
                    <Tooltip content={<TrajectoryTooltip />} />
                    <Line type="monotone" dataKey="dnav" stroke={dnavColor} dot={false} name="D-NAV" strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TrajectoryTooltip({
  label,
  payload,
}: {
  label?: number | string;
  payload?: { name?: string; value?: number }[];
}) {
  if (!payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold text-foreground">Decision {label}</p>
      <div className="space-y-1 text-muted-foreground">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-6">
            <span>{item.name}</span>
            <span className="font-semibold text-foreground">
              {typeof item.value === "number" ? item.value.toFixed(2) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
