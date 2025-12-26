import test from "node:test";
import assert from "node:assert/strict";

import { buildDecision, computeMetrics } from "@/src/lib/dnav/compute";
import { compareDecisions } from "@/src/lib/dnav/compare";
import { findSmallestNudge } from "@/src/lib/dnav/sensitivity";
import { type DecisionVars } from "@/src/lib/dnav/types";

test("computeMetrics keeps existing scoring model", () => {
  const vars: DecisionVars = { impact: 6, cost: 3, risk: 2, urgency: 4, confidence: 5 };
  const metrics = computeMetrics(vars);

  assert.equal(metrics.return, 3);
  assert.equal(metrics.stability, 3);
  assert.equal(metrics.pressure, -1);
  assert.equal(metrics.energy, 20);
  assert.equal(metrics.dnav, 21);
});

test("compareDecisions reports metric and variable deltas", () => {
  const baseline = buildDecision({
    id: "base",
    label: "Baseline",
    vars: { impact: 5, cost: 4, risk: 3, urgency: 4, confidence: 4 },
  });
  const candidate = buildDecision({
    id: "candidate",
    label: "Candidate",
    vars: { impact: 7, cost: 4, risk: 2, urgency: 6, confidence: 5 },
  });

  const result = compareDecisions(baseline, candidate);

  assert.equal(result.delta.dnav, 17);
  assert.equal(result.delta.return, 2);
  assert.equal(result.delta.pressure, 1);
  assert.equal(result.delta.stability, 2);
  assert.equal(result.delta.vars.impact, 2);
  assert.equal(result.delta.vars.risk, -1);
  assert.equal(result.delta.vars.urgency, 2);
  assert.equal(result.delta.vars.confidence, 1);

  const driverKeys = result.drivers.top.map((driver) => driver.key);
  assert.ok(driverKeys.includes("urgency"));
  assert.ok(driverKeys.includes("confidence"));
});

test("findSmallestNudge suggests a single-step improvement", () => {
  const vars: DecisionVars = { impact: 5, cost: 6, risk: 4, urgency: 3, confidence: 3 };
  const suggestion = findSmallestNudge(vars, "return", 1);

  assert.ok(suggestion);
  assert.equal(suggestion?.target, "return");
  assert.equal(suggestion?.direction, "increase");
  assert.equal(suggestion?.by, 1);
  assert.ok(suggestion?.recommendedChange.key === "impact" || suggestion?.recommendedChange.key === "cost");
  assert.ok(suggestion!.recommendedChange.delta !== 0);
});
