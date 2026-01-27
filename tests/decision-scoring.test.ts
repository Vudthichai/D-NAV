import test from "node:test";
import assert from "node:assert/strict";

import { scoreDecisionSentence } from "../lib/intake/decisionScoring";

test("decision scoring rejects boilerplate disclaimers", () => {
  const result = scoreDecisionSentence(
    "This press release contains forward-looking statements that could cause actual results to differ materially.",
  );

  assert.equal(result.isBoilerplate, true);
  assert.ok(result.score < 0);
});

test("decision scoring rejects table-like rows", () => {
  const result = scoreDecisionSentence("CASH FLOWS (in millions of USD) 2024 2025 2026 2027 2028");

  assert.equal(result.isTableLike, true);
  assert.ok(result.score < 0);
});
