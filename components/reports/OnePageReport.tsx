import { ArchetypeRpsChips } from "@/components/reports/ArchetypeRpsChips";
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

type OnePageReportProps = {
  snapshot: CompanyPeriodSnapshot;
  interpretation: FullInterpretation;
  baselineDistributions: BaselineDistributions;
  topCategories: TopCategory[];
  sortedArchetypes: ArchetypeSummary[];
  learningStats: LearningStats;
};

const formatPct = (value: number) => `${value.toFixed(1)}%`;

export default function OnePageReport({
  snapshot,
  interpretation,
  baselineDistributions,
  topCategories,
  sortedArchetypes,
  learningStats,
}: OnePageReportProps) {
  const { companyName, periodLabel, rpsBaseline } = snapshot;
  const { returnDistribution, pressureDistribution, stabilityDistribution } = baselineDistributions;

  const primaryArchetype = sortedArchetypes[0];
  const secondaryArchetype = sortedArchetypes[1];

  return (
    <div className="report-print-page mx-auto max-w-5xl bg-white text-slate-900 p-8 print:p-6 print:max-w-none">
      {/* Header */}
      <header className="flex items-baseline justify-between gap-4 border-b pb-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {companyName} · Decision Orbit {periodLabel}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            System-level RPS profile across {rpsBaseline.totalDecisions} logged decisions
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="font-medium">D-NAV Executive Readout</p>
          <p className="text-slate-500">R · P · S baseline · Learning · Terrain · Archetypes</p>
        </div>
      </header>

      {/* Top grid: narratives + metrics */}
      <section className="grid grid-cols-12 gap-4">
        {/* Narrative column */}
        <div className="col-span-12 space-y-3 md:col-span-7">
          <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase mb-1">Executive Summary</h2>

          <div className="space-y-2 text-xs leading-relaxed">
            {/* RPS Baseline */}
            <div>
              <h3 className="font-semibold text-slate-800">RPS Baseline — Calm, repeatable execution</h3>
              <p>{interpretation.rpsSummary}</p>
            </div>

            {/* Category Profile */}
            <div>
              <h3 className="font-semibold text-slate-800">Category Profile — Where judgment actually lives</h3>
              <p>{interpretation.categorySummary}</p>
            </div>

            {/* Archetype Profile */}
            <div>
              <h3 className="font-semibold text-slate-800">Archetype Profile — Behavioral fingerprint</h3>
              <p>{interpretation.archetypeSummary}</p>
            </div>

            {/* Learning & Recovery */}
            <div>
              <h3 className="font-semibold text-slate-800">Learning &amp; Recovery — Decision debt &amp; correction</h3>
              <p>{interpretation.learningSummary}</p>
            </div>
          </div>
        </div>

        {/* Metrics column */}
        <div className="col-span-12 space-y-3 md:col-span-5">
          {/* Key metrics */}
          <div className="border rounded-md p-3">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Key Metrics Snapshot</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[10px] uppercase text-slate-500">Average D-NAV</p>
                <p className="text-lg font-semibold">{rpsBaseline.avgDnav.toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">Average judgment quality in this window after cost.</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Avg Return (R)</p>
                <p className="text-lg font-semibold">{rpsBaseline.avgReturn.toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">Net value creation per decision.</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Avg Pressure (P)</p>
                <p className="text-lg font-semibold">{rpsBaseline.avgPressure.toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">Execution stress posture.</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Avg Stability (S)</p>
                <p className="text-lg font-semibold">{rpsBaseline.avgStability.toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">How safe decisions leave the system.</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Learning Curve Index</p>
                <p className="text-lg font-semibold">{learningStats.lci.toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">Recovery efficiency after dips.</p>
              </div>
            </div>
          </div>

          {/* Distributions */}
          <div className="border rounded-md p-3 space-y-2">
            <h2 className="text-sm font-semibold text-slate-700">Distributions ({periodLabel})</h2>

            {/* Return */}
            <div className="text-xs">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Return</span>
                <span>
                  Positive {formatPct(returnDistribution.positive)} · Neutral {formatPct(returnDistribution.neutral)} · Negative {formatPct(returnDistribution.negative)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-emerald-500" style={{ width: `${returnDistribution.positive}%` }} />
                <div className="bg-slate-400" style={{ width: `${returnDistribution.neutral}%` }} />
                <div className="bg-rose-500" style={{ width: `${returnDistribution.negative}%` }} />
              </div>
            </div>

            {/* Pressure */}
            <div className="text-xs">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Pressure</span>
                <span>
                  Pressured {formatPct(pressureDistribution.positive)} · Neutral {formatPct(pressureDistribution.neutral)} · Calm {formatPct(pressureDistribution.negative)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-amber-500" style={{ width: `${pressureDistribution.positive}%` }} />
                <div className="bg-slate-400" style={{ width: `${pressureDistribution.neutral}%` }} />
                <div className="bg-sky-500" style={{ width: `${pressureDistribution.negative}%` }} />
              </div>
            </div>

            {/* Stability */}
            <div className="text-xs">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Stability</span>
                <span>
                  Stable {formatPct(stabilityDistribution.positive)} · Neutral {formatPct(stabilityDistribution.neutral)} · Fragile {formatPct(stabilityDistribution.negative)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-emerald-600" style={{ width: `${stabilityDistribution.positive}%` }} />
                <div className="bg-slate-400" style={{ width: `${stabilityDistribution.neutral}%` }} />
                <div className="bg-rose-500" style={{ width: `${stabilityDistribution.negative}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom grid: terrain + archetypes */}
      <section className="grid grid-cols-12 gap-4 mt-4">
        {/* Decision terrain */}
        <div className="col-span-12 border rounded-md p-3 md:col-span-6">
          <div className="space-y-0.5 mb-2">
            <h2 className="text-sm font-semibold text-slate-700">DECISION TERRAIN — TOP JUDGMENT ARENAS</h2>
            <p className="text-[11px] text-slate-500">Where judgment volume concentrates</p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {topCategories.map((cat) => (
              <div key={cat.name} className="border rounded-md p-2">
                <p className="text-[11px] font-semibold">{cat.name}</p>
                <p className="text-[11px] text-slate-500 mb-1">{cat.share.toFixed(1)}% of decisions</p>
                <p className="text-[11px]">
                  Avg D-NAV <span className="font-semibold">{cat.avgDnav.toFixed(1)}</span>
                </p>
                <p className="text-[11px]">
                  R / P / S: <span className="font-semibold">{cat.avgR.toFixed(1)} / {cat.avgP.toFixed(1)} / {cat.avgS.toFixed(1)}</span>
                </p>
                {cat.dominantFactor && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Dominant factor: <span className="font-semibold">{cat.dominantFactor}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Archetype fingerprint */}
        <div className="col-span-12 border rounded-md p-3 md:col-span-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Archetype Fingerprint — {periodLabel}</h2>
          <div className="text-xs space-y-2">
            <p>
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>Primary archetype:</span>
                <span className="inline-flex flex-wrap items-center gap-2 font-semibold">
                  <span>{primaryArchetype?.archetype ?? "Not enough data"}</span>
                  {primaryArchetype && <ArchetypeRpsChips archetype={primaryArchetype.archetype} />}
                </span>
              </span>
              {primaryArchetype && (
                <span className="text-slate-500">
                  {" "}(R {primaryArchetype.avgR.toFixed(1)} · P {primaryArchetype.avgP.toFixed(1)} · S {primaryArchetype.avgS.toFixed(1)} · {primaryArchetype.count} decisions)
                </span>
              )}
            </p>
            <p>
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>Secondary archetype:</span>
                <span className="inline-flex flex-wrap items-center gap-2 font-semibold">
                  <span>{secondaryArchetype?.archetype ?? "Not enough data"}</span>
                  {secondaryArchetype && <ArchetypeRpsChips archetype={secondaryArchetype.archetype} />}
                </span>
              </span>
              {secondaryArchetype && (
                <span className="text-slate-500">
                  {" "}(R {secondaryArchetype.avgR.toFixed(1)} · P {secondaryArchetype.avgP.toFixed(1)} · S {secondaryArchetype.avgS.toFixed(1)} · {secondaryArchetype.count} decisions)
                </span>
              )}
            </p>

            <table className="w-full text-[11px] mt-2 border-t">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-2">Archetype</th>
                  <th className="py-1 pr-2">Count</th>
                  <th className="py-1">Share</th>
                </tr>
              </thead>
              <tbody>
                {sortedArchetypes.slice(0, 4).map((archetype) => (
                  <tr key={archetype.archetype} className="border-t">
                    <td className="py-1 pr-2 font-semibold">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{archetype.archetype}</span>
                        <ArchetypeRpsChips archetype={archetype.archetype} />
                      </div>
                    </td>
                    <td className="py-1 pr-2">{archetype.count}</td>
                    <td className="py-1">
                      {snapshot.rpsBaseline.totalDecisions
                        ? `${((archetype.count / snapshot.rpsBaseline.totalDecisions) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
