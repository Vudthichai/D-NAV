"use client";

import React, { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Gauge,
  LineChart,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DashboardStats,
  DistributionInsight,
  buildPortfolioNarrative,
  formatValue,
} from "@/utils/dashboardStats";

interface ExecutiveOnePagerProps {
  stats: DashboardStats;
  timeframeLabel: string;
  cadenceLabel: string;
  generatedAt: string;
  distributionInsights: DistributionInsight[];
  returnDebtSummary: string;
  hasData: boolean;
}

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "negative" | "warning";
}

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "text-muted-foreground",
  positive: "text-emerald-600",
  negative: "text-red-600",
  warning: "text-amber-600",
};

const MetricCard = ({ label, value, helper, icon: Icon, tone = "default" }: MetricCardProps) => (
  <div className="flex flex-col gap-2 rounded-xl border bg-background/80 p-4 shadow-sm">
    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      {label}
    </div>
    <div className={`text-2xl font-semibold ${toneClasses[tone]}`}>{value}</div>
    <p className="text-xs text-muted-foreground">{helper}</p>
  </div>
);

interface DistributionSegment {
  label: string;
  value: number;
  color: string;
}

const DistributionBlock = ({ title, segments }: { title: string; segments: DistributionSegment[] }) => {
  const safeSegments = segments.map((segment) => ({
    ...segment,
    value: Number.isFinite(segment.value) && segment.value > 0 ? segment.value : 0,
  }));
  const total = safeSegments.reduce((sum, segment) => sum + segment.value, 0);
  const hasData = total > 0;

  return (
    <Card className="border bg-background/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {hasData ? (
          <>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              {safeSegments.map((segment) => (
                <div
                  key={segment.label}
                  className="h-full"
                  style={{
                    width: `${segment.value}%`,
                    backgroundColor: segment.color,
                  }}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              {safeSegments.map((segment) => (
                <div key={`${title}-${segment.label}`} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="text-foreground">{segment.label}</span>
                  <span className="ml-auto font-medium text-foreground">{formatValue(segment.value)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No logged decisions in this window.</p>
        )}
      </CardContent>
    </Card>
  );
};

const ExecutiveOnePager = React.forwardRef<HTMLDivElement, ExecutiveOnePagerProps>(
  ({
    stats,
    timeframeLabel,
    cadenceLabel,
    generatedAt,
    distributionInsights,
    returnDebtSummary,
    hasData,
  }, ref) => {
    const narrative = hasData
      ? buildPortfolioNarrative(stats, { timeframeLabel, cadenceLabel })
      : "Log decisions in D-NAV to unlock the executive snapshot.";
    const narrativeParagraphs = narrative.split("\n\n");

    return (
      <div
        ref={ref}
        className="relative isolate overflow-hidden rounded-3xl border bg-card p-6 shadow-xl"
      >
        <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center -z-10 opacity-5">
          <span className="text-6xl font-black tracking-[0.8rem] text-primary/20">
            DECISION NAVIGATOR
          </span>
        </div>
        <div className="pointer-events-none absolute bottom-10 right-6 select-none text-[10px] font-semibold uppercase tracking-[0.4em] text-primary/50 -z-10">
          The Decision NAVigator
        </div>
        <div className="relative z-10 space-y-6">
          <header className="flex flex-col gap-3">
            <Badge variant="outline" className="w-fit uppercase tracking-wide">
              Executive One-Pager
            </Badge>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-semibold text-foreground">Decision Portfolio Brief</h2>
              <p className="text-xs text-muted-foreground">Generated {generatedAt}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {timeframeLabel} · Cadence basis: per {cadenceLabel}
            </p>
          </header>

          {!hasData ? (
            <Card className="border bg-background/80">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {narrative}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <section className="rounded-xl border bg-background/80 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-foreground">Portfolio Narrative</h3>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Snapshot
                  </Badge>
                </div>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                  {narrativeParagraphs.map((paragraph, index) => {
                    const lines = paragraph.split("\n");
                    return (
                      <p key={index} className="whitespace-pre-wrap">
                        {lines.map((line, lineIndex) => (
                          <Fragment key={lineIndex}>
                            {line}
                            {lineIndex < lines.length - 1 && <br />}
                          </Fragment>
                        ))}
                      </p>
                    );
                  })}
                </div>
              </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Average D-NAV"
                value={formatValue(stats.avgDnav)}
                helper="Portfolio average for the selected window"
                icon={Target}
                tone={stats.avgDnav > 0 ? "positive" : stats.avgDnav < 0 ? "negative" : "default"}
              />
              <MetricCard
                label="Return"
                value={formatValue(stats.returnDistribution.positive - stats.returnDistribution.negative)}
                helper="Positive vs. negative balance"
                icon={TrendingUp}
                tone={stats.returnDistribution.positive >= stats.returnDistribution.negative ? "positive" : "negative"}
              />
              <MetricCard
                label="Stability"
                value={formatValue(stats.stabilityDistribution.stable - stats.stabilityDistribution.fragile)}
                helper="Confidence vs. fragility"
                icon={Gauge}
                tone={
                  stats.stabilityDistribution.stable >= stats.stabilityDistribution.fragile
                    ? "positive"
                    : "warning"
                }
              />
              <MetricCard
                label="Pressure"
                value={formatValue(stats.pressureDistribution.pressured - stats.pressureDistribution.calm)}
                helper="Pressure minus calm"
                icon={Activity}
                tone={
                  stats.pressureDistribution.pressured > stats.pressureDistribution.calm ? "warning" : "positive"
                }
              />
              <MetricCard
                label="Cadence"
                value={`${formatValue(stats.cadence)} / ${cadenceLabel}`}
                helper="Average decision frequency"
                icon={BarChart3}
              />
              <MetricCard
                label="Return on Effort"
                value={formatValue(stats.returnOnEffort, 2)}
                helper="Return per unit energy"
                icon={Zap}
                tone={stats.returnOnEffort > 0 ? "positive" : "default"}
              />
              <MetricCard
                label="Trend"
                value={formatValue(stats.trend)}
                helper="EMA(7) minus EMA(30)"
                icon={TrendingUp}
                tone={stats.trend > 0 ? "positive" : stats.trend < 0 ? "negative" : "default"}
              />
              <MetricCard
                label="Recent Change"
                value={formatValue(stats.last5vsPrior5)}
                helper="Last five decisions vs. prior five"
                icon={LineChart}
                tone={
                  stats.last5vsPrior5 > 0
                    ? "positive"
                    : stats.last5vsPrior5 < 0
                    ? "negative"
                    : "default"
                }
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <DistributionBlock
                title="Return Distribution"
                segments={[
                  { label: "Positive", value: stats.returnDistribution.positive, color: "#22c55e" },
                  { label: "Neutral", value: stats.returnDistribution.neutral, color: "#64748b" },
                  { label: "Negative", value: stats.returnDistribution.negative, color: "#ef4444" },
                ]}
              />
              <DistributionBlock
                title="Stability Distribution"
                segments={[
                  { label: "Stable", value: stats.stabilityDistribution.stable, color: "#3b82f6" },
                  { label: "Uncertain", value: stats.stabilityDistribution.uncertain, color: "#f59e0b" },
                  { label: "Fragile", value: stats.stabilityDistribution.fragile, color: "#f43f5e" },
                ]}
              />
              <DistributionBlock
                title="Pressure Distribution"
                segments={[
                  { label: "Pressured", value: stats.pressureDistribution.pressured, color: "#f97316" },
                  { label: "Balanced", value: stats.pressureDistribution.balanced, color: "#6366f1" },
                  { label: "Calm", value: stats.pressureDistribution.calm, color: "#14b8a6" },
                ]}
              />
            </section>

            <section className="grid gap-4 md:grid-cols-[2fr_3fr]">
              <Card className="border bg-background/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" /> Window Archetype
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xl font-semibold text-foreground">{stats.windowArchetype}</p>
                  <p className="text-sm leading-snug text-muted-foreground">
                    {stats.windowArchetypeDescription}
                  </p>
                  <Separator />
                  <div className="grid grid-cols-1 gap-1 text-sm text-muted-foreground">
                    <span>Return: {stats.windowArchetypeBreakdown.returnType}</span>
                    <span>Stability: {stats.windowArchetypeBreakdown.stabilityType}</span>
                    <span>Pressure: {stats.windowArchetypeBreakdown.pressureType}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Return Hygiene
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Loss Streak</p>
                      <p className="text-2xl font-semibold text-foreground">
                        {stats.lossStreak.current}
                        <span className="text-sm text-muted-foreground"> / {stats.lossStreak.longest}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">Current / longest streak</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Return Debt</p>
                      <p className="text-2xl font-semibold text-foreground">{formatValue(stats.returnDebt)}</p>
                      <p className="text-[11px] text-muted-foreground">D-NAV units owed</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Payback Ratio</p>
                      <p className="text-2xl font-semibold text-foreground">{formatValue(stats.paybackRatio)}</p>
                      <p className="text-[11px] text-muted-foreground">Avg +return per win</p>
                    </div>
                  </div>
                  <p className="text-sm leading-snug text-muted-foreground">{returnDebtSummary}</p>
                  <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-4">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <p className="text-sm text-muted-foreground">
                      <strong>Remember:</strong> Losses aren’t “bad.” Unmanaged streaks are. Track them so “learning” doesn’t
                      become a silent bleed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="rounded-xl border bg-background/80 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">Feedback Loops</h3>
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                {distributionInsights.map((insight) => (
                  <div key={insight.label} className="flex gap-2">
                    <TrendingDown className="mt-1 h-4 w-4 text-primary" />
                    <p>
                      <span className="font-medium text-foreground">{insight.label}:</span> {insight.message}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
        </div>
      </div>
    );
  },
);

ExecutiveOnePager.displayName = "ExecutiveOnePager";

export default ExecutiveOnePager;
