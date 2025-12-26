import { computeMetrics } from "../compute";
import { SCALE_MAX, SCALE_MIN, type DecisionMetrics, type DecisionVarKey, type DecisionVars } from "../types";
import {
  type NudgeCandidate,
  type NudgeGoal,
  type NudgeResult,
  type NudgeSettings,
  type NudgeStep,
} from "./types";

type LeverDirection = {
  key: DecisionVarKey;
  directions: Array<1 | -1>;
};

const TWO_STEP_LEVERS: DecisionVarKey[] = ["confidence", "risk", "cost", "impact", "urgency"];

function clampValue(value: number): number {
  if (value < SCALE_MIN) return SCALE_MIN;
  if (value > SCALE_MAX) return SCALE_MAX;
  return value;
}

function applySteps(base: DecisionVars, steps: NudgeStep[]): DecisionVars {
  const next = { ...base };
  for (const step of steps) {
    next[step.key] = clampValue(step.to);
  }
  return next;
}

function isUrgencyIncrease(step: NudgeStep): boolean {
  return step.key === "urgency" && step.delta > 0;
}

function calculateGoalImprovement(goal: NudgeGoal, before: DecisionMetrics, after: DecisionMetrics): number {
  switch (goal) {
    case "increase-dnav":
      return after.dnav - before.dnav;
    case "increase-return":
      return after.return - before.return;
    case "reduce-pressure":
      return before.pressure - after.pressure;
    case "increase-stability":
      return after.stability - before.stability;
  }
}

function violatesConstraints(settings: NudgeSettings, before: DecisionMetrics, after: DecisionMetrics): boolean {
  const { constraints } = settings;
  if (constraints.preventPressureIncrease && after.pressure > before.pressure) return true;
  if (constraints.preventReturnDecrease && after.return < before.return) return true;
  if (constraints.preventStabilityDecrease && after.stability < before.stability) return true;
  if (constraints.minDnav !== undefined && after.dnav < constraints.minDnav) return true;
  return false;
}

function directionPolicy(goal: NudgeGoal, allowUrgencyIncrease: boolean): LeverDirection[] {
  const base: Record<NudgeGoal, LeverDirection[]> = {
    "increase-dnav": [
      { key: "confidence", directions: [1] },
      { key: "impact", directions: [1] },
      { key: "risk", directions: [-1, 1] },
      { key: "cost", directions: [-1, 1] },
      { key: "urgency", directions: allowUrgencyIncrease ? [-1, 1] : [-1] },
    ],
    "reduce-pressure": [
      { key: "urgency", directions: [-1] },
      { key: "confidence", directions: [1] },
      { key: "risk", directions: [-1] },
    ],
    "increase-stability": [
      { key: "confidence", directions: [1] },
      { key: "risk", directions: [-1] },
    ],
    "increase-return": [
      { key: "impact", directions: [1] },
      { key: "cost", directions: [-1] },
      { key: "confidence", directions: [1, -1] },
    ],
  };

  return base[goal];
}

function buildStep(vars: DecisionVars, key: DecisionVarKey, delta: number): NudgeStep | null {
  const proposed = vars[key] + delta;
  if (proposed < SCALE_MIN || proposed > SCALE_MAX) return null;
  return {
    key,
    delta,
    from: vars[key],
    to: proposed,
  };
}

function penalizeTradeoffs(goal: NudgeGoal, before: DecisionMetrics, after: DecisionMetrics): number {
  let penalty = 0;
  const pressureIncrease = Math.max(0, after.pressure - before.pressure);
  const returnDrop = Math.max(0, before.return - after.return);
  const stabilityDrop = Math.max(0, before.stability - after.stability);

  switch (goal) {
    case "increase-return":
      penalty += pressureIncrease * 2;
      penalty += stabilityDrop * 2;
      break;
    case "reduce-pressure":
      penalty += returnDrop * 2;
      penalty += stabilityDrop * 2;
      break;
    case "increase-stability":
      penalty += returnDrop * 2;
      penalty += pressureIncrease;
      break;
    case "increase-dnav":
      penalty += pressureIncrease * 1.5;
      penalty += stabilityDrop;
      break;
  }

  return penalty;
}

function computeScore(settings: NudgeSettings, before: DecisionMetrics, after: DecisionMetrics, candidate: NudgeCandidate): number {
  const improvement = candidate.goalImprovement;
  const tradeoffPenalty = penalizeTradeoffs(settings.goal, before, after);
  const magnitudePenalty = candidate.steps.reduce((total, step) => total + Math.abs(step.delta) - 1, 0);
  const stepPenalty = candidate.usedTwoSteps ? 2 : 0;
  const urgencyPenalty = candidate.steps.reduce((total, step) => {
    if (step.key !== "urgency") return total;
    if (step.delta > 0) return total + (settings.policy.allowUrgencyIncrease ? 6 : 50);
    return total + (settings.goal === "reduce-pressure" ? 0.5 : 1);
  }, 0);
  const dnavGain = after.dnav - before.dnav;

  return improvement * 10 + dnavGain * 1.5 - tradeoffPenalty - magnitudePenalty - stepPenalty - urgencyPenalty;
}

function createCandidate(baseVars: DecisionVars, steps: NudgeStep[], settings: NudgeSettings): NudgeCandidate {
  const beforeMetrics = computeMetrics(baseVars);
  const afterVars = applySteps(baseVars, steps);
  const afterMetrics = computeMetrics(afterVars);
  const goalImprovement = calculateGoalImprovement(settings.goal, beforeMetrics, afterMetrics);
  const violates = violatesConstraints(settings, beforeMetrics, afterMetrics);

  const candidate: NudgeCandidate = {
    steps,
    beforeMetrics,
    afterMetrics,
    goalImprovement,
    usedTwoSteps: steps.length > 1,
    rationale: [],
    score: 0,
    violatesConstraints: violates,
  };

  candidate.rationale = buildRationale(settings.goal, beforeMetrics, afterMetrics, steps, violates);
  candidate.score = computeScore(settings, beforeMetrics, afterMetrics, candidate);
  return candidate;
}

function buildRationale(
  goal: NudgeGoal,
  before: DecisionMetrics,
  after: DecisionMetrics,
  steps: NudgeStep[],
  violates: boolean,
): string[] {
  const parts: string[] = [];
  if (violates) {
    parts.push("Fails a selected constraint.");
    return parts;
  }

  switch (goal) {
    case "increase-return":
      parts.push("Boosts return while balancing pressure and stability.");
      break;
    case "reduce-pressure":
      parts.push("Lowers execution stress without heavy tradeoffs.");
      break;
    case "increase-stability":
      parts.push("Improves stability and conviction on the path.");
      break;
    case "increase-dnav":
      parts.push("Moves overall D-NAV upward efficiently.");
      break;
  }

  const pressureDelta = after.pressure - before.pressure;
  if (pressureDelta < 0) parts.push("Eases pressure.");
  if (after.stability > before.stability) parts.push("Strengthens stability.");
  if (after.return > before.return) parts.push("Improves expected return.");
  if (steps.some(isUrgencyIncrease)) parts.push("Includes urgency increase; consider execution load.");

  return parts;
}

function generateSingleStepCandidates(vars: DecisionVars, settings: NudgeSettings): NudgeCandidate[] {
  const candidates: NudgeCandidate[] = [];
  const leverDirections = directionPolicy(settings.goal, settings.policy.allowUrgencyIncrease);

  for (const { key, directions } of leverDirections) {
    for (const direction of directions) {
      const step = buildStep(vars, key, direction);
      if (!step) continue;
      const candidate = createCandidate(vars, [step], settings);
      candidates.push(candidate);

      if (candidate.goalImprovement < settings.minGoalImprovement) {
        const largerStep = buildStep(vars, key, direction * 2);
        if (largerStep) {
          candidates.push(createCandidate(vars, [largerStep], settings));
        }
      }
    }
  }

  return candidates;
}

function generateTwoStepCandidates(vars: DecisionVars, settings: NudgeSettings): NudgeCandidate[] {
  const candidates: NudgeCandidate[] = [];
  const leverDirections = directionPolicy(settings.goal, settings.policy.allowUrgencyIncrease);
  const allowedKeys = new Set(leverDirections.map((item) => item.key));

  for (let i = 0; i < TWO_STEP_LEVERS.length; i += 1) {
    for (let j = i + 1; j < TWO_STEP_LEVERS.length; j += 1) {
      const firstKey = TWO_STEP_LEVERS[i];
      const secondKey = TWO_STEP_LEVERS[j];
      if (!allowedKeys.has(firstKey) && !allowedKeys.has(secondKey)) continue;

      const firstDirections = leverDirections.find((item) => item.key === firstKey)?.directions ?? [];
      const secondDirections = leverDirections.find((item) => item.key === secondKey)?.directions ?? [];

      for (const d1 of firstDirections) {
        for (const d2 of secondDirections) {
          const stepA = buildStep(vars, firstKey, d1);
          const stepB = buildStep(vars, secondKey, d2);
          if (!stepA || !stepB) continue;
          const candidate = createCandidate(vars, [stepA, stepB], settings);
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates;
}

function chooseBestCandidate(candidates: NudgeCandidate[], minImprovement: number): NudgeCandidate | null {
  const feasible = candidates.filter(
    (candidate) => !candidate.violatesConstraints && candidate.goalImprovement >= minImprovement,
  );
  if (!feasible.length) return null;

  return feasible.reduce((best, current) => {
    if (!best) return current;
    if (current.goalImprovement > best.goalImprovement + 0.01) return current;
    if (Math.abs(current.goalImprovement - best.goalImprovement) < 0.01) {
      if (current.score > best.score) return current;
    }
    return best;
  }, feasible[0]);
}

export function computeBestNudge(_baselineVars: DecisionVars, candidateVars: DecisionVars, settings: NudgeSettings): NudgeResult | null {
  // We apply the nudge to the candidate decision (side B) while using the baseline for context only.
  // This keeps the compare selection URL-driven while letting the nudge engine remain pure.
  const baseVars = candidateVars;

  const singleStepCandidates = generateSingleStepCandidates(baseVars, settings);
  const bestSingle = chooseBestCandidate(singleStepCandidates, settings.minGoalImprovement);

  let bestCandidate = bestSingle;

  if (!bestSingle) {
    const twoStepCandidates = generateTwoStepCandidates(baseVars, settings);
    const bestTwoStep = chooseBestCandidate(twoStepCandidates, settings.minGoalImprovement);
    if (bestTwoStep) {
      bestCandidate = bestTwoStep;
    }
  }

  if (!bestCandidate) return null;

  return {
    steps: bestCandidate.steps,
    beforeMetrics: bestCandidate.beforeMetrics,
    afterMetrics: bestCandidate.afterMetrics,
    deltas: {
      dnav: bestCandidate.afterMetrics.dnav - bestCandidate.beforeMetrics.dnav,
      return: bestCandidate.afterMetrics.return - bestCandidate.beforeMetrics.return,
      pressure: bestCandidate.afterMetrics.pressure - bestCandidate.beforeMetrics.pressure,
      stability: bestCandidate.afterMetrics.stability - bestCandidate.beforeMetrics.stability,
    },
    goalImprovement: bestCandidate.goalImprovement,
    usedTwoSteps: bestCandidate.usedTwoSteps,
    rationale: bestCandidate.rationale,
  };
}
