export type DefinitionEntry = {
  label: string;
  shortDefinition: string;
  note?: string;
};

export const decisionVariables = {
  impact: {
    label: "Impact",
    shortDefinition: "Upside if it works. Higher = more potential gain.",
  },
  cost: {
    label: "Cost",
    shortDefinition: "Money, time, focus, or reputation you burn to make it happen.",
  },
  risk: {
    label: "Risk",
    shortDefinition: "What breaks or is hard to unwind if you’re wrong.",
  },
  urgency: {
    label: "Urgency",
    shortDefinition: "How soon a move is needed before options shrink.",
  },
  confidence: {
    label: "Confidence",
    shortDefinition: "Evidence and experience behind the call—not just hope.",
  },
} as const satisfies Record<string, DefinitionEntry>;

export const derivedSignals = {
  return: {
    label: "Return",
    note: "R",
    shortDefinition: "Impact minus Cost. Positive means upside beats the burn.",
  },
  pressure: {
    label: "Pressure",
    note: "P",
    shortDefinition: "Urgency minus Confidence. Shows if urgency or conviction is steering you.",
  },
  stability: {
    label: "Stability",
    note: "S",
    shortDefinition: "Confidence minus Risk. Tests if evidence can outlast friction and downside.",
  },
} as const satisfies Record<string, DefinitionEntry>;

export const archetype = {
  archetype: {
    label: "Archetype",
    shortDefinition:
      "A stance derived from the signs of Return, Pressure, and Stability (R/P/S). Each combination maps to a one-word archetype so you can name the situation quickly.",
  },
} as const satisfies Record<string, DefinitionEntry>;

export const DEFINITIONS = {
  ...decisionVariables,
  ...derivedSignals,
  ...archetype,
} as const;

export type DefinitionKey = keyof typeof DEFINITIONS;

export const DECISION_VARIABLE_KEYS = [
  "impact",
  "cost",
  "risk",
  "urgency",
  "confidence",
] as const satisfies DefinitionKey[];

export const DERIVED_SIGNAL_KEYS = ["return", "pressure", "stability"] as const satisfies DefinitionKey[];
