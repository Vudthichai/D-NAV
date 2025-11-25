import { DecisionEntry, getArchetype } from "@/lib/calculations";
import { computeLCI } from "./lci";
import { mean, stdev } from "./stats";

const msInDay = 24 * 60 * 60 * 1000;

export interface JudgmentDecision {
  id: string;
  title: string;
  createdAt: number;
  category: string;
  impact0: number;
  cost0: number;
  risk0: number;
  urgency0: number;
  confidence0: number;
  return0: number;
  pressure0: number;
  stability0: number;
  dnavScore: number;
  archetype: string;
  resolutionWindow?: number | string;
  resolvedAt?: number | null;
  impact1?: number;
  cost1?: number;
  risk1?: number;
  urgency1?: number;
  confidence1?: number;
  return1?: number;
  pressure1?: number;
  stability1?: number;
}

export interface RpsBaseline {
  total: number;
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
  returnSegments: { label: string; value: number; color: string; metricKey: string }[];
  pressureSegments: { label: string; value: number; color: string; metricKey: string }[];
  stabilitySegments: { label: string; value: number; color: string; metricKey: string }[];
  bestWorst: {
    label: string;
    title: string;
    value: number;
    createdAt: number;
  }[];
}

export interface LearningMetrics {
  lci: number | null;
  decisionsToRecover: number;
  daysToRecover: number;
  postLossUplift: number;
  dnavVolatility: number;
  winRate: number;
  longestWin: number;
  longestLoss: number;
}

export interface ReturnHygiene {
  currentLossStreak: number;
  worstLossStreak: number;
  maxDrawdown: number;
  returnDebt: number;
  paybackRatio: number;
  averageWin: number;
  averageLoss: number;
  hitRate: number;
}

export interface CategoryHeatmapRow {
  category: string;
  decisionCount: number;
  percent: number;
  avgDnav: number;
  avgR: number;
  avgP: number;
  avgS: number;
  avgImpact: number;
  avgCost: number;
  avgRisk: number;
  avgUrgency: number;
  avgConfidence: number;
  dominantVariable: string;
  stdDnav: number;
  stdReturn: number;
  avgReturnDrift: number;
}

export interface ArchetypePatternRow {
  archetype: string;
  count: number;
  avgR: number;
  avgP: number;
  avgS: number;
  avgDnav: number;
  topCategories: string[];
}

export interface ArchetypePatterns {
  primary: string;
  secondary: string;
  primaryShare: number;
  topThreeShare: number;
  rows: ArchetypePatternRow[];
  distributions: {
    returnSegments: { label: string; value: number; color: string; metricKey: string }[];
    pressureSegments: { label: string; value: number; color: string; metricKey: string }[];
    stabilitySegments: { label: string; value: number; color: string; metricKey: string }[];
  };
}

export interface DriftInsights {
  hasData: boolean;
  variableDrifts: { label: string; value: number }[];
  biasIndices: {
    overconfidence: number;
    underconfidence: number;
    riskUnder: number;
    riskOver: number;
  };
  positiveDrifts: string[];
  negativeDrifts: string[];
}

export interface JudgmentSignals {
  highConfidence: string[];
  highImpact: string[];
  positiveRps: string[];
  lowPressureEfficiency: string[];
  lowFrequencyHighImpact: string[];
  highVolatility: string[];
  highDrift: string[];
}

const safeNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
};

const buildSegments = (values: number[], palette: { positive: string; neutral: string; negative: string }) => {
  const total = values.length || 1;
  const positive = (values.filter((v) => v > 0).length / total) * 100;
  const neutral = (values.filter((v) => v === 0).length / total) * 100;
  const negative = (values.filter((v) => v < 0).length / total) * 100;

  return [
    { label: "Positive", value: positive, color: palette.positive, metricKey: "positive" },
    { label: "Neutral", value: neutral, color: palette.neutral, metricKey: "neutral" },
    { label: "Negative", value: negative, color: palette.negative, metricKey: "negative" },
  ];
};

export const filterDecisionsByTimeframe = (
  decisions: DecisionEntry[],
  timeframeDays: number | null,
): DecisionEntry[] => {
  if (!timeframeDays) return decisions;
  if (decisions.length === 0) return [];

  const referenceTimestamp = decisions[0]?.ts ?? Date.now();
  return decisions.filter((decision) => referenceTimestamp - decision.ts <= timeframeDays * msInDay);
};

export const normalizeDecision = (decision: DecisionEntry): JudgmentDecision => {
  const createdAt = decision.createdAt ?? decision.ts;
  const baseReturn = (decision as unknown as { return0?: number }).return0 ?? decision.return;
  const basePressure = (decision as unknown as { pressure0?: number }).pressure0 ?? decision.pressure;
  const baseStability = (decision as unknown as { stability0?: number }).stability0 ?? decision.stability;

  const impact0 = (decision as unknown as { impact0?: number }).impact0 ?? decision.impact;
  const cost0 = (decision as unknown as { cost0?: number }).cost0 ?? decision.cost;
  const risk0 = (decision as unknown as { risk0?: number }).risk0 ?? decision.risk;
  const urgency0 = (decision as unknown as { urgency0?: number }).urgency0 ?? decision.urgency;
  const confidence0 = (decision as unknown as { confidence0?: number }).confidence0 ?? decision.confidence;

  return {
    id: decision.id ?? String(decision.ts),
    title: decision.title ?? decision.name,
    createdAt,
    category: decision.category ?? "General",
    impact0,
    cost0,
    risk0,
    urgency0,
    confidence0,
    return0: baseReturn,
    pressure0: basePressure,
    stability0: baseStability,
    dnavScore: (decision as unknown as { dnavScore?: number }).dnavScore ?? decision.dnav,
    archetype: decision.archetype ?? getArchetype({
      return: baseReturn,
      pressure: basePressure,
      stability: baseStability,
      merit: 0,
      energy: 0,
      dnav: 0,
    }).name,
    resolutionWindow: decision.resolutionWindow,
    resolvedAt: decision.resolvedAt ?? null,
    impact1: (decision as unknown as { impact1?: number }).impact1,
    cost1: (decision as unknown as { cost1?: number }).cost1,
    risk1: (decision as unknown as { risk1?: number }).risk1,
    urgency1: (decision as unknown as { urgency1?: number }).urgency1,
    confidence1: (decision as unknown as { confidence1?: number }).confidence1,
    return1: (decision as unknown as { return1?: number }).return1,
    pressure1: (decision as unknown as { pressure1?: number }).pressure1,
    stability1: (decision as unknown as { stability1?: number }).stability1,
  };
};

export const computeRpsBaseline = (
  decisions: JudgmentDecision[],
): RpsBaseline => {
  const returns = decisions.map((d) => d.return0);
  const pressures = decisions.map((d) => d.pressure0);
  const stabilities = decisions.map((d) => d.stability0);

  const avgReturn = mean(returns);
  const avgPressure = mean(pressures);
  const avgStability = mean(stabilities);

  const pickExtreme = (
    label: string,
    selector: (d: JudgmentDecision) => number,
    compare: (candidate: number, current: number) => boolean,
  ) => {
    if (!decisions.length) return { label, title: "—", value: 0, createdAt: 0 };
    return decisions.reduce(
      (best, decision) => {
        const value = selector(decision);
        if (
          compare(value, best.value) ||
          (value === best.value && decision.createdAt > best.createdAt)
        ) {
          return { label, title: decision.title, value, createdAt: decision.createdAt };
        }
        return best;
      },
      { label, title: decisions[0].title, value: selector(decisions[0]), createdAt: decisions[0].createdAt },
    );
  };

  const returnSegments = buildSegments(returns, {
    positive: "#22c55e",
    neutral: "#eab308",
    negative: "#ef4444",
  });

  const pressureSegments = buildSegments(pressures, {
    positive: "#ef4444",
    neutral: "#eab308",
    negative: "#22c55e",
  });

  const stabilitySegments = buildSegments(stabilities, {
    positive: "#22c55e",
    neutral: "#eab308",
    negative: "#ef4444",
  });

  return {
    total: decisions.length,
    avgReturn,
    avgPressure,
    avgStability,
    returnSegments,
    pressureSegments,
    stabilitySegments,
    bestWorst: [
      pickExtreme("Best Return", (d) => d.return0, (a, b) => a > b),
      pickExtreme("Worst Return", (d) => d.return0, (a, b) => a < b),
      pickExtreme("Best Pressure", (d) => d.pressure0, (a, b) => a > b),
      pickExtreme("Worst Pressure", (d) => d.pressure0, (a, b) => a < b),
      pickExtreme("Best Stability", (d) => d.stability0, (a, b) => a > b),
      pickExtreme("Worst Stability", (d) => d.stability0, (a, b) => a < b),
    ],
  };
};

const computeRecoveryDecisions = (decisions: JudgmentDecision[]) => {
  let peak = 0;
  let cumulative = 0;
  let drawdownStart = false;
  let steps = 0;
  const recoveries: number[] = [];

  for (const decision of decisions) {
    cumulative += decision.return0;
    if (drawdownStart) steps += 1;

    if (cumulative < peak) {
      drawdownStart = true;
    } else {
      if (drawdownStart && steps > 0) recoveries.push(steps);
      drawdownStart = false;
      steps = 0;
      peak = cumulative;
    }
  }

  return recoveries.length ? mean(recoveries) : 0;
};

const computeLongestStreaks = (decisions: JudgmentDecision[]) => {
  let longestWin = 0;
  let longestLoss = 0;
  let currentWin = 0;
  let currentLoss = 0;

  for (const decision of decisions) {
    if (decision.return0 > 0) {
      currentWin += 1;
      currentLoss = 0;
    } else if (decision.return0 < 0) {
      currentLoss += 1;
      currentWin = 0;
    } else {
      currentWin = 0;
      currentLoss = 0;
    }

    longestWin = Math.max(longestWin, currentWin);
    longestLoss = Math.max(longestLoss, currentLoss);
  }

  return { longestWin, longestLoss, currentLoss };
};

export const computeLearningMetrics = (chronologicalDecisions: JudgmentDecision[]): LearningMetrics => {
  const returns = chronologicalDecisions.map((d) => d.return0);
  const dnavSeries = chronologicalDecisions.map((d) => d.dnavScore);
  const lci = computeLCI(dnavSeries)?.lci ?? null;

  const negativeDurations: number[] = [];
  const uplifts: number[] = [];

  for (let i = 0; i < chronologicalDecisions.length; i++) {
    const decision = chronologicalDecisions[i];
    if (decision.return0 < 0) {
      const nextPositive = chronologicalDecisions.slice(i + 1).find((d) => d.return0 > 0);
      if (nextPositive) {
        negativeDurations.push((nextPositive.createdAt - decision.createdAt) / msInDay);
        uplifts.push(nextPositive.return0);
      }
    }
  }

  const { longestWin, longestLoss } = computeLongestStreaks(chronologicalDecisions);

  return {
    lci,
    decisionsToRecover: computeRecoveryDecisions(chronologicalDecisions),
    daysToRecover: negativeDurations.length ? mean(negativeDurations) : 0,
    postLossUplift: uplifts.length ? mean(uplifts) : 0,
    dnavVolatility: stdev(dnavSeries),
    winRate: returns.length ? (returns.filter((r) => r > 0).length / returns.length) * 100 : 0,
    longestWin,
    longestLoss,
  };
};

export const computeReturnHygiene = (chronologicalDecisions: JudgmentDecision[]): ReturnHygiene => {
  const returns = chronologicalDecisions.map((d) => d.return0);
  const { longestLoss, currentLoss } = computeLongestStreaks(chronologicalDecisions);

  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  let returnDebt = 0;

  for (const value of returns) {
    cumulative += value;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);

    if (value < 0) {
      returnDebt += Math.abs(value);
    } else if (returnDebt > 0) {
      returnDebt = Math.max(0, returnDebt - value);
    }
  }

  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r < 0);
  const avgWin = wins.length ? mean(wins) : 0;
  const avgLoss = losses.length ? mean(losses) : 0;

  const paybackRatio = avgWin !== 0 ? Math.abs(avgLoss) / Math.abs(avgWin) : 0; // avg loss versus avg win

  return {
    currentLossStreak: currentLoss,
    worstLossStreak: longestLoss,
    maxDrawdown: Math.abs(maxDrawdown),
    returnDebt,
    paybackRatio,
    averageWin: avgWin,
    averageLoss: avgLoss,
    hitRate: returns.length ? (wins.length / returns.length) * 100 : 0,
  };
};

export const computeCategoryHeatmap = (
  decisions: JudgmentDecision[],
  totalDecisions: number,
): CategoryHeatmapRow[] => {
  const byCategory: Record<string, JudgmentDecision[]> = {};
  decisions.forEach((decision) => {
    byCategory[decision.category] = byCategory[decision.category] || [];
    byCategory[decision.category].push(decision);
  });

  return Object.entries(byCategory).map(([category, values]) => {
    const avg = <T extends keyof JudgmentDecision>(key: T) => mean(values.map((v) => safeNumber(v[key] as number)));
    const std = <T extends keyof JudgmentDecision>(key: T) => stdev(values.map((v) => safeNumber(v[key] as number)));

    const impactAvg = avg("impact0");
    const costAvg = avg("cost0");
    const riskAvg = avg("risk0");
    const urgencyAvg = avg("urgency0");
    const confidenceAvg = avg("confidence0");

    const dominantPairs: [string, number][] = [
      ["Impact", Math.abs(impactAvg)],
      ["Cost", Math.abs(costAvg)],
      ["Risk", Math.abs(riskAvg)],
      ["Urgency", Math.abs(urgencyAvg)],
      ["Confidence", Math.abs(confidenceAvg)],
    ];
    const dominantVariable = dominantPairs.sort((a, b) => b[1] - a[1])[0][0];

    const returnDrifts = values
      .map((v) => (v.return1 !== undefined ? v.return1 - v.return0 : null))
      .filter((v): v is number => v !== null);

    return {
      category,
      decisionCount: values.length,
      percent: totalDecisions > 0 ? (values.length / totalDecisions) * 100 : 0,
      avgDnav: avg("dnavScore"),
      avgR: avg("return0"),
      avgP: avg("pressure0"),
      avgS: avg("stability0"),
      avgImpact: impactAvg,
      avgCost: costAvg,
      avgRisk: riskAvg,
      avgUrgency: urgencyAvg,
      avgConfidence: confidenceAvg,
      dominantVariable,
      stdDnav: std("dnavScore"),
      stdReturn: std("return0"),
      avgReturnDrift: returnDrifts.length ? mean(returnDrifts) : 0,
    };
  });
};

export const computeArchetypePatterns = (
  chronologicalDecisions: JudgmentDecision[],
  categories: CategoryHeatmapRow[],
): ArchetypePatterns => {
  const counts: Record<string, number> = {};
  const grouped: Record<string, JudgmentDecision[]> = {};

  chronologicalDecisions.forEach((decision) => {
    counts[decision.archetype] = (counts[decision.archetype] || 0) + 1;
    grouped[decision.archetype] = grouped[decision.archetype] || [];
    grouped[decision.archetype].push(decision);
  });

  const sortedArchetypes = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const primary = sortedArchetypes[0]?.[0] ?? "—";
  const secondary = sortedArchetypes[1]?.[0] ?? "—";
  const total = chronologicalDecisions.length || 1;
  const primaryShare = sortedArchetypes[0] ? (sortedArchetypes[0][1] / total) * 100 : 0;
  const topThreeShare = sortedArchetypes.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / total * 100;

  const rows: ArchetypePatternRow[] = Object.entries(grouped).map(([archetype, decisions]) => {
    const topCategories = categories
      .filter((cat) => decisions.some((d) => d.category === cat.category))
      .sort((a, b) => b.decisionCount - a.decisionCount)
      .slice(0, 2)
      .map((cat) => cat.category);

    return {
      archetype,
      count: decisions.length,
      avgR: mean(decisions.map((d) => d.return0)),
      avgP: mean(decisions.map((d) => d.pressure0)),
      avgS: mean(decisions.map((d) => d.stability0)),
      avgDnav: mean(decisions.map((d) => d.dnavScore)),
      topCategories,
    };
  });

  const distributions = {
    returnSegments: buildSegments(
      chronologicalDecisions.map((d) => d.return0),
      { positive: "#22c55e", neutral: "#eab308", negative: "#ef4444" },
    ),
    pressureSegments: buildSegments(
      chronologicalDecisions.map((d) => d.pressure0),
      { positive: "#ef4444", neutral: "#eab308", negative: "#22c55e" },
    ),
    stabilitySegments: buildSegments(
      chronologicalDecisions.map((d) => d.stability0),
      { positive: "#22c55e", neutral: "#eab308", negative: "#ef4444" },
    ),
  };

  return { primary, secondary, primaryShare, topThreeShare, rows, distributions };
};

export const computeDriftInsights = (decisions: JudgmentDecision[]): DriftInsights => {
  const driftCandidates = decisions.filter((d) =>
    [
      d.impact1,
      d.cost1,
      d.risk1,
      d.urgency1,
      d.confidence1,
      d.return1,
      d.pressure1,
      d.stability1,
    ].every((value) => typeof value === "number"),
  );

  if (driftCandidates.length === 0) {
    return {
      hasData: false,
      variableDrifts: [],
      biasIndices: { overconfidence: 0, underconfidence: 0, riskUnder: 0, riskOver: 0 },
      positiveDrifts: [],
      negativeDrifts: [],
    };
  }

  const avgDiff = (selector: (decision: JudgmentDecision) => number) =>
    mean(driftCandidates.map(selector));

  const variableDrifts = [
    { label: "Impact", value: avgDiff((d) => (d.impact1 ?? 0) - d.impact0) },
    { label: "Cost", value: avgDiff((d) => (d.cost1 ?? 0) - d.cost0) },
    { label: "Risk", value: avgDiff((d) => (d.risk1 ?? 0) - d.risk0) },
    { label: "Urgency", value: avgDiff((d) => (d.urgency1 ?? 0) - d.urgency0) },
    { label: "Confidence", value: avgDiff((d) => (d.confidence1 ?? 0) - d.confidence0) },
    { label: "Return", value: avgDiff((d) => (d.return1 ?? 0) - d.return0) },
    { label: "Pressure", value: avgDiff((d) => (d.pressure1 ?? 0) - d.pressure0) },
    { label: "Stability", value: avgDiff((d) => (d.stability1 ?? 0) - d.stability0) },
  ];

  const overconfidence = driftCandidates
    .filter((d) => (d.confidence0 ?? 0) > (d.confidence1 ?? 0))
    .map((d) => (d.confidence0 ?? 0) - (d.confidence1 ?? 0));
  const underconfidence = driftCandidates
    .filter((d) => (d.confidence1 ?? 0) > (d.confidence0 ?? 0))
    .map((d) => (d.confidence1 ?? 0) - (d.confidence0 ?? 0));
  const riskUnder = driftCandidates
    .filter((d) => (d.risk1 ?? 0) > d.risk0)
    .map((d) => (d.risk1 ?? 0) - d.risk0);
  const riskOver = driftCandidates
    .filter((d) => d.risk0 > (d.risk1 ?? 0))
    .map((d) => d.risk0 - (d.risk1 ?? 0));

  const driftByReturn = driftCandidates
    .map((d) => ({ title: d.title, delta: (d.return1 ?? 0) - d.return0 }))
    .sort((a, b) => b.delta - a.delta);

  return {
    hasData: true,
    variableDrifts,
    biasIndices: {
      overconfidence: overconfidence.length ? mean(overconfidence) : 0,
      underconfidence: underconfidence.length ? mean(underconfidence) : 0,
      riskUnder: riskUnder.length ? mean(riskUnder) : 0,
      riskOver: riskOver.length ? mean(riskOver) : 0,
    },
    positiveDrifts: driftByReturn.filter((d) => d.delta > 0).slice(0, 3).map((d) => d.title),
    negativeDrifts: driftByReturn.filter((d) => d.delta < 0).slice(0, 3).map((d) => d.title),
  };
};

export const computeJudgmentSignals = (
  categories: CategoryHeatmapRow[],
  drift: DriftInsights,
): JudgmentSignals => {
  const highConfidence = [...categories]
    .sort((a, b) => b.avgConfidence - a.avgConfidence)
    .slice(0, 3)
    .map((c) => c.category);

  const highImpact = [...categories]
    .sort((a, b) => b.avgImpact - a.avgImpact)
    .slice(0, 3)
    .map((c) => c.category);

  const stabilityMedian = median(categories.map((c) => c.avgS));
  const returnMedian = median(categories.map((c) => c.avgR));
  const pressureMedian = median(categories.map((c) => c.avgP));

  const positiveRps = categories
    .filter((c) => c.avgR > 0 && c.avgS >= stabilityMedian)
    .map((c) => c.category);

  const lowPressureEfficiency = categories
    .filter((c) => c.avgR >= returnMedian && c.avgP <= pressureMedian)
    .map((c) => c.category);

  const impactMedian = median(categories.map((c) => c.avgImpact));
  const countMedian = median(categories.map((c) => c.decisionCount));
  const lowFrequencyHighImpact = categories
    .filter((c) => c.avgImpact >= impactMedian && c.decisionCount <= countMedian)
    .map((c) => c.category);

  const highVolatility = [...categories]
    .map((c) => ({ category: c.category, vol: c.stdDnav + c.stdReturn }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, 3)
    .map((c) => c.category);

  const highDrift = drift.hasData
    ? [...categories]
        .sort((a, b) => Math.abs(b.avgReturnDrift) - Math.abs(a.avgReturnDrift))
        .slice(0, 3)
        .map((c) => c.category)
    : [];

  return {
    highConfidence,
    highImpact,
    positiveRps,
    lowPressureEfficiency,
    lowFrequencyHighImpact,
    highVolatility,
    highDrift,
  };
};

export const buildJudgmentDashboard = (
  decisions: DecisionEntry[],
): {
  normalized: JudgmentDecision[];
  chronological: JudgmentDecision[];
  baseline: RpsBaseline;
  learning: LearningMetrics;
  hygiene: ReturnHygiene;
  categories: CategoryHeatmapRow[];
  archetypes: ArchetypePatterns;
  drift: DriftInsights;
  signals: JudgmentSignals;
} => {
  const normalized = decisions.map(normalizeDecision);
  const chronological = [...normalized].sort((a, b) => a.createdAt - b.createdAt);
  const baseline = computeRpsBaseline(normalized);
  const learning = computeLearningMetrics(chronological);
  const hygiene = computeReturnHygiene(chronological);
  const categories = computeCategoryHeatmap(normalized, normalized.length);
  const archetypes = computeArchetypePatterns(chronological, categories);
  const drift = computeDriftInsights(normalized);
  const signals = computeJudgmentSignals(categories, drift);

  return { normalized, chronological, baseline, learning, hygiene, categories, archetypes, drift, signals };
};
