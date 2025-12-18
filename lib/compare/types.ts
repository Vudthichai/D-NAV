import type { PostureContrast, PostureSummary } from "../judgment/posture";

export type CompareMode = "entity" | "temporal" | "velocity";

export type RPSPoint = { x: string | number; R: number; P: number; S: number };

export type RPSLineSeries = {
  id: string;
  label: string;
  data: RPSPoint[];
};

export type ScatterPoint = {
  xPressure: number;
  yReturn: number;
  stability: number;
  t?: number;
  label?: string;
};

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
  datasetLabel?: string;
  timeframeLabel: string;
  timeframeMode?: "time" | "sequence";
  sequenceRange?: { start: number; end: number } | null;
  totalAvailableDecisions?: number;
  judgmentUnitLabel?: string;
  normalizationBasis: NormalizationBasis;
  totalDecisions: number;
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
  stdReturn: number;
  stdPressure: number;
  stdStability: number;
  avgImpact: number;
  avgCost: number;
  avgRisk: number;
  avgUrgency: number;
  avgConfidence: number;
};

export type VelocityThresholds = {
  pressureBand: number;
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
  consecutiveWindows: number;
  windowSize: number;
  reason?: string;
  explainability: ExplainabilityLayers;
};

export type CompareResult = {
  mode: CompareMode;
  cohortA: CohortSummary;
  cohortB: CohortSummary;
  judgmentUnitLabel?: string;
  deltas: {
    returnDelta: number;
    pressureDelta: number;
    stabilityDelta: number;
  };
  driverDeltas: {
    impact: number;
    cost: number;
    risk: number;
    urgency: number;
    confidence: number;
  };
  consistency: {
    cohortAStd: { return: number; pressure: number; stability: number };
    cohortBStd: { return: number; pressure: number; stability: number };
  };
  topDrivers: string[];
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
  posture?: {
    cohortA: PostureSummary;
    cohortB: PostureSummary;
    contrast: PostureContrast;
  };
};

export type CohortBuildRequest = {
  label: string;
  timeframeLabel: string;
  normalizationBasis: NormalizationBasis;
  datasetLabel?: string;
  judgmentUnitLabel?: string;
  timeframeMode?: "time" | "sequence";
  sequenceRange?: { start: number; end: number } | null;
  totalAvailableDecisions?: number;
};
