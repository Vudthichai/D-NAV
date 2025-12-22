"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DecisionInspectorDrawer } from "@/components/inspector/DecisionInspectorDrawer";
import type { DecisionEntry } from "@/lib/calculations";
import { getRegimeLabel as getNumericRegimeLabel, toNumberOrNull } from "@/lib/inspector";
import { cn } from "@/lib/utils";

type TemporalDecisionPoint = {
  index: number;
  returnValue: number | null;
  pressureValue: number | null;
  stabilityValue: number | null;
  dnavValue: number | null;
  regimeLabel: string;
};

type RollingStat = {
  mean: number | null;
  stddev: number | null;
};

type TemporalTrajectoryPanelProps = {
  decisions: DecisionEntry[];
  windowSize: number;
  onWindowSizeChange: (value: number) => void;
  windowOptions?: number[];
};

const dnavColor = "hsl(var(--chart-4))";
const rpsPalette = {
  return: "hsl(var(--foreground))",
  pressure: "hsl(var(--primary))",
  stability: "hsl(var(--accent))",
};

const dnavTicks = [-18, 0, 18, 36, 54, 72, 90, 108];

export function TemporalTrajectoryPanel({
  decisions,
  windowSize,
  onWindowSizeChange,
  windowOptions = [25, 50, 100],
}: TemporalTrajectoryPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<DecisionEntry | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [showMiniTrends, setShowMiniTrends] = useState(false);
  const [showRegimeHeatmap, setShowRegimeHeatmap] = useState(false);

  const windowedDecisions = useMemo(() => {
    if (decisions.length === 0) return [];
    const sorted = [...decisions].sort((a, b) => a.ts - b.ts);
    const resolvedWindowSize = windowSize > 0 ? Math.min(windowSize, sorted.length) : sorted.length;
    return resolvedWindowSize > 0 ? sorted.slice(-resolvedWindowSize) : sorted;
  }, [decisions, windowSize]);

  const points = useMemo<TemporalDecisionPoint[]>(
    () =>
      windowedDecisions.map((decision, index) => {
        const returnValue = resolveNumber(decision.return, decision.R, decision["Return"]);
        const pressureValue = resolveNumber(decision.pressure, decision.P, decision["Pressure"]);
        const stabilityValue = resolveNumber(decision.stability, decision.S, decision["Stability"]);
        const dnavValue = resolveNumber(
          decision.dnav,
          decision.dNav,
          decision["D-NAV"],
          decision.DNAV,
          decision.D_NAV,
          decision.D,
        );

        return {
          index: index + 1,
          returnValue,
          pressureValue,
          stabilityValue,
          dnavValue,
          regimeLabel: getRegimeLabel(decision, returnValue, pressureValue, stabilityValue),
        };
      }),
    [windowedDecisions],
  );

  const hasData = points.length > 0;

  const trendWindow = 7;

  const dnavSeries = useMemo(() => points.map((point) => point.dnavValue), [points]);
  const rollingStats = useMemo(() => computeRollingStats(dnavSeries, trendWindow), [dnavSeries]);
  const rollingTrendData = useMemo(
    () =>
      points.map((point, index) => ({
        index: point.index,
        rollingMean: rollingStats[index]?.mean ?? null,
        rollingStd: rollingStats[index]?.stddev ?? null,
      })),
    [points, rollingStats],
  );

  const rollingReturnSeries = useMemo(
    () => computeRollingMeanSeries(points.map((point) => point.returnValue), trendWindow),
    [points],
  );
  const rollingPressureSeries = useMemo(
    () => computeRollingMeanSeries(points.map((point) => point.pressureValue), trendWindow),
    [points],
  );
  const rollingStabilitySeries = useMemo(
    () => computeRollingMeanSeries(points.map((point) => point.stabilityValue), trendWindow),
    [points],
  );

  const chipWindowSize = windowSize === 0 ? Math.min(points.length, 25) : points.length;
  const chipSlice = points.slice(-chipWindowSize);
  const rollingMeanDnav = mean(chipSlice.map((point) => point.dnavValue));
  const rollingMeanSeries = computeRollingMeanSeries(
    chipSlice.map((point) => point.dnavValue),
    trendWindow,
  );
  const trendSlope = getTrendSlope(rollingMeanSeries);
  const pressureWarningRate = getRate(
    chipSlice.map((point) => point.pressureValue),
    (value) => value <= -3,
  );
  const stabilityMedian = median(chipSlice.map((point) => point.stabilityValue));
  const averageStddev = mean(rollingStats.map((stat) => stat.stddev));

  const trendDirection = trendSlope === null ? "Flat" : trendSlope > 0.4 ? "Up" : trendSlope < -0.4 ? "Down" : "Flat";
  const consistencyLabel = getConsistencyLabel(averageStddev);

  const [minDnav, maxDnav] = useMemo(() => {
    const values = points
      .map((point) => point.dnavValue)
      .filter((value): value is number => value !== null);
    if (values.length === 0) return [0, 0];
    return [Math.min(...values), Math.max(...values)];
  }, [points]);

  const handleDecisionClick = (index: number) => {
    const decision = windowedDecisions[index] ?? null;
    setSelectedIndex(index + 1);
    setSelectedDecision(decision);
    setInspectorOpen(true);
  };

  const selectedMetrics = useMemo(
    () => (selectedDecision ? getDecisionMetrics(selectedDecision) : emptyDecisionMetrics()),
    [selectedDecision],
  );

  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Temporal progress</p>
          <p className="text-sm font-semibold text-foreground">Progress & pattern view</p>
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>Temporal mode emphasizes progress across the selected window.</span>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span>Show R/P/S mini-trends</span>
            <Switch checked={showMiniTrends} onCheckedChange={setShowMiniTrends} />
          </label>
          <label className="flex items-center gap-2">
            <span>Show regime heatmap</span>
            <Switch checked={showRegimeHeatmap} onCheckedChange={setShowRegimeHeatmap} />
          </label>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {!hasData ? (
          <div className="rounded-xl border bg-background/60 p-6 text-sm text-muted-foreground">
            No decision history yet. Log decisions to reveal progress patterns.
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <ProgressChip label="Rolling D-NAV" value={formatValue(rollingMeanDnav)} />
              <ProgressChip label="Trend" value={trendDirection} />
              <ProgressChip
                label="Pressure warning rate"
                value={pressureWarningRate === null ? "—" : `${pressureWarningRate.toFixed(0)}%`}
              />
              <ProgressChip
                label="Stability median"
                value={stabilityMedian === null ? "—" : stabilityMedian.toFixed(1)}
              />
            </div>

            <div className="space-y-2 rounded-xl border bg-background/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Regime timeline</p>
                <span className="text-[11px] text-muted-foreground">{points.length} decisions</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {points.map((point, index) => {
                  const tone = getRegimeTone(point.regimeLabel);
                  const intensity = getHeatIntensity(point.dnavValue, minDnav, maxDnav);
                  const isSelected = selectedIndex === point.index;
                  return (
                    <button
                      key={point.index}
                      type="button"
                      onClick={() => handleDecisionClick(index)}
                      className={cn(
                        "h-7 w-7 rounded-md border text-[10px] font-semibold text-white transition",
                        tone,
                        isSelected ? "ring-2 ring-primary" : "ring-0",
                      )}
                      style={{ opacity: showRegimeHeatmap ? intensity : 0.85 }}
                      title={`Decision ${point.index} — ${point.regimeLabel} — D-NAV ${formatValue(point.dnavValue)}`}
                      aria-label={`Open decision ${point.index} inspector`}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Click a block to open the decision inspector for that decision.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Rolling D-NAV trend
                </p>
                <span className="text-[11px] text-muted-foreground">Consistency: {consistencyLabel}</span>
              </div>
              <div className="h-[240px] rounded-xl border bg-background/60 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rollingTrendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                    <XAxis
                      dataKey="index"
                      type="number"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      label={{ value: "Decision index", position: "insideBottomRight", offset: -6, fontSize: 11 }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      ticks={dnavTicks}
                      interval={0}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="rollingMean"
                      stroke={dnavColor}
                      dot={false}
                      name="Rolling mean"
                      strokeWidth={2}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {showMiniTrends && (
              <div className="space-y-3">
                <MiniTrendCard
                  title="Return mini-trend"
                  data={buildMiniTrendData(points, rollingReturnSeries)}
                  color={rpsPalette.return}
                />
                <MiniTrendCard
                  title="Pressure mini-trend"
                  data={buildMiniTrendData(points, rollingPressureSeries)}
                  color={rpsPalette.pressure}
                />
                <MiniTrendCard
                  title="Stability mini-trend"
                  data={buildMiniTrendData(points, rollingStabilitySeries)}
                  color={rpsPalette.stability}
                />
              </div>
            )}
          </>
        )}
      </div>

      <DecisionInspectorDrawer
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        decisionIndex={selectedIndex}
        decision={selectedDecision}
        regimeLabel={selectedMetrics.regimeLabel}
        returnValue={selectedMetrics.returnValue}
        pressureValue={selectedMetrics.pressureValue}
        stabilityValue={selectedMetrics.stabilityValue}
        dnavValue={selectedMetrics.dnavValue}
      />
    </div>
  );
}

function resolveNumber(...values: Array<number | string | null | undefined>): number | null {
  for (const value of values) {
    const resolved = toNumberOrNull(value);
    if (resolved !== null) return resolved;
  }
  return null;
}

function getOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getRegimeLabel(
  decision: DecisionEntry,
  returnValue: number | null,
  pressureValue: number | null,
  stabilityValue: number | null,
): string {
  const candidates = [
    decision.regime,
    decision.regimeLabel,
    decision.policy,
    decision.policyLabel,
    decision.vehicleSegment,
    decision.archetype,
    decision.label,
  ];

  for (const candidate of candidates) {
    const resolved = getOptionalString(candidate);
    if (resolved) return resolved;
  }

  return getNumericRegimeLabel(returnValue, pressureValue, stabilityValue);
}

function getDecisionMetrics(decision: DecisionEntry): {
  returnValue: number | null;
  pressureValue: number | null;
  stabilityValue: number | null;
  dnavValue: number | null;
  regimeLabel: string;
} {
  const returnValue = resolveNumber(decision.return, decision.R, decision["Return"]);
  const pressureValue = resolveNumber(decision.pressure, decision.P, decision["Pressure"]);
  const stabilityValue = resolveNumber(decision.stability, decision.S, decision["Stability"]);
  const dnavValue = resolveNumber(
    decision.dnav,
    decision.dNav,
    decision["D-NAV"],
    decision.DNAV,
    decision.D_NAV,
    decision.D,
  );
  return {
    returnValue,
    pressureValue,
    stabilityValue,
    dnavValue,
    regimeLabel: getRegimeLabel(decision, returnValue, pressureValue, stabilityValue),
  };
}

function emptyDecisionMetrics() {
  return {
    returnValue: null,
    pressureValue: null,
    stabilityValue: null,
    dnavValue: null,
    regimeLabel: "Unscored",
  };
}

function mean(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => value !== null);
  if (filtered.length === 0) return null;
  const total = filtered.reduce((sum, value) => sum + value, 0);
  return total / filtered.length;
}

function median(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (filtered.length === 0) return null;
  const middle = Math.floor(filtered.length / 2);
  if (filtered.length % 2 === 0) {
    return (filtered[middle - 1] + filtered[middle]) / 2;
  }
  return filtered[middle];
}

function computeRollingStats(values: Array<number | null>, windowSize: number): RollingStat[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const windowValues = values.slice(start, index + 1).filter((value): value is number => value !== null);
    if (windowValues.length === 0) {
      return { mean: null, stddev: null };
    }
    const avg = windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length;
    const variance =
      windowValues.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / windowValues.length;
    return { mean: avg, stddev: Math.sqrt(variance) };
  });
}

function computeRollingMeanSeries(values: Array<number | null>, windowSize: number): Array<number | null> {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const windowValues = values.slice(start, index + 1).filter((value): value is number => value !== null);
    if (windowValues.length === 0) return null;
    const total = windowValues.reduce((sum, value) => sum + value, 0);
    return total / windowValues.length;
  });
}

function getTrendSlope(values: Array<number | null>): number | null {
  const first = values.find((value) => value !== null) ?? null;
  if (first === null) return null;
  const last = [...values].reverse().find((value) => value !== null) ?? null;
  if (last === null) return null;
  return last - first;
}

function getRate(values: Array<number | null>, predicate: (value: number) => boolean): number | null {
  const filtered = values.filter((value): value is number => value !== null);
  if (filtered.length === 0) return null;
  const count = filtered.filter(predicate).length;
  return (count / filtered.length) * 100;
}

function formatValue(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function getConsistencyLabel(stddev: number | null): string {
  if (stddev === null || Number.isNaN(stddev)) return "—";
  if (stddev <= 3) return "High";
  if (stddev <= 6) return "Medium";
  return "Low";
}

function getRegimeTone(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("efficient") || normalized.includes("upside") || normalized.includes("green")) {
    return "bg-emerald-500";
  }
  if (normalized.includes("risk") || normalized.includes("decay") || normalized.includes("collapse")) {
    return "bg-rose-500";
  }
  if (normalized.includes("fragility") || normalized.includes("pressure")) {
    return "bg-amber-500";
  }
  return "bg-slate-400";
}

function getHeatIntensity(value: number | null, min: number, max: number): number {
  if (value === null) return 0.35;
  if (min === max) return 0.85;
  const normalized = (value - min) / (max - min);
  return Math.min(1, Math.max(0.25, normalized));
}

function ProgressChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/70 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

type MiniTrendPoint = {
  index: number;
  value: number | null;
};

function buildMiniTrendData(points: TemporalDecisionPoint[], series: Array<number | null>): MiniTrendPoint[] {
  return points.map((point, index) => ({ index: point.index, value: series[index] ?? null }));
}

function MiniTrendCard({
  title,
  data,
  color,
}: {
  title: string;
  data: MiniTrendPoint[];
  color: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="h-[120px] rounded-xl border bg-background/60 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
            <XAxis dataKey="index" hide />
            <YAxis hide />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              dot={false}
              strokeWidth={2}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
