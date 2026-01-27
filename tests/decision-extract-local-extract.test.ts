import test from "node:test";
import assert from "node:assert/strict";

import { localExtractDecisionCandidates } from "../lib/decisionExtract/localExtract";

test("rejects forward-looking disclaimer boilerplate", () => {
  const candidates = localExtractDecisionCandidates(
    [
      {
        page: 1,
        text: "This press release contains forward-looking statements that could cause actual results to differ materially.",
      },
    ],
    { minScore: 3 },
  );

  assert.equal(candidates.length, 0);
});

test("rejects cash flow table-like line", () => {
  const candidates = localExtractDecisionCandidates(
    [
      {
        page: 2,
        text: "CASH FLOWS (in millions of USD) 2024 2025 2026 2027 2028",
      },
    ],
    { minScore: 3 },
  );

  assert.equal(candidates.length, 0);
});

test("keeps scheduled line with time anchor", () => {
  const candidates = localExtractDecisionCandidates(
    [
      {
        page: 3,
        text: "The new battery line is scheduled to start by end of 2025 and will ramp production in Q1 2026.",
      },
    ],
    { minScore: 3 },
  );

  assert.equal(candidates.length, 1);
  assert.ok(candidates[0].decision.includes("scheduled"));
});

test("dedupes near-duplicate megafactory lines", () => {
  const candidates = localExtractDecisionCandidates(
    [
      {
        page: 4,
        text: "Megafactory Shanghai completed construction and will ramp production this quarter.",
      },
      {
        page: 5,
        text: "Megafactory Shanghai completed construction and will ramp production this quarter, according to management.",
      },
    ],
    { minScore: 3 },
  );

  assert.equal(candidates.length, 1);
});
