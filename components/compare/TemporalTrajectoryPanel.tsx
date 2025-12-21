"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { DecisionEntry } from "@/lib/calculations";
import type { RegimeType } from "@/lib/judgment/posture";
import {
  buildTemporalPoints,
  computeSummaryChips,
  mergeRegimeSegments,
  rollingMean,
  rollingStd,
  windowDecisions,
} from "@/lib/temporal";

type TemporalTrajectoryPanelProps = {
  decisions: DecisionEntry[];
};

type TrendPoint = {
  xIndex: number;
  mean: number | null;
  upper: number | null;
  lower: number | null;
};

const WINDOW_OPTIONS = [25, 50, 100];

const REGIME_COLORS: Record<RegimeType, { bar: string; text: string }> = {
  Exploitative: { bar: "bg-emerald-500/70", text: "text-emerald-200" },
  Exploratory: { bar: "bg-sky-500/60", text: "text-sky-200" },
  Stressed: { bar: "bg-rose-500/70", text: "text-rose-200" },
  Asymmetric: { bar: "bg-violet-500/70", text: "text-violet-200" },
};

const RPS_TICKS = [-9, -6, -3, 0, 3, 6, 9];
const DNAV_TICKS = [-18, 0, 18, 36, 54, 72, 90, 108];

export function TemporalTrajectoryPanel({ decisions }: TemporalTrajectoryPanelProps) {
  const [windowSize, setWindowSize] = useState<number | "all">("all");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showMultiples, setShowMultiples] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const windowedDecisions = useMemo(
    () => windowDecisions(decisions, windowSize === "all" ? "all" : windowSize),
    [decisions, windowSize],
  );
  const points = useMemo(() => buildTemporalPoints(windowedDecisions), [windowedDecisions]);
  const hasData = points.length > 0;
  const rollingWindow = points.length >= 25 ? 7 : 5;

  const trendData = useMemo<TrendPoint[]>(() => {
    const dnavValues = points.map((point) => point.dnav);
    const meanValues = rollingMean(dnavValues, rollingWindow);
    const stdValues = rollingStd(dnavValues, rollingWindow);
    return points.map((point, index) => {
      const mean = meanValues[index];
      const std = stdValues[index] ?? 0;
      return {
        xIndex: point.xIndex,
        mean,
        upper: mean === null ? null : mean + std,
        lower: mean === null ? null : mean - std,
      };
    });
  }, [points, rollingWindow]);

  const segments = useMemo(() => mergeRegimeSegments(points), [points]);
  const windowSummary = useMemo(() => computeSummaryChips(points, rollingWindow), [points, rollingWindow]);
  const efficientWindowPoints = useMemo(() => (points.length >= 25 ? points.slice(-25) : points), [points]);
  const efficientSummary = useMemo(
    () => computeSummaryChips(efficientWindowPoints, rollingWindow),
    [efficientWindowPoints, rollingWindow],
  );

  const selectedPoint = selectedIndex ? points.find((point) => point.xIndex === selectedIndex) ?? null : null;

  const handleSelectDecision = (index: number) => {
    setSelectedIndex(index);
    setInspectorOpen(true);
  };

  const handleHeatmapToggle = (value: boolean) => {
    setShowHeatmap(value);
    if (value) setShowMultiples(false);
  };

  const handleMultiplesToggle = (value: boolean) => {
    setShowMultiples(value);
    if (value) setShowHeatmap(false);
  };

  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Temporal Trajectory</p>
          <p className="text-xs text-muted-foreground">Track how a single system evolves across sequential decisions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Window</span>
          <Button
            variant={windowSize === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setWindowSize("all")}
            className={cn("rounded-full px-3 text-xs", windowSize === "all" ? "shadow-sm" : "bg-muted/60 text-foreground")}
          >
            All
          </Button>
          {WINDOW_OPTIONS.map((option) => (
            <Button
              key={option}
              variant={windowSize === option ? "default" : "outline"}
              size="sm"
              onClick={() => setWindowSize(option)}
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>X-axis uses decision order (1 → N) within the selected window.</span>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span>Show R/P/S heatmap</span>
            <Switch checked={showHeatmap} onCheckedChange={handleHeatmapToggle} />
          </label>
          <label className="flex items-center gap-2">
            <span>Show small multiples</span>
            <Switch checked={showMultiples} onCheckedChange={handleMultiplesToggle} />
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryChip
          label={`${efficientSummary.windowLabel}: Efficient Upside`}
          value={`${efficientSummary.efficientUpsidePct.toFixed(0)}%`}
        />
        <SummaryChip label="Pressure warning" value={`${windowSummary.pressureWarningPct.toFixed(0)}%`} />
        <SummaryChip
          label="Stability median"
          value={windowSummary.stabilityMedian !== null ? windowSummary.stabilityMedian.toFixed(1) : "—"}
        />
        <SummaryChip label="D-NAV trend" value={trendArrow(windowSummary.dnavTrend)} />
      </div>

      <div className={cn("mt-5 grid gap-4", inspectorOpen && selectedPoint ? "lg:grid-cols-[1fr_320px]" : "")}>
        <div className="space-y-4">
          {!hasData ? (
            <div className="rounded-xl border bg-background/60 p-6 text-sm text-muted-foreground">
              No decision history yet. Log decisions to reveal trajectory trends.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Regime timeline</p>
                  <span className="text-[11px] text-muted-foreground">Click to inspect a decision.</span>
                </div>
                <RegimeTimeline
                  points={points}
                  segments={segments}
                  selectedIndex={selectedIndex}
                  onSelect={handleSelectDecision}
                />
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rolling D-NAV trend</p>
                <div className="h-[260px] rounded-xl border bg-background/60 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendData}
                      margin={{ top: 12, right: 20, left: 0, bottom: 0 }}
                      onClick={(event) => {
                        const label = (event as { activeLabel?: number | string } | null)?.activeLabel;
                        const index = typeof label === "number" ? label : Number(label);
                        if (Number.isFinite(index)) handleSelectDecision(index);
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                      <XAxis
                        dataKey="xIndex"
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickCount={6}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        domain={[-18, 108]}
                        ticks={DNAV_TICKS}
                        interval={0}
                      />
                      <Tooltip content={<TrendTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="upper"
                        stroke="none"
                        fill="hsl(var(--chart-4))"
                        fillOpacity={0.12}
                        isAnimationActive={false}
                        legendType="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="lower"
                        stroke="none"
                        fill="hsl(var(--chart-4))"
                        fillOpacity={0.12}
                        isAnimationActive={false}
                        legendType="none"
                      />
                      <Line
                        type="monotone"
                        dataKey="mean"
                        stroke="hsl(var(--chart-4))"
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {showHeatmap && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">R/P/S heatmap</p>
                  <div className="rounded-xl border bg-background/60 p-3">
                    <Heatmap
                      points={points}
                      selectedIndex={selectedIndex}
                      onSelect={handleSelectDecision}
                    />
                  </div>
                </div>
              )}

              {showMultiples && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">R/P/S small multiples</p>
                  <div className="space-y-3 rounded-xl border bg-background/60 p-3">
                    <SmallMultipleChart
                      label="Return"
                      dataKey="return"
                      points={points}
                      onSelect={handleSelectDecision}
                    />
                    <SmallMultipleChart
                      label="Pressure"
                      dataKey="pressure"
                      points={points}
                      onSelect={handleSelectDecision}
                    />
                    <SmallMultipleChart
                      label="Stability"
                      dataKey="stability"
                      points={points}
                      onSelect={handleSelectDecision}
                      showXAxis
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {inspectorOpen && selectedPoint && (
          <DecisionInspector
            point={selectedPoint}
            onClose={() => {
              setInspectorOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/60 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function trendArrow(trend: "up" | "down" | "flat") {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

function RegimeTimeline({
  points,
  segments,
  selectedIndex,
  onSelect,
}: {
  points: ReturnType<typeof buildTemporalPoints>;
  segments: ReturnType<typeof mergeRegimeSegments>;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  if (!points.length) return null;
  return (
    <div className="relative h-10 overflow-hidden rounded-xl border bg-background/60">
      <div className="absolute inset-0 flex">
        {segments.map((segment) => {
          const length = segment.endIndex - segment.startIndex + 1;
          const width = `${(length / points.length) * 100}%`;
          return (
            <div
              key={`${segment.regime}-${segment.startIndex}`}
              className={cn("h-full", REGIME_COLORS[segment.regime].bar)}
              style={{ width }}
            />
          );
        })}
      </div>
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((point) => {
          const isSelected = point.xIndex === selectedIndex;
          const tooltip = `Decision ${point.xIndex} • ${point.regime}\nR ${formatValue(point.return)} | P ${formatValue(point.pressure)} | S ${formatValue(point.stability)} | D-NAV ${formatValue(point.dnav)}`;
          return (
            <button
              key={point.xIndex}
              type="button"
              title={tooltip}
              onClick={() => onSelect(point.xIndex)}
              className={cn(
                "h-full border-l border-muted-foreground/10 transition",
                isSelected ? "ring-2 ring-white/80" : "hover:opacity-90",
              )}
              aria-label={`Decision ${point.xIndex} (${point.regime})`}
            />
          );
        })}
      </div>
    </div>
  );
}

function Heatmap({
  points,
  selectedIndex,
  onSelect,
}: {
  points: ReturnType<typeof buildTemporalPoints>;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const rows: Array<{ label: string; key: "return" | "pressure" | "stability" }> = [
    { label: "R", key: "return" },
    { label: "P", key: "pressure" },
    { label: "S", key: "stability" },
  ];

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <span className="w-6 text-[11px] font-semibold text-muted-foreground">{row.label}</span>
          <div
            className="grid flex-1 gap-px"
            style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
          >
            {points.map((point) => {
              const value = point[row.key];
              const color = heatColor(value);
              const isSelected = point.xIndex === selectedIndex;
              return (
                <button
                  key={`${row.key}-${point.xIndex}`}
                  type="button"
                  title={`Decision ${point.xIndex} • ${row.label}: ${formatValue(value)}`}
                  onClick={() => onSelect(point.xIndex)}
                  className={cn("h-4 rounded-sm", isSelected ? "ring-2 ring-white/80" : "")}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SmallMultipleChart({
  label,
  dataKey,
  points,
  onSelect,
  showXAxis = false,
}: {
  label: string;
  dataKey: "return" | "pressure" | "stability";
  points: ReturnType<typeof buildTemporalPoints>;
  onSelect: (index: number) => void;
  showXAxis?: boolean;
}) {
  const color = dataKey === "return" ? "hsl(var(--foreground))" : dataKey === "pressure" ? "hsl(var(--primary))" : "hsl(var(--accent))";

  return (
    <div className="h-[140px]">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          onClick={(event) => {
            const labelValue = (event as { activeLabel?: number | string } | null)?.activeLabel;
            const index = typeof labelValue === "number" ? labelValue : Number(labelValue);
            if (Number.isFinite(index)) onSelect(index);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
          <XAxis
            dataKey="xIndex"
            type="number"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            hide={!showXAxis}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            domain={[-9, 9]}
            ticks={RPS_TICKS}
            interval={0}
          />
          <Tooltip content={(props) => <MetricTooltip {...props} metricLabel={label} />} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DecisionInspector({
  point,
  onClose,
}: {
  point: ReturnType<typeof buildTemporalPoints>[number];
  onClose: () => void;
}) {
  return (
    <aside className="rounded-xl border bg-background/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-foreground">
            Decision {point.xIndex} — {point.regime}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">D-NAV</p>
        <p className="text-3xl font-semibold text-foreground">{formatValue(point.dnav)}</p>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this regime?</p>
        <p className="text-sm text-muted-foreground">{explainRegime(point)}</p>
      </div>

      <div className="mt-4 space-y-3">
        <FactorBar label="Return" value={point.return} color="bg-emerald-500" />
        <FactorBar label="Pressure" value={point.pressure} color="bg-amber-500" />
        <FactorBar label="Stability" value={point.stability} color="bg-sky-500" />
      </div>

      <details className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Calculation details
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li>Return, Pressure, and Stability are bounded to -9…9.</li>
          <li>D-NAV aggregates R/P/S signals into a single score.</li>
          <li>Regimes are applied after scoring to label the dominant posture.</li>
        </ul>
      </details>

      <div className="mt-4">
        <Link href="/definitions" className="text-xs font-semibold text-primary hover:underline">
          View methodology →
        </Link>
      </div>
    </aside>
  );
}

function FactorBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  const max = 9;
  const magnitude = value === null ? 0 : Math.min(max, Math.abs(value));
  const width = (magnitude / max) * 50;
  const offset = value === null ? 50 : value >= 0 ? 50 : 50 - width;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold text-foreground">{formatValue(value)}</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-muted/60">
        <div className="absolute left-1/2 top-0 h-2 w-px bg-muted-foreground/50" />
        <div
          className={cn("absolute top-0 h-2 rounded-full", color)}
          style={{ width: `${width}%`, left: `${offset}%` }}
        />
      </div>
    </div>
  );
}

function TrendTooltip({
  label,
  payload,
}: {
  label?: number | string;
  payload?: { dataKey?: string; value?: number }[];
}) {
  if (!payload || payload.length === 0) return null;
  const mean = payload.find((item) => item.dataKey === "mean")?.value;
  const upper = payload.find((item) => item.dataKey === "upper")?.value;
  const lower = payload.find((item) => item.dataKey === "lower")?.value;

  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold text-foreground">Decision {label}</p>
      <div className="space-y-1 text-muted-foreground">
        <div className="flex items-center justify-between gap-6">
          <span>Rolling mean</span>
          <span className="font-semibold text-foreground">{formatValue(mean)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span>Band</span>
          <span className="font-semibold text-foreground">
            {formatValue(lower)} – {formatValue(upper)}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricTooltip({
  metricLabel,
  payload,
}: {
  metricLabel: string;
  payload?: { value?: number; payload?: { xIndex?: number } }[];
}) {
  if (!payload || payload.length === 0) return null;
  const value = payload[0]?.value;
  const index = payload[0]?.payload?.xIndex;
  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold text-foreground">Decision {index}</p>
      <div className="flex items-center justify-between gap-6 text-muted-foreground">
        <span>{metricLabel}</span>
        <span className="font-semibold text-foreground">{formatValue(value)}</span>
      </div>
    </div>
  );
}

function formatValue(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return value.toFixed(2);
}

function heatColor(value: number | null) {
  if (value === null) return "hsl(var(--muted)/0.4)";
  const clipped = Math.max(-9, Math.min(9, value));
  const intensity = Math.abs(clipped) / 9;
  if (clipped > 0) {
    return `hsl(142 70% 45% / ${0.15 + intensity * 0.55})`;
  }
  if (clipped < 0) {
    return `hsl(0 70% 50% / ${0.15 + intensity * 0.55})`;
  }
  return "hsl(var(--muted)/0.4)";
}

function explainRegime(point: ReturnType<typeof buildTemporalPoints>[number]) {
  const ret = point.return ?? 0;
  const pressure = point.pressure ?? 0;
  const stability = point.stability ?? 0;

  const pressurePhrase = pressure >= 3 ? "high pressure" : pressure <= -3 ? "low pressure" : "balanced pressure";
  const returnPhrase = ret >= 3 ? "strong return" : ret <= -3 ? "negative return" : "moderate return";
  const stabilityPhrase = stability >= 2 ? "stable footing" : stability <= -2 ? "fragile footing" : "mixed footing";

  switch (point.regime) {
    case "Stressed":
      return `High pressure with ${stabilityPhrase} kept this in a Stressed posture.`;
    case "Exploitative":
      return `${returnPhrase} with ${pressurePhrase} and ${stabilityPhrase} signals a compounding-friendly regime.`;
    case "Asymmetric":
      return `${returnPhrase} alongside ${pressurePhrase} suggests asymmetric optionality.`;
    case "Exploratory":
    default:
      return `${returnPhrase} with ${pressurePhrase} and ${stabilityPhrase} indicates ongoing exploration.`;
  }
}
