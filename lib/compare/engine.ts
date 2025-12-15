import { DecisionEntry } from "../calculations";
import type {
  CohortBuildRequest,
  CohortSummary,
  CompareMode,
  CompareResult,
  NormalizationBasis,
  VelocityGoalTarget,
  VelocityResult,
  VelocityThresholds,
} from "./types";

const DEFAULT_THRESHOLDS: VelocityThresholds = {
  pressureStabilize: 1,
  stabilityFloor: 0,
  returnFloor: 0,
  returnLift: 1,
  returnStabilizeBand: 0.5,
  pressureDrop: -1,
};

const VELOCITY_LABELS: Record<VelocityGoalTarget, string> = {
  PRESSURE_DROP: "Recovery improves",
  PRESSURE_STABILIZE: "Pressure stabilizes",
  RETURN_RISE: "Return rises",
  RETURN_STABILIZE: "Return stabilizes",
  STABILITY_RISE: "Stability stabilizes",
};

type BuildCohortSummaryInput = {
  decisions: DecisionEntry[];
  request: CohortBuildRequest;
};

type VelocityCheckFn = (window: DecisionEntry[], thresholds: VelocityThresholds) => boolean;

const VELOCITY_TARGET_CHECKS: Record<VelocityGoalTarget, VelocityCheckFn> = {
  PRESSURE_DROP: (window, thresholds) => average(window, "pressure") <= thresholds.pressureDrop,
  PRESSURE_STABILIZE: (window, thresholds) =>
    Math.abs(average(window, "pressure")) <= thresholds.pressureStabilize &&
    average(window, "stability") >= thresholds.stabilityFloor,
  RETURN_RISE: (window, thresholds) => average(window, "return") >= thresholds.returnLift,
  RETURN_STABILIZE: (window, thresholds) =>
    Math.abs(average(window, "return")) <= thresholds.returnStabilizeBand,
  STABILITY_RISE: (window, thresholds) => average(window, "stability") >= thresholds.stabilityFloor + 1,
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

  if (sorted.length < windowSize) {
    return {
      target,
      targetLabel,
      decisionsToTarget: null,
      windowsEvaluated: 0,
      targetReached: false,
      reason: `Need at least ${windowSize} decisions to evaluate velocity`,
    };
  }

  const checkFn = VELOCITY_TARGET_CHECKS[target];
  let decisionsToTarget: number | null = null;

  for (let i = 0; i <= sorted.length - windowSize; i++) {
    const window = sorted.slice(i, i + windowSize);
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
    reason: targetReached ? undefined : `${targetLabel} not reached in ${sorted.length} decisions`,
  };
}

export function runCompare({
  mode,
  normalizationBasis,
  velocityTarget,
  includeVelocity,
  cohortA,
  cohortB,
  decisionsA,
  decisionsB,
  windowSize,
  thresholds,
}: {
  mode: CompareMode;
  normalizationBasis: NormalizationBasis;
  velocityTarget?: VelocityGoalTarget;
  includeVelocity?: boolean;
  cohortA: CohortSummary;
  cohortB: CohortSummary;
  decisionsA: DecisionEntry[];
  decisionsB: DecisionEntry[];
  windowSize?: number;
  thresholds?: Partial<VelocityThresholds>;
}): CompareResult {
  const returnDelta = cohortB.avgReturn - cohortA.avgReturn;
  const pressureDelta = cohortB.avgPressure - cohortA.avgPressure;
  const stabilityDelta = cohortB.avgStability - cohortA.avgStability;

  const includeVelocityInsights = includeVelocity && velocityTarget;
  const velocityA = includeVelocityInsights
    ? computeVelocity(decisionsA, velocityTarget!, {
        windowSize,
        thresholds,
        normalizationBasis,
      })
    : undefined;
  const velocityB = includeVelocityInsights
    ? computeVelocity(decisionsB, velocityTarget!, {
        windowSize,
        thresholds,
        normalizationBasis,
      })
    : undefined;

  const punchline =
    includeVelocityInsights && velocityA && velocityB
      ? buildVelocityPunchline(cohortA.label, cohortB.label, velocityA, velocityB)
      : undefined;

  return {
    mode,
    velocityTarget: includeVelocityInsights ? velocityTarget : undefined,
    normalizationBasis,
    cohortA,
    cohortB,
    deltas: {
      returnDelta,
      pressureDelta,
      stabilityDelta,
    },
    summary: buildPostureSummary(cohortA.label, cohortB.label, {
      returnDelta,
      pressureDelta,
      stabilityDelta,
    }),
    velocity:
      includeVelocityInsights && velocityA && velocityB && punchline
        ? {
            a: velocityA,
            b: velocityB,
            punchline,
          }
        : undefined,
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
  const reachedA = typeof velocityA.decisionsToTarget === "number";
  const reachedB = typeof velocityB.decisionsToTarget === "number";

  if (!reachedA && !reachedB) {
    return "Neither system has reached the target yet.";
  }

  if (reachedA && reachedB) {
    return `${labelA} reached the target in ${velocityA.decisionsToTarget} decisions; ${labelB} reached it in ${velocityB.decisionsToTarget}.`;
  }

  if (reachedA) {
    return `${labelA} reached the target in ${velocityA.decisionsToTarget} decisions. ${labelB} has not yet reached it.`;
  }

  return `${labelB} reached the target in ${velocityB.decisionsToTarget} decisions. ${labelA} has not yet reached it.`;
}

function buildPostureSummary(
  labelA: string,
  labelB: string,
  deltas: { returnDelta: number; pressureDelta: number; stabilityDelta: number },
): string {
  const parts: string[] = [];

  if (deltas.returnDelta > 0.05) parts.push("higher return");
  if (deltas.pressureDelta < -0.05) parts.push("lower pressure");
  if (deltas.stabilityDelta > 0.05) parts.push("stronger stability");

  if (parts.length === 0) {
    return `${labelA} and ${labelB} perform similarly across return, pressure, and stability.`;
  }

  const summary = parts.join(" and ");
  return `${labelB} delivers ${summary} versus ${labelA}.`;
}
