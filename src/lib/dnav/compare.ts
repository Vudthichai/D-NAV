import { computeMetrics } from "./compute";
import {
  DECISION_VAR_KEYS,
  SCALE_MAX,
  SCALE_MIN,
  clampVars,
  type CompareResult,
  type Decision,
  type DecisionInput,
  type DecisionVars,
  type DriverDelta,
  type MetricKey,
  type NudgeSuggestion,
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

function findSmallestNudge(candidate: Decision): NudgeSuggestion | undefined {
  const currentDnav = candidate.metrics.dnav;
  let best: NudgeSuggestion | undefined;

  for (const key of DECISION_VAR_KEYS) {
    for (const direction of [1, -1] as const) {
      const proposed = candidate.vars[key] + direction;
      if (proposed === candidate.vars[key]) continue;
      if (proposed < SCALE_MIN || proposed > SCALE_MAX) continue;

      const updatedVars: DecisionVars = { ...candidate.vars, [key]: proposed };
      const nextMetrics = computeMetrics(updatedVars);
      const gain = nextMetrics.dnav - currentDnav;

      if (gain <= 0) continue;

      if (!best || gain > best.dnavGain) {
        best = {
          key,
          direction,
          current: candidate.vars[key],
          proposed,
          dnavGain: gain,
          nextDnav: nextMetrics.dnav,
        };
      } else if (best && gain === best.dnavGain && Math.abs(proposed - candidate.vars[key]) < Math.abs(best.proposed - best.current)) {
        best = {
          key,
          direction,
          current: candidate.vars[key],
          proposed,
          dnavGain: gain,
          nextDnav: nextMetrics.dnav,
        };
      }
    }
  }

  return best;
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
  const smallestNudge = findSmallestNudge(candidate);

  return {
    baseline,
    candidate,
    deltas,
    drivers,
    smallestNudge,
  };
}
