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

type TermDefinition = {
  label: string;
  short: string;
  long?: string;
};

export const TERMS: Record<TermKey, TermDefinition> = {
  impact: {
    label: "Impact",
    short: "Upside magnitude if it works.",
  },
  cost: {
    label: "Cost",
    short: "What you spend: time, money, effort, attention.",
  },
  risk: {
    label: "Risk",
    short: "Downside magnitude + uncertainty if it fails.",
  },
  urgency: {
    label: "Urgency",
    short: "Time pressure; cost of waiting.",
  },
  confidence: {
    label: "Confidence",
    short: "Strength of evidence you can execute and get the outcome.",
  },
  return: {
    label: "Return",
    short: "Net gain.",
    long: "Impact − Cost.",
  },
  pressure: {
    label: "Pressure",
    short: "What’s pushing you.",
    long: "Urgency − Confidence.",
  },
  stability: {
    label: "Stability",
    short: "Your footing.",
    long: "Confidence − Risk.",
  },
  dnav: {
    label: "D-NAV",
    short: "Overall decision posture derived from Return, Pressure, Stability.",
  },
};
