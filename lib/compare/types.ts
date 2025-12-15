export type CompareMode = "system" | "category" | "failure_mode";

export type VelocityGoalTarget =
  | "PRESSURE_STABILIZE"
  | "RETURN_STABILIZE"
  | "STABILITY_RISE"
  | "RETURN_RISE"
  | "PRESSURE_DROP";

export type NormalizationBasis = "shared_timeframe" | "normalized_windows";

export type FailureMode = {
  key: string;
  label: string;
  description: string;
  floor: number;
};

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

export type ExplainabilityLayers = {
  layer1Raw: Record<string, unknown>;
  layer2Thresholds: Record<string, unknown>;
  layer3Intermediates: Record<string, unknown>;
  layer4Punchline: string;
};

export type VelocityResult = {
  target: VelocityGoalTarget;
  targetLabel: string;
  decisionsToTarget: number | null;
  windowsEvaluated: number;
  targetReached: boolean;
  thresholds: VelocityThresholds;
  reason?: string;
  explainability: ExplainabilityLayers;
};

export type CompareResult = {
  mode: CompareMode;
  velocityTarget: VelocityGoalTarget;
  normalizationBasis: NormalizationBasis;
  cohortA: CohortSummary;
  cohortB: CohortSummary;
  deltas: {
    returnDelta: number;
    pressureDelta: number;
    stabilityDelta: number;
  };
  velocity: {
    a: VelocityResult;
    b: VelocityResult;
    punchline: string;
  };
  failureModes?: FailureMode[];
  explainability: ExplainabilityLayers;
};

export type CohortBuildRequest = {
  label: string;
  timeframeLabel: string;
  normalizationBasis: NormalizationBasis;
};
