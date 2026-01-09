export type DefinitionItem = {
  title: string;
  body: string;
};

export const DECISION_VARIABLE_DEFINITIONS = [
  { title: "Impact", body: "Upside if it works. Higher = more potential gain." },
  { title: "Cost", body: "Money, time, focus, or reputation you burn to make it happen." },
  { title: "Risk", body: "What breaks or is hard to unwind if you’re wrong." },
  { title: "Urgency", body: "How soon a move is needed before options shrink." },
  { title: "Confidence", body: "Evidence and experience behind the call—not just hope." },
] as const satisfies DefinitionItem[];

export const DERIVED_SIGNAL_DEFINITIONS = [
  { title: "Return (R)", body: "Impact minus Cost. Positive means upside beats the burn." },
  {
    title: "Pressure (P)",
    body: "Urgency minus Confidence. Shows if urgency or conviction is steering you.",
  },
  {
    title: "Stability (S)",
    body: "Confidence minus Risk. Tests if evidence can outlast friction and downside.",
  },
] as const satisfies DefinitionItem[];

export const ARCHETYPE_DEFINITION = {
  title: "Archetype",
  body: "A stance derived from the signs of Return, Pressure, and Stability (R/P/S). Each combination maps to a one-word archetype so you can name the situation quickly.",
} as const satisfies DefinitionItem;

export const DEFINITION_LOOKUP = {
  impact: DECISION_VARIABLE_DEFINITIONS[0],
  cost: DECISION_VARIABLE_DEFINITIONS[1],
  risk: DECISION_VARIABLE_DEFINITIONS[2],
  urgency: DECISION_VARIABLE_DEFINITIONS[3],
  confidence: DECISION_VARIABLE_DEFINITIONS[4],
  return: DERIVED_SIGNAL_DEFINITIONS[0],
  pressure: DERIVED_SIGNAL_DEFINITIONS[1],
  stability: DERIVED_SIGNAL_DEFINITIONS[2],
  archetype: ARCHETYPE_DEFINITION,
} as const;

export type DefinitionKey = keyof typeof DEFINITION_LOOKUP;
