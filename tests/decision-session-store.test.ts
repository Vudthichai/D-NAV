import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSessionDecisionFromCandidate,
  updateDecisionInState,
  type DecisionSessionState,
} from "../lib/intake/decisionSessionStore";

const baseCandidate = {
  id: "local-1-abc",
  title: "Decision candidate",
  decision: "We will launch the new product line by Q3 2025.",
  decisionType: "commitment" as const,
  category: "Product" as const,
  strength: "committed" as const,
  evidence: { page: 1, quote: "We will launch the new product line by Q3 2025." },
  score: 8,
  sliders: {
    impact: 5,
    cost: 5,
    risk: 5,
    urgency: 5,
    confidence: 5,
  },
  flags: { isTableLike: false, isBoilerplate: false },
};

test("updates session metrics when extracted decision sliders change", () => {
  const initialSession = buildSessionDecisionFromCandidate(baseCandidate, "example.pdf", 123);
  const state: DecisionSessionState = {
    extractedDecisions: [baseCandidate],
    sessionDecisions: [initialSession],
  };

  const updated = updateDecisionInState(state, baseCandidate.id, { sliders: { impact: 9 } });
  const updatedSession = updated.sessionDecisions[0];

  assert.equal(updatedSession.impact, 9);
  assert.notEqual(updatedSession.r, initialSession.r);
  assert.notEqual(updatedSession.dnav, initialSession.dnav);
});

test("edits before adding carry into session metrics", () => {
  const state: DecisionSessionState = {
    extractedDecisions: [baseCandidate],
    sessionDecisions: [],
  };

  const updated = updateDecisionInState(state, baseCandidate.id, { sliders: { impact: 9 } });
  const updatedCandidate = updated.extractedDecisions[0];
  const sessionDecision = buildSessionDecisionFromCandidate(updatedCandidate, "example.pdf", 123);

  assert.equal(sessionDecision.impact, 9);
  assert.ok(sessionDecision.dnav > 0);
});
