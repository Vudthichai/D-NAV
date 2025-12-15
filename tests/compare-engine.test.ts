import test from "node:test";
import assert from "node:assert/strict";

import { buildCohortSummary, computeVelocity, runCompare } from "../lib/compare/engine";
import { type DecisionEntry } from "../lib/calculations";

const sampleDecision = (ts: number, overrides: Partial<DecisionEntry> = {}): DecisionEntry => ({
  ts,
  name: `Decision ${ts}`,
  category: "ops",
  impact: 1,
  cost: 0,
  risk: 0,
  urgency: 1,
  confidence: 1,
  return: 1,
  stability: 1,
  pressure: 0,
  merit: 0,
  energy: 0,
  dnav: 0,
  ...overrides,
});

test("computeVelocity detects stabilization within window", () => {
  const decisions = [
    sampleDecision(1, { pressure: 0.4, stability: 0 }),
    sampleDecision(2, { pressure: 0.3, stability: 0.2 }),
    sampleDecision(3, { pressure: 0.2, stability: 0.3 }),
  ];

  const result = computeVelocity(decisions, "PRESSURE_STABILIZE", {
    windowSize: 3,
    consecutiveWindows: 1,
    thresholds: { pressureBand: 0.5 },
  });

  assert.equal(result.targetReached, true);
  assert.equal(result.decisionsToTarget, 3);
  assert.equal(result.targetLabel, "Pressure stabilizes");
});

test("computeVelocity warns when insufficient data", () => {
  const decisions = [sampleDecision(1)];
  const result = computeVelocity(decisions, "PRESSURE_STABILIZE", { windowSize: 3 });

  assert.equal(result.targetReached, false);
  assert.equal(result.windowsEvaluated, 0);
  assert.ok(result.reason?.includes("Need at least"));
});

test("runCompare builds punchline for faster cohort", () => {
  const cohortADecisions = [
    sampleDecision(1, { pressure: 0.1, stability: 0.5 }),
    sampleDecision(2, { pressure: 0.05, stability: 0.6 }),
    sampleDecision(3, { pressure: 0.1, stability: 0.7 }),
  ];
  const cohortBDecisions = [
    sampleDecision(1, { pressure: 1, stability: 0 }),
    sampleDecision(2, { pressure: 1, stability: 0 }),
    sampleDecision(3, { pressure: 1, stability: 0 }),
    sampleDecision(4, { pressure: 0.6, stability: 0.2 }),
    sampleDecision(5, { pressure: 0.4, stability: 0.2 }),
  ];

  const cohortA = buildCohortSummary({
    decisions: cohortADecisions,
    request: { label: "A", timeframeLabel: "Test", normalizationBasis: "shared_timeframe" },
  });
  const cohortB = buildCohortSummary({
    decisions: cohortBDecisions,
    request: { label: "B", timeframeLabel: "Test", normalizationBasis: "shared_timeframe" },
  });

  const result = runCompare({
    mode: "velocity",
    normalizationBasis: "shared_timeframe",
    velocityTarget: "PRESSURE_STABILIZE",
    cohortA,
    cohortB,
    decisionsA: cohortADecisions,
    decisionsB: cohortBDecisions,
    windowSize: 3,
    consecutiveWindows: 1,
    thresholds: { pressureBand: 1 },
  });

  assert.ok(result.velocity.punchline.includes("stabilized"));
  assert.equal(result.velocity.a.targetReached, true);
});
