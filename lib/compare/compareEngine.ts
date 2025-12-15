import { type DecisionEntry } from "@/lib/storage";
import {
  type CohortSpec,
  type CompareMode,
  type CompareResult,
  type NormalizationBasis,
  type VelocityGoalType,
  type VelocityTarget,
} from "./types";

function safeAverage(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function decisionMetric(decision: DecisionEntry, metricKey: VelocityTarget["metricKey"]): number {
  switch (metricKey) {
    case "DNAV":
      return decision.dnav ?? 0;
    case "RETURN":
      return decision.return ?? 0;
    case "PRESSURE":
      return decision.pressure ?? 0;
    case "STABILITY":
      return decision.stability ?? 0;
    default:
      return 0;
  }
}

function computeSummary(decisions: DecisionEntry[]) {
  const metrics = {
    avgDnav: safeAverage(decisions.map((d) => d.dnav ?? 0)),
    avgReturn: safeAverage(decisions.map((d) => d.return ?? 0)),
    avgPressure: safeAverage(decisions.map((d) => d.pressure ?? 0)),
    avgStability: safeAverage(decisions.map((d) => d.stability ?? 0)),
  };

  const categoryMap = new Map<string, { count: number; dnav: number; return: number; pressure: number; stability: number }>();
  for (const decision of decisions) {
    const category = decision.category ?? "Uncategorized";
    const current =
      categoryMap.get(category) ??
      ({ count: 0, dnav: 0, return: 0, pressure: 0, stability: 0 } as {
        count: number;
        dnav: number;
        return: number;
        pressure: number;
        stability: number;
      });
    current.count += 1;
    current.dnav += decision.dnav ?? 0;
    current.return += decision.return ?? 0;
    current.pressure += decision.pressure ?? 0;
    current.stability += decision.stability ?? 0;
    categoryMap.set(category, current);
  }

  const total = decisions.length || 1;
  const categoryWeights = Array.from(categoryMap.entries()).map(([category, stats]) => ({
    category,
    weight: stats.count / total,
    avgDnav: stats.count ? stats.dnav / stats.count : 0,
    avgReturn: stats.count ? stats.return / stats.count : 0,
    avgPressure: stats.count ? stats.pressure / stats.count : 0,
    avgStability: stats.count ? stats.stability / stats.count : 0,
    count: stats.count,
  }));

  return { totalDecisions: decisions.length, ...metrics, categoryWeights };
}

function computeDelta(summaryA: ReturnType<typeof computeSummary>, summaryB: ReturnType<typeof computeSummary>) {
  return {
    avgDnav: summaryA.avgDnav - summaryB.avgDnav,
    avgReturn: summaryA.avgReturn - summaryB.avgReturn,
    avgPressure: summaryA.avgPressure - summaryB.avgPressure,
    avgStability: summaryA.avgStability - summaryB.avgStability,
    totalDecisions: summaryA.totalDecisions - summaryB.totalDecisions,
  };
}

function buildDecisionTerrain(
  summaryA: ReturnType<typeof computeSummary>,
  summaryB: ReturnType<typeof computeSummary>,
): CompareResult["decisionTerrain"] {
  const weightsA = new Map(summaryA.categoryWeights.map((row) => [row.category, row.weight]));
  const weightsB = new Map(summaryB.categoryWeights.map((row) => [row.category, row.weight]));
  const categories = new Set([...weightsA.keys(), ...weightsB.keys()]);
  const deltas: Array<{ category: string; deltaWeight: number }> = [];
  const newInB: string[] = [];
  const missingInB: string[] = [];

  for (const category of categories) {
    const a = weightsA.get(category) ?? 0;
    const b = weightsB.get(category) ?? 0;
    const deltaWeight = b - a;
    deltas.push({ category, deltaWeight });
    if (a === 0 && b > 0) newInB.push(category);
    if (a > 0 && b === 0) missingInB.push(category);
  }

  const topIncreases = deltas
    .filter((row) => row.deltaWeight > 0)
    .sort((a, b) => b.deltaWeight - a.deltaWeight)
    .slice(0, 3);
  const topDecreases = deltas
    .filter((row) => row.deltaWeight < 0)
    .sort((a, b) => a.deltaWeight - b.deltaWeight)
    .slice(0, 3);

  return { topIncreases, topDecreases, newInB, missingInB };
}

function determineFailureModes(delta: ReturnType<typeof computeDelta>, summaryB: ReturnType<typeof computeSummary>) {
  const modes: CompareResult["failureModes"] = [];

  const pressureRising = summaryB.avgPressure > 0.5 && delta.avgPressure < 0;
  if (pressureRising) {
    modes.push({
      code: "HIGH_PRESSURE_CHURN",
      title: "High pressure churn",
      reason: "Pressure is elevated and rising in B, increasing churn risk.",
    });
  }

  const stabilityFalling = summaryB.avgStability < 0 && delta.avgStability < 0;
  if (stabilityFalling) {
    modes.push({
      code: "LOW_STABILITY_TRAP",
      title: "Low stability trap",
      reason: "Stability is deteriorating in B, signaling fragile footing.",
    });
  }

  const overdriveRisk = summaryB.avgPressure > 1 && summaryB.avgReturn <= 0.5;
  if (overdriveRisk) {
    modes.push({
      code: "OVERDRIVE_RISK",
      title: "Overdrive risk",
      reason: "High tempo with limited returns hints at overdrive without payoff.",
    });
  }

  const fragileGains = delta.avgReturn > 0 && delta.avgStability < 0;
  if (fragileGains) {
    modes.push({
      code: "FRAGILE_GAINS",
      title: "Fragile gains",
      reason: "Return improves but stability erodes, making gains fragile.",
    });
  }

  const lowConfidenceDrift = summaryB.avgStability < 0 && summaryB.avgReturn < 0.5;
  if (lowConfidenceDrift) {
    modes.push({
      code: "LOW_CONFIDENCE_DRIFT",
      title: "Low confidence drift",
      reason: "Low footing and muted returns suggest confidence drift.",
    });
  }

  return modes.slice(0, 5);
}

function basisToDays(basis: NormalizationBasis): number {
  switch (basis) {
    case "PER_DAY":
      return 1;
    case "PER_WEEK":
      return 7;
    case "PER_MONTH":
      return 30;
    case "PER_QUARTER":
      return 90;
    default:
      return 1;
  }
}

function findVelocityStats(decisions: DecisionEntry[], target: VelocityTarget) {
  if (!decisions.length) return { warnings: ["No decisions to measure velocity."], stats: {} } as const;
  const sorted = [...decisions].sort((a, b) => a.ts - b.ts);
  const metricValues = sorted.map((decision) => decisionMetric(decision, target.metricKey));
  const cumulative: number[] = [];
  let runningSum = 0;
  for (let i = 0; i < metricValues.length; i++) {
    runningSum += metricValues[i];
    cumulative.push(runningSum / (i + 1));
  }

  const meetsThreshold = (value: number) =>
    target.direction === "GTE" ? value >= target.threshold : value <= target.threshold;

  const crossingIndex = cumulative.findIndex(meetsThreshold);
  if (crossingIndex === -1) {
    return {
      warnings: ["Target not reached in this cohort."],
      stats: {},
    } as const;
  }

  const firstTs = sorted[0]?.ts;
  const crossingTs = sorted[crossingIndex]?.ts;
  const msInDay = 24 * 60 * 60 * 1000;
  const timeToTargetDays = firstTs && crossingTs ? Math.max((crossingTs - firstTs) / msInDay, 0) : undefined;
  const decisionsToTarget = crossingIndex + 1;

  let rate: number | undefined;
  if (target.normalization === "PER_DECISION") {
    rate = 1 / decisionsToTarget;
  } else if (timeToTargetDays !== undefined) {
    const basisDays = basisToDays(target.normalization);
    rate = basisDays / Math.max(timeToTargetDays, 1);
  }

  return { warnings: [] as string[], stats: { timeToTargetDays, decisionsToTarget, rate } } as const;
}

function buildExplainability({ mode, result }: { mode: CompareMode; result: CompareResult }) {
  const sharedMethod = [
    "Compute averages for D-NAV, Return, Pressure, Stability",
    "Measure decision terrain by category share shifts",
    "Flag deterministic failure modes from posture deltas",
  ];

  if (mode === "VELOCITY") {
    return {
      question: "What are we measuring the speed of?",
      contractLine: "Hold the target outcome constant and normalize time before comparing.",
      methodBullets: [...sharedMethod, "Locate the earliest crossing of the velocity target"],
      resultHeadline: result.velocity?.comparisonLine ?? "Velocity comparison unavailable.",
    };
  }

  const question = mode === "ENTITY" ? "What are we comparing across entities?" : "How did this entity change over time?";
  const contractLine =
    mode === "ENTITY"
      ? "Both cohorts share the same timeframe; differences come from entity composition."
      : "Same entity, different periods — any shifts reflect temporal change.";

  return {
    question,
    contractLine,
    methodBullets: sharedMethod,
    resultHeadline:
      result.delta && typeof result.delta.avgDnav === "number"
        ? `D-NAV delta A-B: ${result.delta.avgDnav.toFixed(2)}; Return delta: ${result.delta.avgReturn.toFixed(2)}`
        : "Comparison delta unavailable.",
  };
}

function velocityDefaults(goalType: VelocityGoalType, normalization: NormalizationBasis): VelocityTarget {
  switch (goalType) {
    case "STABILIZATION":
      return { goalType, metricKey: "PRESSURE", threshold: -2, direction: "LTE", normalization };
    case "ADAPTATION":
      return { goalType, metricKey: "STABILITY", threshold: 2.5, direction: "GTE", normalization };
    default:
      return { goalType, metricKey: "RETURN", threshold: 1, direction: "GTE", normalization };
  }
}

function selfCheck(): void {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof console !== "undefined") {
    console.warn("[compareEngine] Running in development mode. Ensure comparisons pass hard constraints.");
  }
}

export function runComparison(args: {
  mode: CompareMode;
  cohortA: CohortSpec;
  cohortB: CohortSpec;
  decisionsA: DecisionEntry[];
  decisionsB: DecisionEntry[];
  velocityTarget?: VelocityTarget; // required for VELOCITY
}): CompareResult {
  selfCheck();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (args.mode === "ENTITY") {
    if (
      args.cohortA.timeframe.start !== args.cohortB.timeframe.start ||
      args.cohortA.timeframe.end !== args.cohortB.timeframe.end
    ) {
      errors.push("ENTITY mode requires identical timeframes.");
    }
  }

  if (args.mode === "TEMPORAL") {
    const sameEntity = args.cohortA.entityId === args.cohortB.entityId;
    const sameTimeframe =
      args.cohortA.timeframe.start === args.cohortB.timeframe.start && args.cohortA.timeframe.end === args.cohortB.timeframe.end;
    if (!sameEntity) errors.push("TEMPORAL mode requires the same entity on both cohorts.");
    if (sameTimeframe) errors.push("TEMPORAL mode needs distinct timeframes to compare.");
  }

  let velocityTarget = args.velocityTarget;
  if (args.mode === "VELOCITY") {
    if (!velocityTarget) {
      errors.push("VELOCITY mode requires a velocity target.");
    } else {
      velocityTarget = velocityTarget ?? velocityDefaults(velocityTarget.goalType, velocityTarget.normalization);
    }
  }

  const baseResult: CompareResult = {
    mode: args.mode,
    cohortA: args.cohortA,
    cohortB: args.cohortB,
    summaryA: null,
    summaryB: null,
    delta: null,
    failureModes: [],
    explainability: { question: "", contractLine: "", methodBullets: [], resultHeadline: "" },
    warnings,
    errors,
  };

  if (errors.length) {
    return baseResult;
  }

  const summaryA = computeSummary(args.decisionsA);
  const summaryB = computeSummary(args.decisionsB);
  const delta = computeDelta(summaryA, summaryB);
  const decisionTerrain = buildDecisionTerrain(summaryA, summaryB);
  const failureModes = determineFailureModes(delta, summaryB);

  const result: CompareResult = {
    ...baseResult,
    summaryA,
    summaryB,
    delta,
    decisionTerrain,
    failureModes,
  };

  if (args.mode === "VELOCITY" && velocityTarget) {
    const statsA = findVelocityStats(args.decisionsA, velocityTarget);
    const statsB = findVelocityStats(args.decisionsB, velocityTarget);
    warnings.push(...statsA.warnings, ...statsB.warnings);

    let comparisonLine = "Velocity comparison unavailable.";
    if (statsA.stats.rate && statsB.stats.rate) {
      const aFaster = statsA.stats.rate > statsB.stats.rate;
      const ratio = aFaster
        ? statsA.stats.rate / statsB.stats.rate
        : statsB.stats.rate / statsA.stats.rate;
      const baseLabel = `${args.cohortA.entityLabel} vs ${args.cohortB.entityLabel}`;
      const qualifier = ratio ? `${ratio.toFixed(1)}× ${aFaster ? "faster for A" : "faster for B"}` : "similar speed";
      comparisonLine = `${baseLabel}: ${qualifier}`;
    } else if (statsA.stats.rate || statsB.stats.rate) {
      comparisonLine = statsA.stats.rate
        ? `${args.cohortA.entityLabel} reached the target; ${args.cohortB.entityLabel} has not.`
        : `${args.cohortB.entityLabel} reached the target; ${args.cohortA.entityLabel} has not.`;
    }

    result.velocity = {
      target: velocityTarget,
      a: statsA.stats,
      b: statsB.stats,
      comparisonLine,
    };
  }

  result.explainability = buildExplainability({ mode: args.mode, result });
  result.warnings = warnings;
  return result;
}

export { type CompareMode, type CohortSpec, type VelocityTarget } from "./types";
