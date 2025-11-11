import { DecisionEntry, ema, getArchetype, stdev } from "@/lib/calculations";

export interface DashboardStats {
  totalDecisions: number;
  avgDnav: number;
  trend: number;
  consistency: number;
  cadence: number;
  last5vsPrior5: number;
  windowArchetype: string;
  windowArchetypeDescription: string;
  windowArchetypeBreakdown: {
    returnType: string;
    stabilityType: string;
    pressureType: string;
  };
  returnOnEffort: number;
  returnDistribution: { positive: number; neutral: number; negative: number };
  stabilityDistribution: { stable: number; uncertain: number; fragile: number };
  pressureDistribution: { pressured: number; balanced: number; calm: number };
  lossStreak: { current: number; longest: number };
  returnDebt: number;
  paybackRatio: number;
}

export interface DistributionInsight {
  label: string;
  message: string;
}

export type CadenceUnit = "day" | "week" | "month";

export interface ComputeDashboardStatsOptions {
  timeframeDays?: number | null;
  cadenceUnit?: CadenceUnit;
}

export const formatValue = (value: number, digits = 1) =>
  Number.isFinite(value) ? Number(value).toFixed(digits) : "0";

const describeDistribution = (
  total: number,
  dominant: number,
  dominantLabel: string,
  fallbackMessage: string,
  mixedMessage: string,
) => {
  if (total <= 0) return fallbackMessage;
  if (dominant >= 50) return dominantLabel;
  return mixedMessage;
};

export const describeReturnDistribution = (
  distribution: DashboardStats["returnDistribution"],
): DistributionInsight => {
  const total = distribution.positive + distribution.neutral + distribution.negative;
  const message = describeDistribution(
    total,
    distribution.positive,
    "Mostly positive — decisions are paying off.",
    "No meaningful read — log a few more decisions.",
    "Mixed picture — monitor the next set of calls for clarity.",
  );

  if (total > 0 && distribution.negative >= 50) {
    return {
      label: "Return",
      message: "Skewed negative — tighten risk filters before committing.",
    };
  }

  if (total > 0 && distribution.neutral >= 50) {
    return { label: "Return", message: "Largely neutral — upside is stalling." };
  }

  return { label: "Return", message };
};

export const describeStabilityDistribution = (
  distribution: DashboardStats["stabilityDistribution"],
): DistributionInsight => {
  const total = distribution.stable + distribution.uncertain + distribution.fragile;
  const message = describeDistribution(
    total,
    distribution.stable,
    "Confidence outweighs doubt — execution remains steady.",
    "No meaningful read — log a few more decisions.",
    "Mixed footing — stability signal is split.",
  );

  if (total > 0 && distribution.fragile >= 50) {
    return {
      label: "Stability",
      message: "Fragility showing — shore up conviction before scaling.",
    };
  }

  if (total > 0 && distribution.uncertain >= 50) {
    return {
      label: "Stability",
      message: "Uneven footing — clarify signals before the next swing.",
    };
  }

  return { label: "Stability", message };
};

export const describePressureDistribution = (
  distribution: DashboardStats["pressureDistribution"],
): DistributionInsight => {
  const total = distribution.pressured + distribution.balanced + distribution.calm;
  const message = describeDistribution(
    total,
    distribution.calm,
    "Majority calm — low reactivity during action.",
    "No meaningful read — log a few more decisions.",
    "Mixed tempo — pressure signal is split.",
  );

  if (total > 0 && distribution.pressured >= 50) {
    return {
      label: "Pressure",
      message: "Elevated tension — pace decisions to avoid overtrading.",
    };
  }

  if (total > 0 && distribution.balanced >= 50) {
    return {
      label: "Pressure",
      message: "Evenly balanced — stay alert for momentum shifts.",
    };
  }

  return { label: "Pressure", message };
};

export const buildDistributionInsights = (current: DashboardStats): DistributionInsight[] => [
  describeReturnDistribution(current.returnDistribution),
  describeStabilityDistribution(current.stabilityDistribution),
  describePressureDistribution(current.pressureDistribution),
];

export const buildReturnDebtSummary = (current: DashboardStats): string => {
  if (current.returnDebt <= 0) {
    return "No active return debt — keep compounding disciplined entries.";
  }

  if (current.paybackRatio > 0) {
    const winsNeeded = current.returnDebt / current.paybackRatio;
    return `${formatValue(current.returnDebt)} D-NAV of return debt requires about ${formatValue(
      winsNeeded,
      1,
    )} positive decisions averaging +${formatValue(current.paybackRatio)} D-NAV each to reset.`;
  }

  return `Return debt sits at ${formatValue(
    current.returnDebt,
  )} D-NAV. Stack quality wins to offset the streak.`;
};

export const computeDashboardStats = (
  decisions: DecisionEntry[],
  { timeframeDays = null, cadenceUnit = "week" }: ComputeDashboardStatsOptions = {},
): DashboardStats => {
  if (decisions.length === 0) {
    return {
      totalDecisions: 0,
      avgDnav: 0,
      trend: 0,
      consistency: 0,
      cadence: 0,
      last5vsPrior5: 0,
      windowArchetype: "No Data",
      windowArchetypeDescription: "No archetype available",
      windowArchetypeBreakdown: {
        returnType: "—",
        stabilityType: "—",
        pressureType: "—",
      },
      returnOnEffort: 0,
      returnDistribution: { positive: 0, neutral: 0, negative: 0 },
      stabilityDistribution: { stable: 0, uncertain: 0, fragile: 0 },
      pressureDistribution: { pressured: 0, balanced: 0, calm: 0 },
      lossStreak: { current: 0, longest: 0 },
      returnDebt: 0,
      paybackRatio: 0,
    };
  }

  const now = decisions[0]?.ts ?? Date.now();
  const msInDay = 24 * 60 * 60 * 1000;

  const filteredDecisions = timeframeDays
    ? decisions.filter((decision) => now - decision.ts <= timeframeDays * msInDay)
    : decisions;

  if (filteredDecisions.length === 0) {
    return computeDashboardStats([], { cadenceUnit });
  }

  const dnavScores = filteredDecisions.map((d) => d.dnav);
  const returnScores = filteredDecisions.map((d) => d.return);
  const stabilityScores = filteredDecisions.map((d) => d.stability);
  const pressureScores = filteredDecisions.map((d) => d.pressure);
  const energyScores = filteredDecisions.map((d) => d.energy);

  const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

  const avgDnav = avg(dnavScores);
  const consistency = stdev(dnavScores);

  const recentDecisions = decisions.slice(0, 30);
  const recentDnavs = recentDecisions.map((d) => d.dnav);
  const trend = recentDnavs.length >= 7 ? ema(recentDnavs, 7) - ema(recentDnavs, 30) : 0;

  const timeSpanDays = timeframeDays ? timeframeDays : (now - decisions[decisions.length - 1].ts) / msInDay;
  const cadenceBase = cadenceUnit === "day" ? 1 : cadenceUnit === "week" ? 7 : 30;
  const cadence = timeSpanDays > 0 ? (filteredDecisions.length / timeSpanDays) * cadenceBase : 0;

  const returnDistribution = {
    positive: (returnScores.filter((r) => r > 0).length / returnScores.length) * 100,
    neutral: (returnScores.filter((r) => r === 0).length / returnScores.length) * 100,
    negative: (returnScores.filter((r) => r < 0).length / returnScores.length) * 100,
  };

  const stabilityDistribution = {
    stable: (stabilityScores.filter((s) => s > 0).length / stabilityScores.length) * 100,
    uncertain: (stabilityScores.filter((s) => s === 0).length / stabilityScores.length) * 100,
    fragile: (stabilityScores.filter((s) => s < 0).length / stabilityScores.length) * 100,
  };

  const pressureDistribution = {
    pressured: (pressureScores.filter((p) => p > 0).length / pressureScores.length) * 100,
    balanced: (pressureScores.filter((p) => p === 0).length / pressureScores.length) * 100,
    calm: (pressureScores.filter((p) => p < 0).length / pressureScores.length) * 100,
  };

  const avgReturn = avg(returnScores);
  const avgStability = avg(stabilityScores);
  const avgPressure = avg(pressureScores);

  const archetypeInfo = getArchetype({
    return: avgReturn,
    stability: avgStability,
    pressure: avgPressure,
    merit: 0,
    energy: 0,
    dnav: 0,
  });

  const totalEnergy = energyScores.reduce((a, b) => a + b, 0);
  const totalReturn = returnScores.reduce((a, b) => a + b, 0);
  const returnOnEffort = totalEnergy > 0 ? totalReturn / totalEnergy : 0;

  const last5 = decisions.slice(0, 5).map((d) => d.dnav);
  const prior5 = decisions.slice(5, 10).map((d) => d.dnav);
  const last5vsPrior5 =
    last5.length > 0 && prior5.length > 0
      ? last5.reduce((a, b) => a + b, 0) / last5.length - prior5.reduce((a, b) => a + b, 0) / prior5.length
      : 0;

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let returnDebt = 0;

  for (const decision of decisions) {
    if (decision.return < 0) {
      tempStreak += 1;
      returnDebt += Math.abs(decision.return);
      if (tempStreak === 1) currentStreak = tempStreak;
    } else {
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      tempStreak = 0;
    }
  }

  if (tempStreak > longestStreak) longestStreak = tempStreak;

  const paybackRatio = longestStreak > 0 ? returnDebt / longestStreak : 0;

  return {
    totalDecisions: filteredDecisions.length,
    avgDnav: Math.round(avgDnav * 10) / 10,
    trend: Math.round(trend * 10) / 10,
    consistency: Math.round(consistency * 10) / 10,
    cadence: Math.round(cadence * 10) / 10,
    last5vsPrior5: Math.round(last5vsPrior5 * 10) / 10,
    windowArchetype: archetypeInfo.name,
    windowArchetypeDescription: archetypeInfo.description,
    windowArchetypeBreakdown: {
      returnType: archetypeInfo.returnType,
      stabilityType: archetypeInfo.stabilityType,
      pressureType: archetypeInfo.pressureType,
    },
    returnOnEffort: Math.round(returnOnEffort * 100) / 100,
    returnDistribution,
    stabilityDistribution,
    pressureDistribution,
    lossStreak: { current: currentStreak, longest: longestStreak },
    returnDebt: Math.round(returnDebt * 10) / 10,
    paybackRatio: Math.round(paybackRatio * 10) / 10,
  };
};
