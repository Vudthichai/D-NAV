import { buildDecision, clampVariable, computeMetrics, VARIABLE_MAX, VARIABLE_MIN } from "./compute";
import { type Decision, type DecisionVars, type SensitivitySuggestion } from "./types";

const TARGETS = new Set(["dnav", "return", "pressure", "stability"] as const);

function metricValue(decision: Decision, metric: "dnav" | "return" | "pressure" | "stability"): number {
  return decision.metrics[metric];
}

type TargetMetric = "dnav" | "return" | "pressure" | "stability";

type NudgeCandidate = SensitivitySuggestion & { distance: number; meetsTarget: boolean; effectiveness: number };

export function findSmallestNudge(vars: DecisionVars, targetMetric: TargetMetric, targetDelta: number): SensitivitySuggestion | null {
  if (!TARGETS.has(targetMetric)) return null;

  const baseDecision = buildDecision({ id: "baseline", label: "baseline", vars });
  const baseValue = metricValue(baseDecision, targetMetric);
  const desiredDirection = targetDelta >= 0 ? 1 : -1;
  const desiredMagnitude = Math.abs(targetDelta) || 1;

  const orderedVars: (keyof DecisionVars)[] = ["impact", "cost", "risk", "urgency", "confidence"];
  let best: NudgeCandidate | null = null;

  for (const key of orderedVars) {
    for (const direction of [1, -1] as const) {
      const currentValue = baseDecision.vars[key];
      const candidateValue = clampVariable(currentValue + direction);
      if (candidateValue === currentValue || candidateValue < VARIABLE_MIN || candidateValue > VARIABLE_MAX) {
        continue;
      }

      const candidateDecision: Decision = buildDecision({
        id: `${key}-${direction}`,
        label: "candidate",
        vars: { ...baseDecision.vars, [key]: candidateValue },
      });

      const delta = metricValue(candidateDecision, targetMetric) - baseValue;
      const effectiveness = delta * desiredDirection;
      const meetsTarget = effectiveness >= desiredMagnitude;
      const distance = Math.abs(desiredMagnitude - effectiveness);

      const suggestion: NudgeCandidate = {
        target: targetMetric,
        direction: desiredDirection > 0 ? "increase" : "decrease",
        by: desiredMagnitude,
        recommendedChange: {
          key,
          from: currentValue,
          to: candidateValue,
          delta: candidateValue - currentValue,
        },
        rationale: buildRationale({
          key,
          from: currentValue,
          to: candidateValue,
          metricDelta: delta,
          baseMetric: baseValue,
          target: targetMetric,
        }),
        distance,
        meetsTarget,
        effectiveness,
      };

      if (!best) {
        best = suggestion;
        continue;
      }

      if (shouldReplaceSuggestion(best, suggestion)) {
        best = suggestion;
      }
    }
  }

  return best;
}

function shouldReplaceSuggestion(current: NudgeCandidate, candidate: NudgeCandidate): boolean {
  if (candidate.meetsTarget && !current.meetsTarget) return true;
  if (candidate.meetsTarget === current.meetsTarget) {
    if (candidate.distance !== current.distance) return candidate.distance < current.distance;
    if (candidate.effectiveness !== current.effectiveness) return candidate.effectiveness > current.effectiveness;
    if (candidate.recommendedChange.key !== current.recommendedChange.key) {
      return candidate.recommendedChange.key < current.recommendedChange.key;
    }
    return candidate.recommendedChange.delta < current.recommendedChange.delta;
  }
  return false;
}

function buildRationale(input: {
  key: keyof DecisionVars;
  from: number;
  to: number;
  metricDelta: number;
  baseMetric: number;
  target: TargetMetric;
}): string {
  const { key, from, to, metricDelta, baseMetric, target } = input;
  const direction = metricDelta > 0 ? "raises" : metricDelta < 0 ? "reduces" : "keeps";
  const formattedDelta = metricDelta === 0 ? "no change" : `${metricDelta > 0 ? "+" : ""}${formatDelta(metricDelta)}`;
  const metricLabel = target.toUpperCase();
  const targetPreview = metricDelta === 0 ? baseMetric : baseMetric + metricDelta;
  return `${capitalize(key)} from ${from} to ${to} ${direction} ${metricLabel} by ${formattedDelta} (to ${formatDelta(targetPreview)}).`;
}

function formatDelta(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
