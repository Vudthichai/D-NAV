import test from "node:test";
import assert from "node:assert/strict";

import { classifyRegime, computePostureSummary } from "../lib/judgment/posture";
import type { CohortSummary } from "../lib/compare/types";

const baseCohort: CohortSummary = {
  label: "Test",
  timeframeLabel: "Now",
  normalizationBasis: "shared_timeframe",
  totalDecisions: 10,
  avgReturn: 0.6,
  avgPressure: -0.2,
  avgStability: 1.5,
  avgDnav: 0,
  stdReturn: 0.2,
  stdPressure: 0.1,
  stdStability: 0.1,
  avgImpact: 0,
  avgCost: 0,
  avgRisk: 0,
  avgUrgency: 0,
  avgConfidence: 0,
};

test("classifyRegime flags exploitative posture", () => {
  const result = classifyRegime({
    mean: { R: baseCohort.avgReturn, P: baseCohort.avgPressure, S: baseCohort.avgStability },
    std: { R: baseCohort.stdReturn, P: baseCohort.stdPressure, S: baseCohort.stdStability },
    geometry: { distanceToAttractor: 0.5, varianceMagnitude: 0.3 },
    trends: {
      slopes: { R: 0, P: 0, S: 0 },
      slopeDirections: { R: 0, P: 0, S: 0 },
      varianceTrend: 0,
      pressureLag: false,
    },
  });

  assert.equal(result.regime, "Exploitative");
});

test("computePostureSummary builds geometry and regime", () => {
  const posture = computePostureSummary(baseCohort);
  assert.ok(posture.geometry.distanceToAttractor > 0);
  assert.ok(["Exploitative", "Exploratory", "Stressed", "Asymmetric"].includes(posture.regime.regime));
});
