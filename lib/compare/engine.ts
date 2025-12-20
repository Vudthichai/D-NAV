import { DecisionEntry } from "../calculations";
import { stdev } from "@/utils/stats";
import { formatUnitCount, getUnitLabels } from "@/utils/judgmentUnits";
import { buildPostureContrast, computePostureSummary } from "../judgment/posture";
import type {
  CohortBuildRequest,
  CohortSummary,
  CompareMode,
  CompareResult,
  ExplainabilityLayers,
  NormalizationBasis,
  VelocityGoalTarget,
  VelocityResult,
  VelocityThresholds,
} from "./types";

const DEFAULT_THRESHOLDS: VelocityThresholds = {
  pressureBand: 0.5,
  stabilityFloor: 0,
  stabilityBand: 0.5,
  returnLift: 1,
};

const VELOCITY_LABELS: Record<VelocityGoalTarget, string> = {
  PRESSURE_STABILIZE: "Pressure stabilizes",
  RETURN_RISE: "Return rises",
  STABILITY_STABILIZE: "Stability stabilizes",
};

type BuildCohortSummaryInput = {
  decisions: DecisionEntry[];
  request: CohortBuildRequest;
};

type VelocityCheckFn = (window: DecisionEntry[], thresholds: VelocityThresholds) => boolean;

const VELOCITY_TARGET_CHECKS: Record<VelocityGoalTarget, VelocityCheckFn> = {
  PRESSURE_STABILIZE: (window, thresholds) =>
    Math.abs(average(window, "pressure")) <= thresholds.pressureBand &&
    average(window, "stability") >= thresholds.stabilityFloor,
  RETURN_RISE: (window, thresholds) => average(window, "return") >= thresholds.returnLift,
  STABILITY_STABILIZE: (window, thresholds) =>
    Math.abs(average(window, "stability")) <= thresholds.stabilityBand &&
    average(window, "stability") >= thresholds.stabilityFloor,
};

export function buildCohortSummary({ decisions, request }: BuildCohortSummaryInput): CohortSummary {
  const totals = decisions.reduce(
    (acc, decision) => {
      acc.returnTotal += decision.return;
      acc.pressureTotal += decision.pressure;
      acc.stabilityTotal += decision.stability;
      acc.impactTotal += decision.impact;
      acc.costTotal += decision.cost;
      acc.riskTotal += decision.risk;
      acc.urgencyTotal += decision.urgency;
      acc.confidenceTotal += decision.confidence;
      acc.dnavTotal += decision.dnav;
      acc.returnValues.push(decision.return);
      acc.pressureValues.push(decision.pressure);
      acc.stabilityValues.push(decision.stability);
      return acc;
    },
    {
      returnTotal: 0,
      pressureTotal: 0,
      stabilityTotal: 0,
      impactTotal: 0,
      costTotal: 0,
      riskTotal: 0,
      urgencyTotal: 0,
      confidenceTotal: 0,
      dnavTotal: 0,
      returnValues: [] as number[],
      pressureValues: [] as number[],
      stabilityValues: [] as number[],
    },
  );

  const count = decisions.length || 1;

  return {
    label: request.label,
    datasetLabel: request.datasetLabel,
    timeframeLabel: request.timeframeLabel,
    timeframeMode: request.timeframeMode,
    sequenceRange: request.sequenceRange,
    totalAvailableDecisions: request.totalAvailableDecisions,
    judgmentUnitLabel: request.judgmentUnitLabel,
    normalizationBasis: request.normalizationBasis,
    totalDecisions: decisions.length,
    avgDnav: totals.dnavTotal / count,
    avgReturn: totals.returnTotal / count,
    avgPressure: totals.pressureTotal / count,
    avgStability: totals.stabilityTotal / count,
    stdReturn: stdev(totals.returnValues),
    stdPressure: stdev(totals.pressureValues),
    stdStability: stdev(totals.stabilityValues),
    avgImpact: totals.impactTotal / count,
    avgCost: totals.costTotal / count,
    avgRisk: totals.riskTotal / count,
    avgUrgency: totals.urgencyTotal / count,
    avgConfidence: totals.confidenceTotal / count,
  };
}

export function computeVelocity(
  decisions: DecisionEntry[],
  target: VelocityGoalTarget,
  options?: {
    windowSize?: number;
    consecutiveWindows?: number;
    thresholds?: Partial<VelocityThresholds>;
    normalizationBasis?: NormalizationBasis;
    judgmentUnitLabel?: string | null;
  },
): VelocityResult {
  const windowSize = options?.windowSize ?? 5;
  const consecutiveWindows = options?.consecutiveWindows ?? 3;
  const thresholds: VelocityThresholds = { ...DEFAULT_THRESHOLDS, ...(options?.thresholds ?? {}) };
  const sorted = [...decisions].sort((a, b) => a.ts - b.ts);
  const targetLabel = VELOCITY_LABELS[target];
  const unitLabels = getUnitLabels(options?.judgmentUnitLabel);
  const explainability = buildExplainabilitySkeleton({
    decisions: sorted,
    windowSize,
    thresholds,
    targetLabel,
    normalizationBasis: options?.normalizationBasis,
    consecutiveWindows,
  });

  if (sorted.length < windowSize) {
    return {
      target,
      targetLabel,
      decisionsToTarget: null,
      windowsEvaluated: 0,
      targetReached: false,
      thresholds,
      consecutiveWindows,
      windowSize,
      reason: `Need at least ${windowSize} ${unitLabels.plural} to evaluate velocity`,
      explainability: {
        ...explainability,
        layer4Punchline: `Not enough ${unitLabels.plural} to evaluate velocity.`,
      },
    };
  }

  const checkFn = VELOCITY_TARGET_CHECKS[target];
  let decisionsToTarget: number | null = null;
  const intermediateWindows: { index: number; avgReturn: number; avgPressure: number; avgStability: number }[] = [];
  let streak = 0;

  for (let i = 0; i <= sorted.length - windowSize; i++) {
    const window = sorted.slice(i, i + windowSize);
    const windowAverages = {
      avgReturn: average(window, "return"),
      avgPressure: average(window, "pressure"),
      avgStability: average(window, "stability"),
    };
    intermediateWindows.push({ index: i, ...windowAverages });
    if (checkFn(window, thresholds)) {
      streak += 1;
      if (streak >= consecutiveWindows) {
        decisionsToTarget = i + windowSize;
        break;
      }
    } else {
      streak = 0;
    }
  }

  const targetReached = decisionsToTarget !== null;
  const windowsEvaluated = Math.max(sorted.length - windowSize + 1, 0);

  return {
    target,
    targetLabel,
    decisionsToTarget,
    windowsEvaluated,
    targetReached,
    thresholds,
    consecutiveWindows,
    windowSize,
    explainability: {
      ...explainability,
      layer2Thresholds: thresholds,
      layer3Intermediates: {
        windowSize,
        windowsEvaluated,
        consecutiveWindows,
        intermediateWindows,
      },
      layer4Punchline: targetReached
        ? `${targetLabel} after ${formatUnitCount(decisionsToTarget ?? 0, options?.judgmentUnitLabel)}`
        : `${targetLabel} not reached in ${formatUnitCount(sorted.length, options?.judgmentUnitLabel)}`,
    },
  };
}

export function runCompare({
  mode,
  normalizationBasis,
  velocityTarget,
  cohortA,
  cohortB,
  decisionsA,
  decisionsB,
  windowSize,
  consecutiveWindows,
  thresholds,
  warnings,
}: {
  mode: CompareMode;
  normalizationBasis: NormalizationBasis;
  velocityTarget?: VelocityGoalTarget;
  cohortA: CohortSummary;
  cohortB: CohortSummary;
  decisionsA: DecisionEntry[];
  decisionsB: DecisionEntry[];
  windowSize?: number;
  consecutiveWindows?: number;
  thresholds?: Partial<VelocityThresholds>;
  warnings?: string[];
}): CompareResult {
  const returnDelta = cohortB.avgReturn - cohortA.avgReturn;
  const pressureDelta = cohortB.avgPressure - cohortA.avgPressure;
  const stabilityDelta = cohortB.avgStability - cohortA.avgStability;
  const deltas = {
    returnDelta,
    pressureDelta,
    stabilityDelta,
  };
  const driverDeltas = {
    impact: cohortB.avgImpact - cohortA.avgImpact,
    cost: cohortB.avgCost - cohortA.avgCost,
    risk: cohortB.avgRisk - cohortA.avgRisk,
    urgency: cohortB.avgUrgency - cohortA.avgUrgency,
    confidence: cohortB.avgConfidence - cohortA.avgConfidence,
  };

  const hasVelocity = mode === "velocity" && velocityTarget;
  const unitLabel = cohortA.judgmentUnitLabel || cohortB.judgmentUnitLabel;

  const velocityA = hasVelocity
    ? computeVelocity(decisionsA, velocityTarget, {
        windowSize,
        consecutiveWindows,
        thresholds,
        normalizationBasis,
        judgmentUnitLabel: unitLabel,
      })
    : null;
  const velocityB = hasVelocity
    ? computeVelocity(decisionsB, velocityTarget, {
        windowSize,
        consecutiveWindows,
        thresholds,
        normalizationBasis,
        judgmentUnitLabel: unitLabel,
      })
    : null;

  const punchline =
    hasVelocity && velocityA && velocityB
      ? buildVelocityPunchline(
          cohortA.label,
          cohortB.label,
          velocityA,
          velocityB,
          unitLabel,
        )
      : buildPosture({
          mode,
          cohortA,
          cohortB,
          deltas,
          driverDeltas,
        });

  const explainability = buildExplainabilitySkeleton({
    decisions: [...decisionsA, ...decisionsB],
    windowSize: windowSize ?? 5,
    thresholds: { ...DEFAULT_THRESHOLDS, ...(thresholds ?? {}) },
    targetLabel: hasVelocity && velocityTarget ? VELOCITY_LABELS[velocityTarget] : "Compare",
    normalizationBasis,
    consecutiveWindows: consecutiveWindows ?? 3,
  });

  const posture = buildPosture({
    mode,
    cohortA,
    cohortB,
    deltas,
    driverDeltas,
  });

  const developerDetails: ExplainabilityLayers = hasVelocity && velocityA && velocityB
    ? {
        ...explainability,
        layer3Intermediates: {
          cohortA: velocityA.explainability.layer3Intermediates,
          cohortB: velocityB.explainability.layer3Intermediates,
        },
        layer4Punchline: punchline,
      }
    : {
        ...explainability,
        layer3Intermediates: { deltas, drivers: driverDeltas },
        layer4Punchline: punchline,
      };

  const postureA = computePostureSummary(cohortA, decisionsA);
  const postureB = computePostureSummary(cohortB, decisionsB);
  const postureContrast = buildPostureContrast(postureA, postureB, { a: cohortA.label, b: cohortB.label });

  return {
    mode,
    cohortA,
    cohortB,
    judgmentUnitLabel: unitLabel,
    deltas,
    driverDeltas,
    consistency: {
      cohortAStd: {
        return: cohortA.stdReturn,
        pressure: cohortA.stdPressure,
        stability: cohortA.stdStability,
      },
      cohortBStd: {
        return: cohortB.stdReturn,
        pressure: cohortB.stdPressure,
        stability: cohortB.stdStability,
      },
    },
    topDrivers: getTopDrivers(driverDeltas),
    narrative: posture,
    modeSummary: getModeSummary(mode),
    velocity:
      hasVelocity && velocityA && velocityB && velocityTarget
        ? {
            target: velocityTarget,
            targetLabel: VELOCITY_LABELS[velocityTarget],
            a: velocityA,
            b: velocityB,
            punchline,
          }
        : undefined,
    developerDetails,
    warnings,
    posture: { cohortA: postureA, cohortB: postureB, contrast: postureContrast },
  };
}

function average(window: DecisionEntry[], metric: "pressure" | "return" | "stability"): number {
  const total = window.reduce((sum, decision) => sum + decision[metric], 0);
  return total / window.length;
}

function buildVelocityPunchline(
  labelA: string,
  labelB: string,
  velocityA: VelocityResult,
  velocityB: VelocityResult,
  judgmentUnitLabel?: string | null,
): string {
  const unitLabels = getUnitLabels(judgmentUnitLabel);
  if (!velocityA.decisionsToTarget && !velocityB.decisionsToTarget) {
    return `Neither cohort has enough ${unitLabels.plural} to reach the target yet.`;
  }

  if (!velocityA.decisionsToTarget) {
    return `${labelB} reached the target while ${labelA} has insufficient data.`;
  }

  if (!velocityB.decisionsToTarget) {
    return `${labelA} reached the target while ${labelB} has insufficient data.`;
  }

  const speedRatio = velocityA.decisionsToTarget && velocityB.decisionsToTarget
    ? Math.max(velocityA.decisionsToTarget, velocityB.decisionsToTarget) /
      Math.max(1, Math.min(velocityA.decisionsToTarget, velocityB.decisionsToTarget))
    : null;

  const faster = velocityA.decisionsToTarget < velocityB.decisionsToTarget ? labelA : labelB;
  const slower = faster === labelA ? labelB : labelA;
  const fasterDecisions = Math.min(velocityA.decisionsToTarget, velocityB.decisionsToTarget);
  const slowerDecisions = Math.max(velocityA.decisionsToTarget, velocityB.decisionsToTarget);

  return speedRatio
    ? `${faster} stabilized in ${formatUnitCount(fasterDecisions, judgmentUnitLabel)}; ${slower} required ${formatUnitCount(slowerDecisions, judgmentUnitLabel)} (${speedRatio.toFixed(1)}× difference).`
    : `${faster} reached the target faster than ${slower}.`;
}

function buildExplainabilitySkeleton({
  decisions,
  windowSize,
  thresholds,
  targetLabel,
  normalizationBasis,
  consecutiveWindows,
}: {
  decisions: DecisionEntry[];
  windowSize: number;
  thresholds: VelocityThresholds;
  targetLabel: string;
  normalizationBasis?: NormalizationBasis;
  consecutiveWindows?: number;
}): ExplainabilityLayers {
  return {
    layer1Raw: {
      totalDecisions: decisions.length,
      windowSize,
      normalizationBasis: normalizationBasis ?? "shared_timeframe",
      timespan: summarizeTimespan(decisions),
      consecutiveWindows: consecutiveWindows ?? null,
    },
    layer2Thresholds: thresholds,
    layer3Intermediates: {},
    layer4Punchline: `${targetLabel} evaluation pending`,
  };
}

function summarizeTimespan(decisions: DecisionEntry[]) {
  if (decisions.length === 0) return null;
  const sorted = [...decisions].sort((a, b) => a.ts - b.ts);
  return { start: sorted[0].ts, end: sorted[sorted.length - 1].ts };
}

function buildPosture({
  mode,
  cohortA,
  cohortB,
  deltas,
  driverDeltas,
}: {
  mode: CompareMode;
  cohortA: CohortSummary;
  cohortB: CohortSummary;
  deltas: { returnDelta: number; pressureDelta: number; stabilityDelta: number };
  driverDeltas: { impact: number; cost: number; risk: number; urgency: number; confidence: number };
}): string {
  const leader = deltas.returnDelta >= 0 ? cohortB : cohortA;
  const trailer = leader === cohortA ? cohortB : cohortA;
  const leaderLabel = leader.label;

  const returnText = `${leaderLabel} shows stronger return (${leader.avgReturn.toFixed(1)} vs ${trailer.avgReturn.toFixed(1)})`;
  const pressureText = `${leader.avgPressure.toFixed(1)} pressure vs ${trailer.avgPressure.toFixed(1)}`;
  const stabilityText = `${leader.avgStability.toFixed(1)} stability vs ${trailer.avgStability.toFixed(1)}`;

  const modeLabel = getModeSummary(mode);
  const topDriverLabels = getTopDrivers(driverDeltas).slice(0, 2);
  const driverText =
    topDriverLabels.length > 0
      ? ` Key drivers: ${topDriverLabels.join(" and ")}.`
      : "";

  return `${modeLabel} ${returnText}; ${pressureText}; ${stabilityText}.${driverText}`;
}

function getTopDrivers(driverDeltas: { impact: number; cost: number; risk: number; urgency: number; confidence: number }) {
  const entries = Object.entries(driverDeltas).map(([key, value]) => ({ key, value, magnitude: Math.abs(value) }));
  const ordered = entries
    .filter((entry) => entry.magnitude > 0.01)
    .sort((a, b) => b.magnitude - a.magnitude)
    .map((entry) => formatDriver(entry.key, entry.value));
  return ordered.slice(0, 5);
}

function formatDriver(key: string, delta: number) {
  const labelMap: Record<string, string> = {
    impact: "Impact",
    cost: "Cost",
    risk: "Risk",
    urgency: "Urgency",
    confidence: "Confidence",
  };
  const direction = delta > 0 ? "higher" : "lower";
  return `${labelMap[key] ?? key} ${direction}`;
}

function getModeSummary(mode: CompareMode): string {
  if (mode === "temporal") return "Change: What’s different?";
  if (mode === "velocity") return "Speed: How fast do meaningful patterns form?";
  return "Posture: What kind of judgment system is this?";
}
