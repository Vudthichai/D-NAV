import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_DECISION_VARS, type DecisionVars } from "../types";
import { computeBestNudge } from "./engine";
import type { NudgeSettings } from "./types";

const baseSettings: NudgeSettings = {
  goal: "increase-dnav",
  minGoalImprovement: 1,
  constraints: {
    preventPressureIncrease: false,
    preventReturnDecrease: false,
    preventStabilityDecrease: false,
  },
  policy: {
    allowUrgencyIncrease: false,
  },
};

function withSettings(
  overrides: Partial<Omit<NudgeSettings, "constraints" | "policy">> & {
    constraints?: Partial<NudgeSettings["constraints"]>;
    policy?: Partial<NudgeSettings["policy"]>;
  },
): NudgeSettings {
  return {
    ...baseSettings,
    ...overrides,
    constraints: {
      ...baseSettings.constraints,
      ...(overrides.constraints ?? {}),
    },
    policy: {
      ...baseSettings.policy,
      ...(overrides.policy ?? {}),
    },
  };
}

const BASELINE: DecisionVars = { ...DEFAULT_DECISION_VARS };

test("pressure constraint prevents pressure increases", () => {
  const candidate: DecisionVars = { impact: 6, cost: 4, risk: 5, urgency: 7, confidence: 6 };
  const settings = withSettings({
    goal: "increase-return",
    constraints: { preventPressureIncrease: true },
  });

  const result = computeBestNudge(BASELINE, candidate, settings);
  assert.ok(result, "should return a nudge");
  assert.ok(result.deltas.pressure <= 0, "pressure must not increase");
});

test("urgency increases are blocked unless allowed", () => {
  const candidate: DecisionVars = { impact: 6, cost: 4, risk: 5, urgency: 4, confidence: 6 };
  const result = computeBestNudge(
    BASELINE,
    candidate,
    withSettings({
      goal: "reduce-pressure",
      policy: { allowUrgencyIncrease: false },
    }),
  );

  assert.ok(result, "should return a nudge");
  const urgencyStep = result.steps.find((step) => step.key === "urgency");
  assert.ok(!urgencyStep || urgencyStep.delta <= 0, "urgency should not increase when disallowed");
});

test("falls back to two-step when no single-step candidate satisfies constraints", () => {
  const candidate: DecisionVars = { impact: 5, cost: 5, risk: 5, urgency: 5, confidence: 5 };
  const settings = withSettings({
    goal: "increase-dnav",
    minGoalImprovement: 1,
    constraints: { minDnav: 26 },
  });

  const result = computeBestNudge(BASELINE, candidate, settings);
  assert.ok(result, "should return a nudge");
  assert.equal(result.steps.length, 2, "uses two steps when singles fail");
});

test("respects minimum D-NAV threshold when provided", () => {
  const candidate: DecisionVars = { impact: 4, cost: 7, risk: 5, urgency: 6, confidence: 5 };
  const settings = withSettings({
    goal: "increase-return",
    constraints: { minDnav: 20 },
  });

  const result = computeBestNudge(BASELINE, candidate, settings);
  assert.ok(result, "should return a nudge");
  assert.ok(result.afterMetrics.dnav >= 20, "must keep D-NAV above the threshold");
});
