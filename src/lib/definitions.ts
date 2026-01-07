export type TermKey =
  | "impact"
  | "cost"
  | "risk"
  | "urgency"
  | "confidence"
  | "return"
  | "pressure"
  | "stability"
  | "dnav";

type Definition = {
  label: string;
  body: string;
  formula?: string;
};

export const DEFINITIONS: Record<TermKey, Definition> = {
  impact: {
    label: "Impact",
    body: "How much upside this decision can create if it works.",
  },
  cost: {
    label: "Cost",
    body: "The resource burn required: time, money, focus, complexity, opportunity cost.",
  },
  risk: {
    label: "Risk",
    body: "Downside exposure: probability × severity, and what breaks if you’re wrong.",
  },
  urgency: {
    label: "Urgency",
    body: "Time pressure: how quickly the decision must be made before the window closes.",
  },
  confidence: {
    label: "Confidence",
    body: "Strength of evidence that you can execute and get the intended result.",
  },
  return: {
    label: "Return",
    body: "Net value signal from the decision frame.",
    formula: "Return = Impact − Cost",
  },
  pressure: {
    label: "Pressure",
    body: "How much the clock is outrunning your certainty.",
    formula: "Pressure = Urgency − Confidence",
  },
  stability: {
    label: "Stability",
    body: "How survivable the move is if things go sideways.",
    formula: "Stability = Confidence − Risk",
  },
  dnav: {
    label: "D-NAV",
    body: "Composite readout summarizing the decision’s condition across Return, Pressure, and Stability.",
  },
};
