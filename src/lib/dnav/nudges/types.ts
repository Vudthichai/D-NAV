import type { DecisionMetrics, DecisionVarKey } from "../types";

export type NudgeGoal = "increase-dnav" | "increase-return" | "reduce-pressure" | "increase-stability";

export type NudgeConstraints = {
  preventPressureIncrease: boolean;
  preventReturnDecrease: boolean;
  preventStabilityDecrease: boolean;
  minDnav?: number;
};

export type NudgePolicy = {
  allowUrgencyIncrease: boolean;
};

export type NudgeSettings = {
  goal: NudgeGoal;
  minGoalImprovement: number;
  constraints: NudgeConstraints;
  policy: NudgePolicy;
};

export type NudgeStep = {
  key: DecisionVarKey;
  delta: number;
  from: number;
  to: number;
};

export type NudgeCandidate = {
  steps: NudgeStep[];
  beforeMetrics: DecisionMetrics;
  afterMetrics: DecisionMetrics;
  goalImprovement: number;
  score: number;
  usedTwoSteps: boolean;
  rationale: string[];
  violatesConstraints: boolean;
};

export type NudgeResult = {
  steps: NudgeStep[];
  beforeMetrics: DecisionMetrics;
  afterMetrics: DecisionMetrics;
  deltas: {
    dnav: number;
    return: number;
    pressure: number;
    stability: number;
  };
  goalImprovement: number;
  usedTwoSteps: boolean;
  rationale: string[];
};
