export type DecisionInputs = {
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
};

export type DecisionMetrics = {
  return: number;
  pressure: number;
  stability: number;
  dnav: number;
};

export type LeverageVariable = keyof DecisionInputs;

export type LeverageTag = "High" | "Medium" | "Low";

export type LeverageRow = {
  variable: LeverageVariable;
  deltaInput: number;
  deltaDnav: number;
  leverageTag: LeverageTag;
  direction: "up" | "down" | "flat";
};
