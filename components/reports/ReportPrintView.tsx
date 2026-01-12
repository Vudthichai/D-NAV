"use client";

import { MetricDistribution } from "@/components/reports/MetricDistribution";
import { ArchetypeRpsChips } from "@/components/reports/ArchetypeRpsChips";
import { Callout } from "@/components/ui/Callout";
import type { CompanyPeriodSnapshot, FullInterpretation } from "@/lib/dnavSummaryEngine";
import { getSystemDirective } from "@/lib/systemDirective";

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

  const systemDirective = getSystemDirective({
    avgReturn: rpsBaseline.avgReturn,
    avgPressure: rpsBaseline.avgPressure,
    avgStability: rpsBaseline.avgStability,
    pressurePressuredPct: pressureDistribution.positive,
    stabilityFragilePct: stabilityDistribution.negative,
  });

  return (
    <div className="print-root space-y-6 text-neutral-900">
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

      <section className="print-section grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
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
              <h3 className="text-[13px] font-semibold text-neutral-900">RPS Baseline — Calm, repeatable execution</h3>
              <p>{interpretation.rpsSummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-[13px] font-semibold text-neutral-900">
                Category Profile — Where judgment actually lives
              </h3>
              <p>{interpretation.categorySummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-[13px] font-semibold text-neutral-900">Archetype Profile — Behavioral fingerprint</h3>
              <p>{interpretation.archetypeSummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-[13px] font-semibold text-neutral-900">
                Learning &amp; Recovery — Decision debt &amp; correction
              </h3>
              <p>{interpretation.learningSummary}</p>
            </div>
          </div>

          <Callout label="System Directive">
            <p>{systemDirective}</p>
            <p className="mt-2 text-[11px] text-neutral-600">
              Apply this by logging new decisions in the categories below.
            </p>
          </Callout>
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
      </section>

      <section className="print-section rounded-2xl border border-black/10 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-900">
              Decision Terrain — Top Judgment Arenas
            </p>
            <h3 className="text-base font-semibold text-neutral-900">Where judgment volume concentrates</h3>
          </div>
          <span className="text-[11px] text-neutral-900">Top 3 categories</span>
        </div>
        <div className="mt-4 space-y-4">
          {topCategories.map((category) => (
            <div key={category.name} className="rounded-2xl border border-black/10 p-3">
              <div className="flex items-center justify-between text-[13px] font-semibold">
                <div className="space-y-1">
                  <span>{category.name}</span>
                  <p className="text-[10px] font-normal text-neutral-500">Log next decision in this category</p>
                </div>
                <span className="text-[11px] text-neutral-900">{category.decisionCount} decisions</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-[11px] leading-[1.45] text-neutral-900 sm:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Share of volume</p>
                  <p className="text-[13px] font-semibold text-neutral-900">{formatPct(category.share)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Avg D-NAV</p>
                  <p className="text-[13px] font-semibold text-neutral-900">{category.avgDnav.toFixed(1)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">R / P / S</p>
                  <p className="text-[13px] font-semibold text-neutral-900">
                    {category.avgR.toFixed(1)} / {category.avgP.toFixed(1)} / {category.avgS.toFixed(1)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Dominant factor</p>
                  <p className="text-[13px] font-semibold text-neutral-900">
                    {category.dominantFactor ?? "Balanced"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="print-section rounded-2xl border border-black/10 p-5">
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
      </section>
    </div>
  );
}
