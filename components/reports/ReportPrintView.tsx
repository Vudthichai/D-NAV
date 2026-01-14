"use client";

import { MetricDistribution } from "@/components/reports/MetricDistribution";
import { ArchetypeRpsChips } from "@/components/reports/ArchetypeRpsChips";
import { Callout } from "@/components/ui/Callout";
import { Badge } from "@/components/ui/badge";
import { type CategoryActionInsightResult } from "@/lib/categoryActionInsight";
import type { CompanyPeriodSnapshot, FullInterpretation } from "@/lib/dnavSummaryEngine";
import { getSystemDirective } from "@/lib/systemDirective";
import { cn } from "@/lib/utils";

type BaselineDistribution = {
  positive: number;
  neutral: number;
  negative: number;
};

type BaselineDistributions = {
  returnDistribution: BaselineDistribution;
  pressureDistribution: BaselineDistribution;
  stabilityDistribution: BaselineDistribution;
};

type TopCategory = {
  name: string;
  decisionCount: number;
  share: number;
  avgDnav: number;
  avgR: number;
  avgP: number;
  avgS: number;
  dominantFactor: string | null;
  insight: CategoryActionInsightResult;
};

type ArchetypeSummary = {
  archetype: string;
  avgR: number;
  avgP: number;
  avgS: number;
  count: number;
};

type LearningStats = {
  lci: number;
  decisionsToRecover: number;
  winRate: number;
  decisionDebt: number;
};

type ReportPrintViewProps = {
  snapshot: CompanyPeriodSnapshot;
  interpretation: FullInterpretation;
  baselineDistributions: BaselineDistributions;
  topCategories: TopCategory[];
  sortedArchetypes: ArchetypeSummary[];
  learningStats: LearningStats;
};

const formatPct = (value: number) => `${value.toFixed(1)}%`;

export function ReportPrintView({
  snapshot,
  interpretation,
  baselineDistributions,
  topCategories,
  sortedArchetypes,
  learningStats,
}: ReportPrintViewProps) {
  const { companyName, periodLabel, rpsBaseline } = snapshot;
  const { returnDistribution, pressureDistribution, stabilityDistribution } = baselineDistributions;
  const signalToneStyles = {
    strong: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    weak: "bg-muted text-neutral-600",
  };

  const primaryArchetype = sortedArchetypes[0];
  const secondaryArchetype = sortedArchetypes[1];
  const archetypeRows = sortedArchetypes.slice(0, 4);
  const neutralStatPillClass =
    "rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted/40 text-muted-foreground border border-muted/60";

  const getArchetypeShare = (count: number) =>
    rpsBaseline.totalDecisions > 0 ? ((count / rpsBaseline.totalDecisions) * 100).toFixed(1) : "0.0";

  const systemDirective = getSystemDirective({
    avgReturn: rpsBaseline.avgReturn,
    avgPressure: rpsBaseline.avgPressure,
    avgStability: rpsBaseline.avgStability,
    pressurePressuredPct: pressureDistribution.positive,
    stabilityFragilePct: stabilityDistribution.negative,
  });

  return (
    <div className="print-root space-y-6 text-neutral-900">
      <div className="printPage space-y-6">
        <header className="print-section flex flex-col gap-2 border-b border-black/10 pb-4 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-900">D-NAV Executive Readout</p>
            <h1 className="text-xl font-semibold tracking-tight">
              {companyName} · Decision Orbit {periodLabel}
            </h1>
            <p className="text-[13px] leading-[1.45] text-neutral-900">
              System-level RPS profile across {rpsBaseline.totalDecisions} logged decisions
            </p>
          </div>
          <div className="text-[13px] leading-[1.45] text-neutral-900 sm:text-right">
            <p className="font-semibold text-neutral-900">R · P · S baseline · Learning · Terrain · Archetypes</p>
            <p>Executive decision intelligence view</p>
          </div>
        </header>

        <section className="print-section">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] print:gap-5 print:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-900">Executive Overview</p>
                <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
                  {companyName} · Decision Orbit {periodLabel}
                </h2>
                <p className="text-[13px] leading-[1.45] text-neutral-900">
                  System-level RPS profile across {rpsBaseline.totalDecisions} logged decisions
                </p>
              </div>

              <div className="space-y-3 text-[13px] leading-[1.45] text-neutral-900">
                <div className="space-y-1">
                  <h3 className="text-[13px] font-semibold text-neutral-900">
                    RPS Baseline — Calm, repeatable execution
                  </h3>
                  <p>{interpretation.rpsSummary}</p>
                </div>
                <div className="space-y-1">
                  <h3 className="text-[13px] font-semibold text-neutral-900">
                    Category Profile — Where judgment actually lives
                  </h3>
                  <p>{interpretation.categorySummary}</p>
                </div>
                <div className="space-y-1">
                  <h3 className="text-[13px] font-semibold text-neutral-900">
                    Archetype Profile — Behavioral fingerprint
                  </h3>
                  <p>{interpretation.archetypeSummary}</p>
                </div>
                <div className="space-y-1">
                  <h3 className="text-[13px] font-semibold text-neutral-900">
                    Learning &amp; Recovery — Decision debt &amp; correction
                  </h3>
                  <p>{interpretation.learningSummary}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-black/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-900">
                      Key Metrics Snapshot
                    </p>
                    <p className="text-[11px] text-neutral-900">Period: {periodLabel}</p>
                  </div>
                  <span className="text-[11px] text-neutral-900">R · P · S averages</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[13px] leading-[1.45]">
                  <div>
                    <p className="text-[11px] uppercase text-neutral-900">Average D-NAV</p>
                    <p className="text-base font-semibold text-neutral-900">{rpsBaseline.avgDnav.toFixed(1)}</p>
                    <p className="text-[11px] leading-[1.45] text-neutral-900">
                      Average judgment quality in this window after cost.
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-neutral-900">Avg Return (R)</p>
                    <p className="text-base font-semibold text-neutral-900">{rpsBaseline.avgReturn.toFixed(1)}</p>
                    <p className="text-[11px] leading-[1.45] text-neutral-900">Net value creation per decision.</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-neutral-900">Avg Pressure (P)</p>
                    <p className="text-base font-semibold text-neutral-900">{rpsBaseline.avgPressure.toFixed(1)}</p>
                    <p className="text-[11px] leading-[1.45] text-neutral-900">Execution stress posture.</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-neutral-900">Avg Stability (S)</p>
                    <p className="text-base font-semibold text-neutral-900">{rpsBaseline.avgStability.toFixed(1)}</p>
                    <p className="text-[11px] leading-[1.45] text-neutral-900">How safe decisions leave the system.</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-neutral-900">Learning Curve Index</p>
                    <p className="text-base font-semibold text-neutral-900">{learningStats.lci.toFixed(1)}</p>
                    <p className="text-[11px] leading-[1.45] text-neutral-900">Recovery efficiency after dips.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-900">
                  Distributions (Return / Pressure / Stability)
                </p>
                <div className="mt-3 space-y-3 text-[13px] leading-[1.45]">
                  <MetricDistribution
                    metricLabel="Return"
                    segments={[
                      { label: "Positive", value: returnDistribution.positive, colorClass: "bg-emerald-500" },
                      { label: "Neutral", value: returnDistribution.neutral, colorClass: "bg-muted" },
                      { label: "Negative", value: returnDistribution.negative, colorClass: "bg-rose-500" },
                    ]}
                  />
                  <MetricDistribution
                    metricLabel="Pressure"
                    segments={[
                      { label: "Pressured", value: pressureDistribution.positive, colorClass: "bg-amber-500" },
                      { label: "Neutral", value: pressureDistribution.neutral, colorClass: "bg-muted" },
                      { label: "Calm", value: pressureDistribution.negative, colorClass: "bg-sky-500" },
                    ]}
                  />
                  <MetricDistribution
                    metricLabel="Stability"
                    segments={[
                      { label: "Stable", value: stabilityDistribution.positive, colorClass: "bg-emerald-600" },
                      { label: "Neutral", value: stabilityDistribution.neutral, colorClass: "bg-muted" },
                      { label: "Fragile", value: stabilityDistribution.negative, colorClass: "bg-rose-500" },
                    ]}
                  />
                </div>
              </div>
            </div>

            <Callout
              label="SYSTEM DIRECTIVE"
              className="print-full-width print-avoid-break lg:col-span-2 print:col-span-2"
            >
              <div className="space-y-2">
                {systemDirective.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-neutral-600">
                Apply this by logging new decisions in the categories below.
              </p>
            </Callout>
          </div>
        </section>
      </div>

      <div className="printPage">
        <section className="print-section print-two-column print-page2-stack grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="print-two-column__left print-avoid-break rounded-2xl border border-black/10 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-[16px] font-bold tracking-wide text-neutral-900">
                  DECISION TERRAIN — TOP JUDGMENT ARENAS
                </h3>
                <p className="print-category-label-sm text-[10px] text-neutral-400">
                  Where judgment volume concentrates
                </p>
              </div>
              <span className="print-category-label text-[11px] text-neutral-900">Top 3 categories</span>
            </div>
            <div className="mt-4 space-y-4">
              {topCategories.map((category) => (
                <div key={category.name} className="print-avoid-break rounded-2xl border border-black/10 p-3">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                        <span className="print-category-title">{category.name}</span>
                        <span className="print-category-label text-[11px] text-neutral-900">
                          {category.decisionCount} decisions
                        </span>
                      </div>
                      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                        <Badge variant="secondary" className={neutralStatPillClass}>
                          Volume: {formatPct(category.share)}
                        </Badge>
                        <Badge variant="secondary" className={neutralStatPillClass}>
                          Avg D-NAV: {category.avgDnav.toFixed(1)}
                        </Badge>
                        <Badge variant="secondary" className={neutralStatPillClass}>
                          R / P / S: {category.avgR.toFixed(1)} / {category.avgP.toFixed(1)} / {category.avgS.toFixed(1)}
                        </Badge>
                        <Badge variant="secondary" className={neutralStatPillClass}>
                          Dominant: {category.dominantFactor ?? "Balanced"}
                        </Badge>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-orange-100 border-l-4 border-l-orange-500 bg-orange-50/70 px-4 py-3">
                      <div className="print-category-label flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                        <span>Category Action Insight</span>
                        <Badge
                          variant="secondary"
                          className={cn("text-[10px] font-semibold", signalToneStyles[category.insight.signalStrength])}
                        >
                          {category.insight.signalStrength === "strong"
                            ? "Strong signal"
                            : category.insight.signalStrength === "medium"
                              ? "Medium signal"
                              : "Weak signal"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[13px] leading-[1.45] text-neutral-900">
                        {category.insight.insightText}
                      </p>
                      {category.insight.logMoreHint && (
                        <p className="mt-2 text-[11px] text-neutral-600">{category.insight.logMoreHint}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="print-two-column__right print-avoid-break rounded-2xl border border-black/10 p-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-900">
                Archetype Fingerprint — {periodLabel}
              </p>
              <p className="text-[13px] leading-[1.45] text-neutral-900">
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>Primary:</span>
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>{primaryArchetype?.archetype ?? "N/A"}</span>
                    {primaryArchetype && <ArchetypeRpsChips archetype={primaryArchetype.archetype} />}
                  </span>
                  <span>· Secondary:</span>
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>{secondaryArchetype?.archetype ?? "N/A"}</span>
                    {secondaryArchetype && <ArchetypeRpsChips archetype={secondaryArchetype.archetype} />}
                  </span>
                </span>
              </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
              <table className="w-full text-[13px] leading-[1.45]">
                <thead className="bg-black/[0.04] text-[11px] uppercase tracking-wide text-neutral-900">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Archetype</th>
                    <th className="px-3 py-2 text-right font-semibold">Decisions</th>
                    <th className="px-3 py-2 text-right font-semibold">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 bg-white">
                  {archetypeRows.map((entry) => (
                    <tr key={entry.archetype}>
                      <td className="px-3 py-2 font-medium text-neutral-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{entry.archetype}</span>
                          <ArchetypeRpsChips archetype={entry.archetype} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-900">{entry.count}</td>
                      <td className="px-3 py-2 text-right text-neutral-900">{getArchetypeShare(entry.count)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
