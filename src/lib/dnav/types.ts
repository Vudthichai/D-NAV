export type DecisionVars = {
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
};

export type DecisionMetrics = {
  dnav: number;
  return: number;
  pressure: number;
  stability: number;
  merit: number;
  energy: number;
};

export type DecisionSource = "log" | "manual" | "baseline";

export type Decision = {
  id: string;
  label: string;
  vars: DecisionVars;
  metrics: DecisionMetrics;
  category?: string;
  timestamp?: number;
  source?: DecisionSource;
};

export type Delta = {
  dnav: number;
  return: number;
  pressure: number;
  stability: number;
  vars: Partial<Record<keyof DecisionVars, number>>;
};

export type Driver = { key: keyof DecisionVars; contribution: number; note: string };

export type SensitivitySuggestion = {
  target: "dnav" | "return" | "pressure" | "stability";
  direction: "increase" | "decrease";
  by: number;
  recommendedChange: { key: keyof DecisionVars; from: number; to: number; delta: number };
  rationale: string;
};

export type CompareResult = {
  baseline: Decision;
  candidate: Decision;
  delta: Delta;
  drivers: {
    top: Driver[];
  };
  sensitivity: {
    suggestions: SensitivitySuggestion[];
  };
};
