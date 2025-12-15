import { DecisionEntry } from "../calculations";
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
  pressureStabilize: 1,
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
    Math.abs(average(window, "pressure")) <= thresholds.pressureStabilize &&
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
      return acc;
    },
    { returnTotal: 0, pressureTotal: 0, stabilityTotal: 0 },
  );

  const count = decisions.length || 1;

  return {
    label: request.label,
    timeframeLabel: request.timeframeLabel,
    normalizationBasis: request.normalizationBasis,
    totalDecisions: decisions.length,
    avgReturn: totals.returnTotal / count,
    avgPressure: totals.pressureTotal / count,
    avgStability: totals.stabilityTotal / count,
  };
}

export function computeVelocity(
  decisions: DecisionEntry[],
  target: VelocityGoalTarget,
  options?: { windowSize?: number; thresholds?: Partial<VelocityThresholds>; normalizationBasis?: NormalizationBasis },
): VelocityResult {
  const windowSize = options?.windowSize ?? 5;
  const thresholds: VelocityThresholds = { ...DEFAULT_THRESHOLDS, ...(options?.thresholds ?? {}) };
  const sorted = [...decisions].sort((a, b) => a.ts - b.ts);
  const targetLabel = VELOCITY_LABELS[target];
  const explainability = buildExplainabilitySkeleton({
    decisions: sorted,
    windowSize,
    thresholds,
    targetLabel,
    normalizationBasis: options?.normalizationBasis,
  });

  if (sorted.length < windowSize) {
    return {
      target,
      targetLabel,
      decisionsToTarget: null,
      windowsEvaluated: 0,
      targetReached: false,
      thresholds,
      reason: `Need at least ${windowSize} decisions to evaluate velocity`,
      explainability: {
        ...explainability,
        layer4Punchline: "Not enough decisions to evaluate velocity.",
      },
    };
  }

  const checkFn = VELOCITY_TARGET_CHECKS[target];
  let decisionsToTarget: number | null = null;
  const intermediateWindows: { index: number; avgReturn: number; avgPressure: number; avgStability: number }[] = [];

  for (let i = 0; i <= sorted.length - windowSize; i++) {
    const window = sorted.slice(i, i + windowSize);
    const windowAverages = {
      avgReturn: average(window, "return"),
      avgPressure: average(window, "pressure"),
      avgStability: average(window, "stability"),
    };
    intermediateWindows.push({ index: i, ...windowAverages });
    if (checkFn(window, thresholds)) {
      decisionsToTarget = i + windowSize;
      break;
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
    explainability: {
      ...explainability,
      layer2Thresholds: thresholds,
      layer3Intermediates: {
        windowSize,
        windowsEvaluated,
        intermediateWindows,
      },
      layer4Punchline: targetReached
        ? `${targetLabel} after ${decisionsToTarget} decisions`
        : `${targetLabel} not reached in ${sorted.length} decisions`,
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
  thresholds?: Partial<VelocityThresholds>;
  warnings?: string[];
}): CompareResult {
  const returnDelta = cohortB.avgReturn - cohortA.avgReturn;
  const pressureDelta = cohortB.avgPressure - cohortA.avgPressure;
  const stabilityDelta = cohortB.avgStability - cohortA.avgStability;

  const hasVelocity = mode === "velocity" && velocityTarget;

  const velocityA = hasVelocity
    ? computeVelocity(decisionsA, velocityTarget, {
        windowSize,
        thresholds,
        normalizationBasis,
      })
    : null;
  const velocityB = hasVelocity
    ? computeVelocity(decisionsB, velocityTarget, {
        windowSize,
        thresholds,
        normalizationBasis,
      })
    : null;

  const punchline =
    hasVelocity && velocityA && velocityB
      ? buildVelocityPunchline(cohortA.label, cohortB.label, velocityA, velocityB)
      : buildPosture({
          mode,
          cohortA,
          cohortB,
          deltas: { returnDelta, pressureDelta, stabilityDelta },
        });

  const explainability = buildExplainabilitySkeleton({
    decisions: [...decisionsA, ...decisionsB],
    windowSize: windowSize ?? 5,
    thresholds: { ...DEFAULT_THRESHOLDS, ...(thresholds ?? {}) },
    targetLabel: hasVelocity && velocityTarget ? VELOCITY_LABELS[velocityTarget] : "Compare",
    normalizationBasis,
  });

  const posture = buildPosture({
    mode,
    cohortA,
    cohortB,
    deltas: { returnDelta, pressureDelta, stabilityDelta },
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
        layer3Intermediates: { deltas: { returnDelta, pressureDelta, stabilityDelta } },
        layer4Punchline: punchline,
      };

  return {
    mode,
    cohortA,
    cohortB,
    deltas: {
      returnDelta,
      pressureDelta,
      stabilityDelta,
    },
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
): string {
  if (!velocityA.decisionsToTarget && !velocityB.decisionsToTarget) {
    return "Neither cohort has enough decisions to reach the target yet.";
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
    ? `${faster} stabilized in ${fasterDecisions} decisions; ${slower} required ${slowerDecisions} (${speedRatio.toFixed(1)}× difference).`
    : `${faster} reached the target faster than ${slower}.`;
}

function buildExplainabilitySkeleton({
  decisions,
  windowSize,
  thresholds,
  targetLabel,
  normalizationBasis,
}: {
  decisions: DecisionEntry[];
  windowSize: number;
  thresholds: VelocityThresholds;
  targetLabel: string;
  normalizationBasis?: NormalizationBasis;
}): ExplainabilityLayers {
  return {
    layer1Raw: {
      totalDecisions: decisions.length,
      windowSize,
      normalizationBasis: normalizationBasis ?? "shared_timeframe",
      timespan: summarizeTimespan(decisions),
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
}: {
  mode: CompareMode;
  cohortA: CohortSummary;
  cohortB: CohortSummary;
  deltas: { returnDelta: number; pressureDelta: number; stabilityDelta: number };
}): string {
  const leader = deltas.returnDelta >= 0 ? cohortB : cohortA;
  const trailer = leader === cohortA ? cohortB : cohortA;
  const leaderLabel = leader.label;

  const returnText = `${leaderLabel} shows stronger return (${leader.avgReturn.toFixed(1)} vs ${trailer.avgReturn.toFixed(1)})`;
  const pressureText = `${leader.avgPressure.toFixed(1)} pressure vs ${trailer.avgPressure.toFixed(1)}`;
  const stabilityText = `${leader.avgStability.toFixed(1)} stability vs ${trailer.avgStability.toFixed(1)}`;

  const modeLabel = getModeSummary(mode);
  return `${modeLabel} ${returnText}; ${pressureText}; ${stabilityText}.`;
}

function getModeSummary(mode: CompareMode): string {
  if (mode === "temporal") return "Temporal: Compare the same system across equal windows.";
  if (mode === "velocity") return "Velocity: Compare how quickly each system reaches a target state.";
  return "Entity: Compare two systems over the same timeframe.";
}
