import assert from "node:assert/strict";
import test from "node:test";

import { compareDecisions } from "../src/lib/dnav/compare";
import { computeMetrics } from "../src/lib/dnav/compute";
import { parseVars, serializeVars } from "../src/lib/dnav/serialize";
import {
  DEFAULT_DECISION_VARS,
  type Decision,
  type DecisionVars,
} from "../src/lib/dnav/types";

test("serializeVars and parseVars round-trip values", () => {
  const vars: DecisionVars = { impact: 7, cost: 2, risk: 3, urgency: 6, confidence: 8 };
  const serialized = serializeVars(vars);
  assert.equal(serialized, "impact=7,cost=2,risk=3,urgency=6,confidence=8");

  const parsed = parseVars(serialized);
  assert.deepEqual(parsed, vars);
});

test("parseVars enforces completeness and numeric values", () => {
  assert.equal(parseVars("impact=2,cost=2,risk=2,urgency=2,confidence=bad"), null);
  assert.equal(parseVars("impact=2,cost=2,risk=2,urgency=2"), null);

  const clamped = parseVars("impact=15,cost=0,risk=2,urgency=2,confidence=2");
  assert.deepEqual(clamped, { impact: 10, cost: 1, risk: 2, urgency: 2, confidence: 2 });
});

test("computeMetrics derives return, stability, pressure, and D-NAV", () => {
  const metrics = computeMetrics({ impact: 8, cost: 2, risk: 3, urgency: 4, confidence: 6 });
  assert.equal(metrics.return, 6);
  assert.equal(metrics.stability, 3);
  assert.equal(metrics.pressure, -2);
  assert.equal(metrics.merit, 3);
  assert.equal(metrics.energy, 24);
  assert.equal(metrics.dnav, 27);
});

test("compareDecisions reports deltas, drivers, and nudge suggestions", () => {
  const baseline: Decision = {
    label: "Decision A",
    source: "manual",
    vars: DEFAULT_DECISION_VARS,
    metrics: computeMetrics(DEFAULT_DECISION_VARS),
  };

  const candidateVars: DecisionVars = { impact: 9, cost: 3, risk: 4, urgency: 7, confidence: 8 };
  const candidate: Decision = {
    label: "Decision B",
    source: "manual",
    vars: candidateVars,
    metrics: computeMetrics(candidateVars),
  };

  const result = compareDecisions(baseline, candidate);
  const dnavDelta = result.deltas.find((delta) => delta.metric === "dnav");
  assert.ok(dnavDelta);
  assert.equal(dnavDelta?.delta, candidate.metrics.dnav - baseline.metrics.dnav);

  assert.ok(result.drivers.length > 0);
  assert.equal(result.drivers[0].key, "impact");
});
