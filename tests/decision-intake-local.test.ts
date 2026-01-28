import test from "node:test";
import assert from "node:assert/strict";

import { normalizePdfText } from "../lib/pdf/normalizePdfText";
import { extractDecisionCandidatesLocal } from "../lib/intake/decisionExtractLocal";


test("normalizePdfText dehyphenates and joins wrapped lines", () => {
  const input = "We are manu-\nfacturing\nexpansion plans\nthat remain on track.";
  const output = normalizePdfText(input);
  assert.equal(output, "We are manufacturing expansion plans that remain on track.");
});

test("decision scoring rejects table-like lines", () => {
  const result = extractDecisionCandidatesLocal(
    [
      {
        page: 1,
        text: "CASH FLOWS (in millions of USD) 2024 2025 2026 2027 2028",
      },
    ],
    { minScore: 4 },
  );

  assert.equal(result.candidates.length, 0);
});

test("decision scoring rejects forward-looking boilerplate", () => {
  const result = extractDecisionCandidatesLocal(
    [
      {
        page: 1,
        text: "This press release contains forward-looking statements that could cause actual results to differ materially.",
      },
    ],
    { minScore: 4 },
  );

  assert.equal(result.candidates.length, 0);
});

test("dedupes near-duplicate decisions", () => {
  const result = extractDecisionCandidatesLocal(
    [
      {
        page: 1,
        text: "The Berlin factory will ramp production in Q2 2025 and begin full output by year-end.",
      },
      {
        page: 2,
        text: "Berlin factory will ramp production in Q2 2025 and begin full output by year-end, management said.",
      },
    ],
    { minScore: 3 },
  );

  assert.equal(result.candidates.length, 1);
});
