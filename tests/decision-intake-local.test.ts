import test from "node:test";
import assert from "node:assert/strict";

import { normalizePdfText } from "../lib/pdf/normalizePdfText";
import { extractDecisionCandidates, dedupeCandidates, type DecisionCandidate } from "../lib/intake/decisionExtractLocal";

test("normalizePdfText dehyphenates and strips repeated headers", () => {
  const normalized = normalizePdfText({
    docName: "sample.pdf",
    pageCount: 2,
    pages: [
      { page: 1, text: "Tesla Q4 Update\nMega-\nfactory ramp begins.\nPage 1" },
      { page: 2, text: "Tesla Q4 Update\nMegafactory ramp continues.\nPage 2" },
    ],
  });

  assert.equal(normalized.pages[0].text.includes("Tesla Q4 Update"), false);
  assert.equal(normalized.pages[1].text.includes("Tesla Q4 Update"), false);
  assert.ok(normalized.pages[0].text.includes("Megafactory ramp begins."));
});

test("extractDecisionCandidates filters boilerplate and table noise", () => {
  const result = extractDecisionCandidates({
    docName: "sample.pdf",
    pageCount: 1,
    pages: [
      {
        page: 1,
        text: [
          "This press release contains forward-looking statements that could cause actual results to differ materially.",
          "Revenue 2,122 2,893 3,201 3,450 3,890",
          "The new battery line is scheduled to start by end of 2025 and will ramp production in Q1 2026.",
        ].join("\n"),
      },
    ],
  });

  assert.equal(result.candidates.length, 1);
  assert.ok(result.candidates[0].decision.includes("scheduled"));
});

test("dedupeCandidates prefers hard decisions", () => {
  const base: DecisionCandidate = {
    id: "one",
    title: "Ramp Megafactory Shanghai production",
    decision: "Megafactory Shanghai will ramp production in Q3 2025.",
    strength: "hard",
    category: "Operations",
    evidence: { preview: "Megafactory Shanghai will ramp production in Q3 2025.", full: "", page: 2 },
    scores: { impact: 5, cost: 5, risk: 5, urgency: 5, confidence: 5 },
    meta: { score: 8, isBoilerplate: false, isTableLike: false },
  };
  const softDuplicate: DecisionCandidate = {
    ...base,
    id: "two",
    strength: "soft",
    decision: "Megafactory Shanghai plans to ramp production in Q3 2025.",
  };

  const deduped = dedupeCandidates([softDuplicate, base]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].strength, "hard");
});
