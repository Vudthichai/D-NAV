export type DecisionVars = {
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
};

export type DecisionMetrics = {
  return: number;
  stability: number;
  pressure: number;
  merit: number;
  energy: number;
  dnav: number;
};

export type DecisionSource = "manual" | "log";

export const DECISION_VAR_KEYS = ["impact", "cost", "risk", "urgency", "confidence"] as const;

export type DecisionVarKey = (typeof DECISION_VAR_KEYS)[number];

export const SCALE_MIN = 1;
export const SCALE_MAX = 10;

export function clampToScale(value: number): number {
  if (!Number.isFinite(value)) return SCALE_MIN;
  if (value < SCALE_MIN) return SCALE_MIN;
  if (value > SCALE_MAX) return SCALE_MAX;
  return value;
}

export function clampVars(vars: DecisionVars): DecisionVars {
  return {
    impact: clampToScale(vars.impact),
    cost: clampToScale(vars.cost),
    risk: clampToScale(vars.risk),
    urgency: clampToScale(vars.urgency),
    confidence: clampToScale(vars.confidence),
  };
}

export type Decision = {
  id?: string;
  label: string;
  source: DecisionSource;
  vars: DecisionVars;
  metrics: DecisionMetrics;
};

export type DecisionInput = Omit<Decision, "metrics"> & { metrics?: DecisionMetrics };

export type MetricKey = keyof DecisionMetrics;

export type CompareDelta = {
  metric: MetricKey;
  from: number;
  to: number;
  delta: number;
};

export type DriverDelta = {
  key: DecisionVarKey;
  from: number;
  to: number;
  delta: number;
};

export type NudgeSuggestion = {
  key: DecisionVarKey;
  direction: 1 | -1;
  current: number;
  proposed: number;
  dnavGain: number;
  nextDnav: number;
};

export type CompareResult = {
  baseline: Decision;
  candidate: Decision;
  deltas: CompareDelta[];
  drivers: DriverDelta[];
  smallestNudge?: NudgeSuggestion;
};

export const DEFAULT_DECISION_VARS: DecisionVars = {
  impact: 5,
  cost: 5,
  risk: 5,
  urgency: 5,
  confidence: 5,
};
