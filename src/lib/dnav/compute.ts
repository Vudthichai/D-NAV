import { clampVars, type DecisionMetrics, type DecisionVars } from "./types";

export function computeMetrics(vars: DecisionVars): DecisionMetrics {
  const normalized = clampVars(vars);
  const ret = normalized.impact - normalized.cost;
  const stability = normalized.confidence - normalized.risk;
  const pressure = normalized.urgency - normalized.confidence;
  const merit = normalized.impact - normalized.cost - normalized.risk;
  const energy = normalized.urgency * normalized.confidence;
  const dnav = merit + energy;

  return {
    return: ret,
    stability,
    pressure,
    merit,
    energy,
    dnav,
  };
}
