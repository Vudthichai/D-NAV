import { computeMetrics } from "./compute";
import {
  DECISION_VAR_KEYS,
  clampVars,
  type CompareResult,
  type Decision,
  type DecisionInput,
  type DecisionVars,
  type DriverDelta,
  type MetricKey,
} from "./types";

const COMPARE_METRICS_ORDER: MetricKey[] = ["dnav", "return", "pressure", "stability", "energy", "merit"];

function normalizeDecision(input: DecisionInput): Decision {
  const vars = clampVars(input.vars);
  const metrics = input.metrics ?? computeMetrics(vars);

  return {
    ...input,
    vars,
    metrics,
  };
}

function buildDrivers(baseline: DecisionVars, candidate: DecisionVars): DriverDelta[] {
  const drivers = DECISION_VAR_KEYS.map((key) => {
    const from = baseline[key];
    const to = candidate[key];
    return {
      key,
      from,
      to,
      delta: to - from,
    };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const nonZero = drivers.filter((item) => item.delta !== 0);
  return (nonZero.length > 0 ? nonZero : drivers).slice(0, 3);
}

export function compareDecisions(baselineInput: DecisionInput, candidateInput: DecisionInput): CompareResult {
  const baseline = normalizeDecision(baselineInput);
  const candidate = normalizeDecision(candidateInput);

  const deltas = COMPARE_METRICS_ORDER.map((metric) => {
    const from = baseline.metrics[metric];
    const to = candidate.metrics[metric];
    return {
      metric,
      from,
      to,
      delta: to - from,
    };
  });

  const drivers = buildDrivers(baseline.vars, candidate.vars);

  return {
    baseline,
    candidate,
    deltas,
    drivers,
  };
}
