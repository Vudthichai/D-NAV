export type CompareMode = "ENTITY" | "TEMPORAL" | "VELOCITY";

export type NormalizationBasis = "PER_DECISION" | "PER_DAY" | "PER_WEEK" | "PER_MONTH" | "PER_QUARTER";

export type VelocityGoalType = "VALUE_CREATION" | "STABILIZATION" | "ADAPTATION";

export type VelocityTarget = {
  goalType: VelocityGoalType;
  metricKey: "DNAV" | "RETURN" | "PRESSURE" | "STABILITY"; // keep small for v1
  threshold: number; // example: RETURN >= 1.0, PRESSURE <= -2.0, STABILITY >= 2.5
  direction: "GTE" | "LTE";
  normalization: NormalizationBasis; // required in VELOCITY
};

export type CohortSpec = {
  entityId: string; // e.g. "apple", "marketing-dept", "user"
  entityLabel: string; // for display
  timeframe: { start: string; end: string }; // ISO date strings
  filters?: {
    categories?: string[];
    minConfidence?: number;
    maxRisk?: number;
  };
};

export type Explainability = {
  question: string; // Layer 1
  contractLine: string; // Layer 2
  methodBullets: string[]; // Layer 3 (expandable)
  resultHeadline: string; // Layer 4
};

export type CohortSummary = {
  totalDecisions: number;
  avgDnav: number;
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
  categoryWeights: Array<{
    category: string;
    weight: number;
    avgDnav: number;
    avgReturn: number;
    avgPressure: number;
    avgStability: number;
    count: number;
  }>;
};

export type CohortDelta = {
  avgDnav: number;
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
  totalDecisions: number;
};

export type CompareResult = {
  mode: CompareMode;
  cohortA: CohortSpec;
  cohortB: CohortSpec;
  summaryA: CohortSummary; // use existing summary engine output where possible
  summaryB: CohortSummary;
  delta: CohortDelta;
  decisionTerrain?: {
    topIncreases: Array<{ category: string; deltaWeight: number }>;
    topDecreases: Array<{ category: string; deltaWeight: number }>;
    newInB: string[];
    missingInB: string[];
  };
  failureModes: Array<{ code: string; title: string; reason: string }>;
  velocity?: {
    target: VelocityTarget;
    a: { timeToTargetDays?: number; decisionsToTarget?: number; rate?: number };
    b: { timeToTargetDays?: number; decisionsToTarget?: number; rate?: number };
    comparisonLine: string; // e.g. "Marketing stabilized 2.6× faster"
  };
  explainability: Explainability;
  warnings?: string[];
  errors?: string[]; // must be populated on invalid comparisons
};
