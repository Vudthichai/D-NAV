import test from "node:test";
import assert from "node:assert/strict";

import { canonicalizeCandidate, dedupeCandidates, passesQualityGate } from "../lib/decisionExtractLocal";

const makeCandidate = (overrides: Partial<Parameters<typeof canonicalizeCandidate>[0]>) => ({
  id: "1",
  page: 1,
  sentence: "Tesla completed construction of Megafactory Shanghai and will ramp production this quarter.",
  window: "Tesla completed construction of Megafactory Shanghai and will ramp production this quarter.",
  actor: "Tesla",
  verb: "completed",
  verbPhrase: "completed",
  object: "Megafactory Shanghai",
  timeframe: "this quarter",
  quote: "Tesla completed construction of Megafactory Shanghai and will ramp production this quarter.",
  meta: {
    digitRatio: 0,
    isTableLike: false,
    isBoilerplate: false,
    hasNoiseKeywords: false,
    hasProductKeyword: true,
  },
  ...overrides,
});

test("dedupe merges sources and keeps strongest title", () => {
  const first = canonicalizeCandidate(
    makeCandidate({
      id: "1",
      verbPhrase: "plans",
      verb: "planned",
      timeframe: "in 2026",
      sentence: "Tesla planned Cybercab production lines at Gigafactory Texas in 2026.",
      window: "Tesla planned Cybercab production lines at Gigafactory Texas in 2026.",
      object: "Cybercab production lines at Gigafactory Texas",
      quote: "Tesla planned Cybercab production lines at Gigafactory Texas in 2026.",
    }),
  );
  const second = canonicalizeCandidate(
    makeCandidate({
      id: "2",
      verbPhrase: "plans",
      verb: "planned",
      timeframe: "in 2026",
      sentence: "Tesla planned Cybercab production lines at Gigafactory Texas in 2026 to support the ramp.",
      window: "Tesla planned Cybercab production lines at Gigafactory Texas in 2026 to support the ramp.",
      object: "Cybercab production lines at Gigafactory Texas",
      quote: "Tesla planned Cybercab production lines at Gigafactory Texas in 2026 to support the ramp.",
    }),
  );

  assert.ok(first);
  assert.ok(second);
  first.score = 6;
  second.score = 3;

  const deduped = dedupeCandidates([first, second]);
  assert.equal(deduped.length, 1);
  assert.ok(deduped[0].title.includes("Gigafactory Texas"));
  assert.equal(deduped[0].sources.length, 2);
});

test("quality gate rejects table-like KPI rows", () => {
  const candidate = canonicalizeCandidate(
    makeCandidate({
      sentence: "Revenue 2,122 2,893 3,201 3,450 3,890",
      window: "Revenue 2,122 2,893 3,201 3,450 3,890",
      quote: "Revenue 2,122 2,893 3,201 3,450 3,890",
      object: "Megafactory",
      meta: {
        digitRatio: 0.4,
        isTableLike: true,
        isBoilerplate: false,
        hasNoiseKeywords: false,
        hasProductKeyword: true,
      },
    }),
  );

  assert.ok(candidate);
  assert.equal(passesQualityGate(candidate), false);
});

test("canonicalization produces decision-shaped titles", () => {
  const candidate = canonicalizeCandidate(
    makeCandidate({
      sentence: "Tesla began construction of Megafactory Shanghai and will ramp in Q2 2025.",
      window: "Tesla began construction of Megafactory Shanghai and will ramp in Q2 2025.",
      verb: "began",
      verbPhrase: "began",
      object: "construction of Megafactory Shanghai",
      timeframe: "in Q2 2025",
      quote: "Tesla began construction of Megafactory Shanghai and will ramp in Q2 2025.",
    }),
  );

  assert.ok(candidate);
  assert.ok(candidate.title.startsWith("Tesla"));
  assert.ok(candidate.title.split(/\s+/).length >= 6);
});
