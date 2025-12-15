export type CompareMode = "entity" | "temporal" | "velocity";

export type VelocityGoalTarget =
  | "RETURN_RISE"
  | "PRESSURE_STABILIZE"
  | "STABILITY_STABILIZE";

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
  stabilityBand: number;
  returnLift: number;
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
  cohortA: CohortSummary;
  cohortB: CohortSummary;
  deltas: {
    returnDelta: number;
    pressureDelta: number;
    stabilityDelta: number;
  };
  narrative: string;
  modeSummary: string;
  warnings?: string[];
  velocity?: {
    target: VelocityGoalTarget;
    targetLabel: string;
    a: VelocityResult;
    b: VelocityResult;
    punchline: string;
  };
  developerDetails?: ExplainabilityLayers;
};

export type CohortBuildRequest = {
  label: string;
  timeframeLabel: string;
  normalizationBasis: NormalizationBasis;
};
