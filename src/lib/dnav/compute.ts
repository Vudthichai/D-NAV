import { computeMetrics as legacyComputeMetrics } from "@/lib/calculations";
import { type Decision, type DecisionMetrics, type DecisionVars, type DecisionSource } from "./types";

export const VARIABLE_MIN = 1;
export const VARIABLE_MAX = 10;

export function clampVariable(value: number): number {
  const numeric = Number.isFinite(value) ? Math.round(value) : VARIABLE_MIN;
  return Math.min(VARIABLE_MAX, Math.max(VARIABLE_MIN, numeric));
}

export function computeMetrics(vars: DecisionVars): DecisionMetrics {
  const metrics = legacyComputeMetrics(vars);
  return {
    dnav: metrics.dnav,
    return: metrics.return,
    pressure: metrics.pressure,
    stability: metrics.stability,
    merit: metrics.merit,
    energy: metrics.energy,
  };
}

export function buildDecision(input: {
  id: string;
  label: string;
  vars: DecisionVars;
  category?: string;
  timestamp?: number;
  source?: DecisionSource;
}): Decision {
  const normalizedVars: DecisionVars = {
    impact: clampVariable(input.vars.impact),
    cost: clampVariable(input.vars.cost),
    risk: clampVariable(input.vars.risk),
    urgency: clampVariable(input.vars.urgency),
    confidence: clampVariable(input.vars.confidence),
  };

  const metrics = computeMetrics(normalizedVars);

  return {
    id: input.id,
    label: input.label,
    vars: normalizedVars,
    metrics,
    category: input.category,
    timestamp: input.timestamp,
    source: input.source,
  };
}
