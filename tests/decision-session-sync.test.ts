import test from "node:test";
import assert from "node:assert/strict";

import type { DecisionCandidate } from "../lib/intake/decisionExtractLocal";
import {
  buildSessionDecisionFromCandidate,
  syncSessionDecisionsFromCandidate,
} from "../lib/intake/decisionSessionSync";

const buildCandidate = (overrides: Partial<DecisionCandidate> = {}): DecisionCandidate => ({
  id: "cand-1",
  title: "Launch new line",
  decision: "Launch new product line by Q2 2025.",
  category: "Strategy",
  statementType: "decision",
  strength: "committed",
  evidence: {
    page: 3,
    quote: "Launch new product line by Q2 2025.",
    full: "Launch new product line by Q2 2025.",
  },
  score: 10,
  sliders: {
    impact: 5,
    cost: 4,
    risk: 3,
    urgency: 6,
    confidence: 7,
  },
  flags: {
    isTableLike: false,
    isBoilerplate: false,
  },
  ...overrides,
});

test("updating impact changes RPS and D-NAV", () => {
  const candidate = buildCandidate();
  const original = buildSessionDecisionFromCandidate(candidate);
  const updatedCandidate = buildCandidate({
    sliders: { ...candidate.sliders, impact: 9 },
  });
  const updated = buildSessionDecisionFromCandidate(updatedCandidate, undefined, original);

  assert.notEqual(updated.r, original.r);
  assert.notEqual(updated.dnav, original.dnav);
});

test("updating confidence changes RPS and D-NAV", () => {
  const candidate = buildCandidate();
  const original = buildSessionDecisionFromCandidate(candidate);
  const updatedCandidate = buildCandidate({
    sliders: { ...candidate.sliders, confidence: 2 },
  });
  const updated = buildSessionDecisionFromCandidate(updatedCandidate, undefined, original);

  assert.notEqual(updated.p, original.p);
  assert.notEqual(updated.dnav, original.dnav);
});

test("candidate edits propagate to linked session decisions", () => {
  const candidate = buildCandidate();
  const sessionDecision = buildSessionDecisionFromCandidate(candidate);
  const updatedCandidate = buildCandidate({
    sliders: { ...candidate.sliders, risk: 9 },
  });

  const synced = syncSessionDecisionsFromCandidate([sessionDecision], updatedCandidate);

  assert.equal(synced.length, 1);
  assert.equal(synced[0].risk, 9);
  assert.notEqual(synced[0].s, sessionDecision.s);
});
