"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
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
import { getRegimeLabel, normalizeDecisionEntry, normalizeDecisionMetrics } from "@/lib/inspector";
import { cn } from "@/lib/utils";

const rpsTicks = [-9, -6, -3, 0, 3, 6, 9];
const dnavTicks = [-18, 0, 18, 36, 54, 72, 90, 108];
const rollingWindowSize = 5;

const positiveRegimes = new Set([
  "Efficient Upside",
  "Breakthrough",
  "Advance",
  "Harvest",
  "Sprint",
  "Build",
  "Grind",
  "Overdrive energy",
  "High energy",
]);

const negativeRegimes = new Set([
  "Pressure Risk",
  "Fragility",
  "Meltdown",
  "Decay",
  "Collapse",
  "Burn",
  "Leak",
  "Wobble",
  "Teeter",
  "Drift",
]);

type NormalizedDecision = {
  index: number;
  decision: DecisionEntry;
  dnav: number | null;
  returnValue: number | null;
  pressureValue: number | null;
  stabilityValue: number | null;
  regimeLabel: string;
};

type TemporalProgressPanelProps = {
  decisions: DecisionEntry[];
  windowSize: number;
  onWindowSizeChange: (value: number) => void;
  windowOptions?: number[];
};

const getOptionalString = (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value : null);

const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid] ?? null;
};

const iqr = (values: number[]) => {
  if (values.length < 4) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  if (q1 === undefined || q3 === undefined) return null;
  return q3 - q1;
};

const mad = (values: number[]) => {
  const med = median(values);
  if (med === null) return null;
  const deviations = values.map((value) => Math.abs(value - med));
  return median(deviations);
};

const getRegimeLabelForDecision = (
  decision: DecisionEntry,
  metrics: { return: number | null; pressure: number | null; stability: number | null },
) => {
  const record = decision as Record<string, unknown>;
  const fallbackLabel =
    getOptionalString(record["regime"]) ??
    getOptionalString(record["regimeLabel"]) ??
    getOptionalString(record["regime_name"]) ??
    getOptionalString(decision.archetype);

  if (fallbackLabel) return fallbackLabel;
  if (metrics.return !== null && metrics.pressure !== null && metrics.stability !== null) {
    return getRegimeLabel(metrics.return, metrics.pressure, metrics.stability);
  }
  return "Unlabeled";
};

const classifyRegimeTone = (label: string, dnav: number | null) => {
  if (positiveRegimes.has(label)) return "positive";
  if (negativeRegimes.has(label)) return "negative";
  const normalized = label.toLowerCase();
  if (normalized.includes("risk") || normalized.includes("frag") || normalized.includes("pressure")) {
    return "negative";
  }
  if (normalized.includes("efficient") || normalized.includes("advance") || normalized.includes("break")) {
    return "positive";
  }
  if (dnav !== null) {
    if (dnav >= 25) return "positive";
    if (dnav <= -5) return "negative";
  }
  return "neutral";
};

const toneClasses: Record<"positive" | "neutral" | "negative", string> = {
  positive: "bg-emerald-500/70",
  neutral: "bg-slate-400/70",
  negative: "bg-rose-500/70",
};

const chipToneClasses: Record<"positive" | "neutral" | "negative", string> = {
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  neutral: "border-border bg-muted/40 text-foreground",
  negative: "border-rose-500/30 bg-rose-500/10 text-rose-700",
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

const formatValue = (value: number | null, digits = 1) =>
  value === null || Number.isNaN(value) ? "—" : value.toFixed(digits);

function SummaryChip({
  label,
  value,
  subtext,
  tone = "neutral",
}: {
  label: string;
  value: string;
  subtext?: string;
  tone?: "positive" | "neutral" | "negative";
}) {
  return (
    <div className={cn("rounded-xl border px-3 py-2 text-xs", chipToneClasses[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {subtext ? <p className="text-[11px] text-muted-foreground">{subtext}</p> : null}
    </div>
  );
}

export function TemporalProgressPanel({
  decisions,
  windowSize,
  onWindowSizeChange,
  windowOptions = [25, 50, 100],
}: TemporalProgressPanelProps) {
  const [showMultiples, setShowMultiples] = useState(false);
  const [showBand, setShowBand] = useState(true);
  const [showRawPoints, setShowRawPoints] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<DecisionEntry | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const sortedDecisions = useMemo(() => [...decisions].sort((a, b) => a.ts - b.ts), [decisions]);
  const resolvedWindowSize = windowSize > 0 ? Math.min(windowSize, sortedDecisions.length) : sortedDecisions.length;
  const windowedDecisions = useMemo(
    () => (resolvedWindowSize > 0 ? sortedDecisions.slice(-resolvedWindowSize) : sortedDecisions),
    [resolvedWindowSize, sortedDecisions],
  );

  const normalizedDecisions = useMemo<NormalizedDecision[]>(
    () =>
      windowedDecisions.map((decision, index) => {
        const metrics = normalizeDecisionMetrics(decision);
        const regimeLabel = getRegimeLabelForDecision(decision, metrics);
        return {
          index: index + 1,
          decision,
          dnav: metrics.dnav,
          returnValue: metrics.return,
          pressureValue: metrics.pressure,
          stabilityValue: metrics.stability,
          regimeLabel,
        };
      }),
    [windowedDecisions],
  );

  const summaryWindowSize = windowSize > 0 ? Math.min(windowSize, sortedDecisions.length) : Math.min(25, sortedDecisions.length);
  const summaryCurrent = useMemo(
    () => sortedDecisions.slice(-summaryWindowSize),
    [sortedDecisions, summaryWindowSize],
  );
  const summaryPrevious = useMemo(
    () =>
      summaryWindowSize > 0
        ? sortedDecisions.slice(-(summaryWindowSize * 2), -summaryWindowSize)
        : [],
    [sortedDecisions, summaryWindowSize],
  );

  const summaryMetrics = useMemo(() => {
    const currentMetrics = summaryCurrent.map((decision) => ({
      decision,
      metrics: normalizeDecisionMetrics(decision),
    }));
    const previousMetrics = summaryPrevious.map((decision) => normalizeDecisionMetrics(decision));

    const currentDnav = currentMetrics
      .map(({ metrics }) => metrics.dnav)
      .filter((value): value is number => typeof value === "number");
    const previousDnav = previousMetrics
      .map((metrics) => metrics.dnav)
      .filter((value): value is number => typeof value === "number");

    const currentStability = currentMetrics
      .map(({ metrics }) => metrics.stability)
      .filter((value): value is number => typeof value === "number");

    const currentPressures = currentMetrics
      .map(({ metrics }) => metrics.pressure)
      .filter((value): value is number => typeof value === "number");

    const efficiencyCount = currentMetrics.filter(({ decision, metrics }) => {
      const label = getRegimeLabelForDecision(decision, metrics);
      const tone = classifyRegimeTone(label, metrics.dnav);
      return tone === "positive";
    }).length;

    const pressureWarnings = currentPressures.filter((value) => value <= -3).length;

    const currentMean = currentDnav.length ? mean(currentDnav) : null;
    const previousMean = previousDnav.length ? mean(previousDnav) : null;
    const delta = currentMean !== null && previousMean !== null ? currentMean - previousMean : null;

    const stabilityMedian = median(currentStability);
    const dnavIqr = iqr(currentDnav);

    return {
      currentMean,
      previousMean,
      delta,
      efficiencyRate: summaryCurrent.length ? efficiencyCount / summaryCurrent.length : 0,
      pressureWarningRate: summaryCurrent.length ? pressureWarnings / summaryCurrent.length : 0,
      stabilityMedian,
      dnavIqr,
      count: summaryCurrent.length,
    };
  }, [summaryCurrent, summaryPrevious]);

  const { returnValue, pressureValue, stabilityValue, dnavValue } = useMemo(
    () => normalizeDecisionEntry(selectedDecision),
    [selectedDecision],
  );

  const selectedRegimeLabel = useMemo(() => {
    if (!selectedDecision) return null;
    const metrics = normalizeDecisionMetrics(selectedDecision);
    return getRegimeLabelForDecision(selectedDecision, metrics);
  }, [selectedDecision]);

  const rollingStats = useMemo(() => {
    const values = normalizedDecisions.map((decision) => decision.dnav);
    const rValues = normalizedDecisions.map((decision) => decision.returnValue);
    const pValues = normalizedDecisions.map((decision) => decision.pressureValue);
    const sValues = normalizedDecisions.map((decision) => decision.stabilityValue);

    const computeRolling = (series: (number | null)[]) =>
      series.map((_, index) => {
        const slice = series
          .slice(Math.max(0, index - rollingWindowSize + 1), index + 1)
          .filter((value): value is number => typeof value === "number");
        if (!slice.length) {
          return { mean: null, spread: null };
        }
        return {
          mean: mean(slice),
          spread: mad(slice),
        };
      });

    return {
      dnav: computeRolling(values),
      returns: computeRolling(rValues),
      pressure: computeRolling(pValues),
      stability: computeRolling(sValues),
    };
  }, [normalizedDecisions]);

  const trendData = useMemo(
    () =>
      normalizedDecisions.map((decision, index) => {
        const dnavStat = rollingStats.dnav[index] ?? { mean: null, spread: null };
        const meanValue = dnavStat.mean;
        const spreadValue = dnavStat.spread ?? null;
        const upper = meanValue !== null && spreadValue !== null ? meanValue + spreadValue : null;
        const lower = meanValue !== null && spreadValue !== null ? meanValue - spreadValue : null;
        return {
          index: decision.index,
          mean: meanValue,
          dnav: decision.dnav,
          upper,
          lower,
          band: upper !== null && lower !== null ? upper - lower : null,
        };
      }),
    [normalizedDecisions, rollingStats],
  );

  const rpsTrendData = useMemo(
    () =>
      normalizedDecisions.map((decision, index) => ({
        index: decision.index,
        rMean: rollingStats.returns[index]?.mean ?? null,
        pMean: rollingStats.pressure[index]?.mean ?? null,
        sMean: rollingStats.stability[index]?.mean ?? null,
      })),
    [normalizedDecisions, rollingStats],
  );

  const trendTone = summaryMetrics.delta === null ? "neutral" : summaryMetrics.delta > 1 ? "positive" : summaryMetrics.delta < -1 ? "negative" : "neutral";
  const trendArrow = summaryMetrics.delta === null ? "—" : summaryMetrics.delta > 1 ? "↑" : summaryMetrics.delta < -1 ? "↓" : "→";

  const consistencyLabel = (() => {
    if (summaryMetrics.dnavIqr === null) return "—";
    if (summaryMetrics.dnavIqr <= 10) return "Stable";
    if (summaryMetrics.dnavIqr <= 22) return "Mixed";
    return "Volatile";
  })();

  const longestStreak = useMemo(() => {
    if (!normalizedDecisions.length) return null;
    let best = { label: normalizedDecisions[0]?.regimeLabel ?? "Unlabeled", count: 1 };
    let current = { label: best.label, count: 1 };
    for (let i = 1; i < normalizedDecisions.length; i += 1) {
      const label = normalizedDecisions[i]?.regimeLabel ?? "Unlabeled";
      if (label === current.label) {
        current.count += 1;
      } else {
        if (current.count > best.count) best = { ...current };
        current = { label, count: 1 };
      }
    }
    if (current.count > best.count) best = { ...current };
    return best;
  }, [normalizedDecisions]);

  const handleDecisionClick = (index: number) => {
    const decision = windowedDecisions[index] ?? null;
    setSelectedIndex(index + 1);
    setSelectedDecision(decision);
    setInspectorOpen(true);
  };

  const showEmptyState = !normalizedDecisions.length;

  return (
    <div className="rounded-2xl border bg-muted/30 p-4 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Temporal progress</p>
          <p className="text-sm font-semibold text-foreground">Progress dashboard view</p>
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

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <SummaryChip
          label="D-NAV trend"
          value={summaryMetrics.delta === null ? "—" : `${trendArrow} ${formatValue(summaryMetrics.delta, 1)}`}
          subtext={summaryMetrics.count ? `vs prev ${summaryWindowSize}` : "No prior window"}
          tone={trendTone}
        />
        <SummaryChip
          label="Change vs previous"
          value={summaryMetrics.delta === null ? "—" : `${formatValue(summaryMetrics.delta, 1)} D-NAV`}
          subtext={summaryMetrics.previousMean !== null ? `Prev avg ${formatValue(summaryMetrics.previousMean, 1)}` : "Insufficient history"}
        />
        <SummaryChip
          label="Efficiency %"
          value={summaryMetrics.count ? percent(summaryMetrics.efficiencyRate) : "—"}
          subtext="Positive regimes"
          tone={summaryMetrics.efficiencyRate >= 0.6 ? "positive" : summaryMetrics.efficiencyRate <= 0.3 ? "negative" : "neutral"}
        />
        <SummaryChip
          label="Pressure warning %"
          value={summaryMetrics.count ? percent(summaryMetrics.pressureWarningRate) : "—"}
          subtext="Pressure ≤ −3"
          tone={summaryMetrics.pressureWarningRate >= 0.35 ? "negative" : "neutral"}
        />
        <SummaryChip
          label="Stability median"
          value={summaryMetrics.count ? formatValue(summaryMetrics.stabilityMedian, 1) : "—"}
          subtext="Median stability"
          tone={summaryMetrics.stabilityMedian !== null && summaryMetrics.stabilityMedian >= 2 ? "positive" : "neutral"}
        />
        <SummaryChip
          label="Consistency"
          value={consistencyLabel}
          subtext={summaryMetrics.dnavIqr !== null ? `IQR ${formatValue(summaryMetrics.dnavIqr, 1)}` : "Need more data"}
          tone={consistencyLabel === "Stable" ? "positive" : consistencyLabel === "Volatile" ? "negative" : "neutral"}
        />
      </div>

      <div className="space-y-3 rounded-xl border bg-background/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Regime timeline</p>
            <p className="text-sm font-semibold text-foreground">Decision streaks by regime</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", toneClasses.positive)} /> Positive
            </span>
            <span className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", toneClasses.neutral)} /> Neutral
            </span>
            <span className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", toneClasses.negative)} /> Negative
            </span>
          </div>
        </div>
        {showEmptyState ? (
          <div className="rounded-xl border bg-background/60 p-6 text-sm text-muted-foreground">
            No decision history yet. Log decisions to reveal temporal progress.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {normalizedDecisions.map((decision, index) => {
              const tone = classifyRegimeTone(decision.regimeLabel, decision.dnav);
              return (
                <button
                  key={decision.index}
                  type="button"
                  onClick={() => handleDecisionClick(index)}
                  className={cn(
                    "group relative h-5 w-7 rounded-md border border-border/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    toneClasses[tone],
                  )}
                  aria-label={`Open decision ${decision.index} inspector`}
                >
                  <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded-md border bg-background/95 px-2 py-1 text-[10px] text-foreground opacity-0 shadow-sm transition group-hover:opacity-100">
                    #{decision.index} · {decision.regimeLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {longestStreak ? (
          <p className="text-xs text-muted-foreground">
            Longest streak: <span className="font-semibold text-foreground">{longestStreak.label}</span> ×{longestStreak.count}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rolling D-NAV trend</p>
            <p className="text-sm font-semibold text-foreground">Mean trajectory with spread</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <span>Show D-NAV band</span>
              <Switch checked={showBand} onCheckedChange={setShowBand} />
            </label>
            <label className="flex items-center gap-2">
              <span>Show raw points</span>
              <Switch checked={showRawPoints} onCheckedChange={setShowRawPoints} />
            </label>
          </div>
        </div>
        <div className="h-[280px] rounded-xl border bg-background/60 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
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
                domain={[-18, 108]}
                ticks={dnavTicks}
                interval={0}
              />
              <Tooltip />
              {showBand ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stackId="band"
                    stroke="none"
                    fill="transparent"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="band"
                    stackId="band"
                    stroke="none"
                    fill="hsl(var(--primary)/0.18)"
                    isAnimationActive={false}
                  />
                </>
              ) : null}
              <Line
                type="monotone"
                dataKey="mean"
                stroke="hsl(var(--chart-4))"
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
                name={`Rolling mean (${rollingWindowSize})`}
              />
              {showRawPoints ? (
                <Line
                  type="monotone"
                  dataKey="dnav"
                  stroke="none"
                  dot={{ r: 3, fill: "hsl(var(--muted-foreground))" }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  name="Raw D-NAV"
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Optional signal layer</p>
            <p className="text-sm font-semibold text-foreground">Rolling R/P/S means</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Show R/P/S small multiples</span>
            <Switch checked={showMultiples} onCheckedChange={setShowMultiples} />
          </label>
        </div>
        {showMultiples ? (
          <div className="grid gap-3 md:grid-cols-3">
            {([
              { key: "rMean", label: "Return", color: "hsl(var(--foreground))" },
              { key: "pMean", label: "Pressure", color: "hsl(var(--primary))" },
              { key: "sMean", label: "Stability", color: "hsl(var(--accent))" },
            ] as const).map((metric) => (
              <div key={metric.key} className="h-[180px] rounded-xl border bg-background/60 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {metric.label}
                </p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rpsTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.2)" />
                    <XAxis dataKey="index" type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      domain={[-9, 9]}
                      ticks={rpsTicks}
                      interval={0}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey={metric.key}
                      stroke={metric.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-background/60 p-4 text-sm text-muted-foreground">
            Enable small multiples to view rolling Return, Pressure, and Stability means.
          </div>
        )}
      </div>

      <DecisionInspectorDrawer
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        decisionIndex={selectedIndex}
        decision={selectedDecision}
        regimeLabel={selectedRegimeLabel}
        returnValue={returnValue}
        pressureValue={pressureValue}
        stabilityValue={stabilityValue}
        dnavValue={dnavValue}
      />
    </div>
  );
}
