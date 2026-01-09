"use client";

import { MetricDistribution } from "@/components/reports/MetricDistribution";
import type { CompanyPeriodSnapshot, FullInterpretation } from "@/lib/dnavSummaryEngine";

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

  const primaryArchetype = sortedArchetypes[0];
  const secondaryArchetype = sortedArchetypes[1];
  const archetypeRows = sortedArchetypes.slice(0, 4);

  const getArchetypeShare = (count: number) =>
    rpsBaseline.totalDecisions > 0 ? ((count / rpsBaseline.totalDecisions) * 100).toFixed(1) : "0.0";

  return (
    <div className="print-root space-y-6 text-foreground">
      <header className="print-section flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">D-NAV Executive Readout</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {companyName} · Decision Orbit {periodLabel}
          </h1>
          <p className="text-sm text-muted-foreground">
            System-level RPS profile across {rpsBaseline.totalDecisions} logged decisions
          </p>
        </div>
        <div className="text-sm text-muted-foreground sm:text-right">
          <p className="font-medium text-foreground">R · P · S baseline · Learning · Terrain · Archetypes</p>
          <p>Executive decision intelligence view</p>
        </div>
      </header>

      <section className="print-section grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Executive Overview</p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {companyName} · Decision Orbit {periodLabel}
            </h2>
            <p className="text-sm text-muted-foreground">
              System-level RPS profile across {rpsBaseline.totalDecisions} logged decisions
            </p>
          </div>

          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">RPS Baseline — Calm, repeatable execution</h3>
              <p>{interpretation.rpsSummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Category Profile — Where judgment actually lives</h3>
              <p>{interpretation.categorySummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Archetype Profile — Behavioral fingerprint</h3>
              <p>{interpretation.archetypeSummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Learning &amp; Recovery — Decision debt &amp; correction</h3>
              <p>{interpretation.learningSummary}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-muted/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Key Metrics Snapshot</p>
                <p className="text-xs text-muted-foreground">Period: {periodLabel}</p>
              </div>
              <span className="text-xs text-muted-foreground">R · P · S averages</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Average D-NAV</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgDnav.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Average judgment quality in this window after cost.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Avg Return (R)</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgReturn.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Net value creation per decision.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Avg Pressure (P)</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgPressure.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Execution stress posture.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Avg Stability (S)</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgStability.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">How safe decisions leave the system.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Learning Curve Index</p>
                <p className="text-lg font-semibold text-foreground">{learningStats.lci.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Recovery efficiency after dips.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-muted/60 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Distributions (Return / Pressure / Stability)
            </p>
            <div className="mt-3 space-y-3 text-sm">
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
      </section>

      <section className="print-section rounded-xl border border-muted/60 p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Decision Terrain — Top Judgment Arenas
            </p>
            <h3 className="text-lg font-semibold text-foreground">Where judgment volume concentrates</h3>
          </div>
          <span className="text-xs text-muted-foreground">Top 3 categories</span>
        </div>
        <div className="mt-4 space-y-4">
          {topCategories.map((category) => (
            <div key={category.name} className="rounded-lg border border-muted/60 p-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{category.name}</span>
                <span className="text-xs text-muted-foreground">{category.decisionCount} decisions</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Share of volume</p>
                  <p className="text-sm font-semibold text-foreground">{formatPct(category.share)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Avg D-NAV</p>
                  <p className="text-sm font-semibold text-foreground">{category.avgDnav.toFixed(1)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">R / P / S</p>
                  <p className="text-sm font-semibold text-foreground">
                    {category.avgR.toFixed(1)} / {category.avgP.toFixed(1)} / {category.avgS.toFixed(1)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Dominant factor</p>
                  <p className="text-sm font-semibold text-foreground">{category.dominantFactor ?? "Balanced"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="print-section rounded-xl border border-muted/60 p-6">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Archetype Fingerprint — {periodLabel}
          </p>
          <p className="text-sm text-muted-foreground">
            Primary: {primaryArchetype?.archetype ?? "N/A"} · Secondary: {secondaryArchetype?.archetype ?? "N/A"}
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-muted/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Archetype</th>
                <th className="px-3 py-2 text-right font-semibold">Decisions</th>
                <th className="px-3 py-2 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/60 bg-white">
              {archetypeRows.map((entry) => (
                <tr key={entry.archetype}>
                  <td className="px-3 py-2 font-medium text-foreground">{entry.archetype}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{entry.count}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{getArchetypeShare(entry.count)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
