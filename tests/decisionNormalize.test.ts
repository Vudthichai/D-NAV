import test from "node:test";
import assert from "node:assert/strict";

import { normalizeDecisionCandidate, normalizeDecisionCandidates } from "../lib/decisionNormalize";

const baseSource = {
  fileName: "Test.pdf",
  pageNumber: 3,
  excerpt: "Launch new pricing tiers in Q3 2025; expand enterprise packages.",
};

test("normalizeDecisionCandidate adds a subject and keeps title concise", () => {
  const candidate = normalizeDecisionCandidate({
    id: "a",
    text: "Launch new pricing tiers in Q3 2025; expand enterprise packages.",
    source: baseSource,
  });

  assert.ok(candidate);
  assert.ok(candidate.title.startsWith("Company will"));
  assert.ok((candidate.detail ?? "").length <= 280);
});

test("normalizeDecisionCandidates flags duplicates with shared overlap", () => {
  const normalized = normalizeDecisionCandidates([
    {
      id: "a",
      text: "Company will launch new pricing tiers in Q3 2025 for enterprise.",
      source: baseSource,
    },
    {
      id: "b",
      text: "Company will launch new pricing tiers in Q3 2025 for enterprise customers.",
      source: { ...baseSource, excerpt: "Company will launch new pricing tiers in Q3 2025 for enterprise customers." },
    },
  ]);

  const duplicates = normalized.filter((item) => item.flags.duplicateOf);
  assert.equal(duplicates.length, 1);
});

test("normalizeDecisionCandidate flags table-like numeric rows", () => {
  const candidate = normalizeDecisionCandidate({
    id: "table",
    text: "Revenue 2023 2024 2025 12 34 56 78 90",
    source: { ...baseSource, excerpt: "Revenue 2023 2024 2025 12 34 56 78 90" },
  });

  assert.ok(candidate);
  assert.equal(candidate.flags.likelyTableNoise, true);
});
