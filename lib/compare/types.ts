export type CompareMode = "entity" | "temporal";

export type VelocityGoalTarget =
  | "PRESSURE_STABILIZE"
  | "RETURN_STABILIZE"
  | "STABILITY_RISE"
  | "RETURN_RISE"
  | "PRESSURE_DROP";

export type NormalizationBasis = "shared_timeframe" | "normalized_windows";

export type CohortSummary = {
  label: string;
  timeframeLabel: string;
  normalizationBasis: NormalizationBasis;
  totalDecisions: number;
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
};

export type VelocityThresholds = {
  pressureStabilize: number;
  stabilityFloor: number;
  returnFloor: number;
  returnLift: number;
  returnStabilizeBand: number;
  pressureDrop: number;
};

export type VelocityResult = {
  target: VelocityGoalTarget;
  targetLabel: string;
  decisionsToTarget: number | null;
  windowsEvaluated: number;
  targetReached: boolean;
  reason?: string;
};

export type CompareResult = {
  mode: CompareMode;
  velocityTarget?: VelocityGoalTarget;
  normalizationBasis: NormalizationBasis;
  cohortA: CohortSummary;
  cohortB: CohortSummary;
  deltas: {
    returnDelta: number;
    pressureDelta: number;
    stabilityDelta: number;
  };
  summary: string;
  velocity?: {
    a: VelocityResult;
    b: VelocityResult;
    punchline: string;
  };
};

export type CohortBuildRequest = {
  label: string;
  timeframeLabel: string;
  normalizationBasis: NormalizationBasis;
};
