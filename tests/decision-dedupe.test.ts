import test from "node:test";
import assert from "node:assert/strict";

import { __testables, type DecisionCandidate } from "../lib/intake/decisionExtractLocal";

const { dedupeCandidates } = __testables;

test("dedupes near-identical decision candidates", () => {
  const base: DecisionCandidate = {
    id: "one",
    title: "Begin production ramp in Q1 2025",
    decision: "Begin production ramp in Q1 2025 at the new plant.",
    strength: "hard",
    category: "Operations",
    score: 8,
    evidence: { page: 2, quote: "Begin production ramp in Q1 2025 at the new plant.", fullQuote: "Begin production ramp in Q1 2025 at the new plant." },
    sliders: { impact: 5, cost: 5, risk: 5, urgency: 5, confidence: 5 },
    tags: ["ramp"],
    meta: { isTableLike: false, isBoilerplate: false, isLowSignalSection: false, digitRatio: 0 },
  };
  const dupe: DecisionCandidate = {
    ...base,
    id: "two",
    score: 7,
    evidence: {
      page: 3,
      quote: "Begin production ramp in Q1 2025 at the new plant, management said.",
      fullQuote: "Begin production ramp in Q1 2025 at the new plant, management said.",
    },
  };

  const deduped = dedupeCandidates([base, dupe]);
  assert.equal(deduped.length, 1);
});
