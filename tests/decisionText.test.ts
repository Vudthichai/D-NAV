import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanExcerpt,
  dedupeKey,
  extractTiming,
  isDecisionCandidate,
  toDecisionStatement,
  toDecisionTitle,
} from "../lib/decisionText";

test("cleanExcerpt strips footnotes and collapses whitespace", () => {
  const cleaned = cleanExcerpt("We will expand [1] in Q1 2026.  ");
  assert.equal(cleaned, "We will expand in Q1 2026.");
});

test("extractTiming finds quarters and normalizes precision", () => {
  const timing = extractTiming("We will launch in Q1 2026.");
  assert.equal(timing.text, "Q1 2026");
  assert.equal(timing.normalized.precision, "quarter");
});

test("toDecisionStatement normalizes commitments with actor and timing", () => {
  const statement = toDecisionStatement("Tesla will expand capacity in Nevada by Q2 2025.");
  assert.equal(statement, "Tesla will expand capacity in Nevada by Q2 2025.");
});

test("toDecisionTitle creates a short readable title", () => {
  const title = toDecisionTitle("The company plans to increase vehicle prices in 2026.");
  assert.equal(title, "Increase vehicle prices by 2026");
});

test("isDecisionCandidate rejects backward-looking descriptions", () => {
  assert.equal(isDecisionCandidate("Revenue increased 12% year over year."), false);
});

test("isDecisionCandidate accepts commitments that reduce optionality", () => {
  assert.equal(isDecisionCandidate("We plan to hire 300 engineers by Q3 2025."), true);
});

test("dedupeKey normalizes near-duplicate titles", () => {
  const keyA = dedupeKey("Expand capacity in Nevada", "Company will expand capacity in Nevada.");
  const keyB = dedupeKey("Expand capacity in Nevada", "Tesla will expand capacity in Nevada.");
  assert.equal(keyA, keyB);
});
