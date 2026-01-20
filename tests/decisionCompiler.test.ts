import test from "node:test";
import assert from "node:assert/strict";
import { compileDecisionObject } from "../lib/decisionCompiler";
import type { EvidenceAnchor } from "../components/stress-test/decision-intake-types";

const anchor = (excerpt: string): EvidenceAnchor => ({
  docId: "doc-1",
  fileName: "TSLA-Q4-2024-Update.pdf",
  page: 4,
  excerpt,
});

test("compiler fixes tokenization artifacts like 'launch ed'", () => {
  const decision = compileDecisionObject({
    text: "Company launch ed Robotaxi in parts of the U.S. later this year.",
    evidenceAnchors: [anchor("Company launch ed Robotaxi in parts of the U.S. later this year.")],
  });
  assert.ok(!decision.canonical_text.includes("launch ed"));
  assert.equal(decision.action, "launch");
});

test("compiler drops reporting statements", () => {
  const decision = compileDecisionObject({
    text: "Revenue increased 2% YoY in the quarter.",
    evidenceAnchors: [anchor("Revenue increased 2% YoY in the quarter.")],
  });
  assert.equal(decision.triage, "DROP");
  assert.equal(decision.triage_reason, "state/reporting, not commitment");
});

test("compiler flags missing action/object as MAYBE", () => {
  const decision = compileDecisionObject({
    text: "The company will begin.",
    evidenceAnchors: [anchor("The company will begin.")],
  });
  assert.equal(decision.triage, "MAYBE");
});

test("compiler normalizes quarter dates", () => {
  const decision = compileDecisionObject({
    text: "Tesla will begin ramping Megafactory Shanghai in Q1 2025.",
    evidenceAnchors: [anchor("Tesla will begin ramping Megafactory Shanghai in Q1 2025.")],
  });
  assert.equal(decision.constraint_time?.normalized?.type, "quarter");
  assert.equal(decision.constraint_time?.normalized?.year, 2025);
  assert.equal(decision.constraint_time?.normalized?.quarter, 1);
});

test("compiler normalizes numeric dates", () => {
  const decision = compileDecisionObject({
    text: "We plan to deploy by 4/25/26.",
    evidenceAnchors: [anchor("We plan to deploy by 4/25/26.")],
  });
  assert.equal(decision.constraint_time?.normalized?.type, "date");
  assert.equal(decision.constraint_time?.normalized?.value, "2026-04-25");
});

test("compiler normalizes fiscal years", () => {
  const decision = compileDecisionObject({
    text: "The company plans to expand capacity in FY2026.",
    evidenceAnchors: [anchor("The company plans to expand capacity in FY2026.")],
  });
  assert.equal(decision.constraint_time?.normalized?.type, "fiscalYear");
  assert.equal(decision.constraint_time?.normalized?.year, 2026);
});

test("compiler handles relative timing", () => {
  const decision = compileDecisionObject({
    text: "Tesla expects to launch Robotaxi later this year.",
    evidenceAnchors: [anchor("Tesla expects to launch Robotaxi later this year.")],
  });
  assert.equal(decision.constraint_time?.normalized?.type, "relative");
});

test("compiler detects plan modality", () => {
  const decision = compileDecisionObject({
    text: "The company plans to start production of new affordable models in 1H 2025.",
    evidenceAnchors: [anchor("The company plans to start production of new affordable models in 1H 2025.")],
  });
  assert.equal(decision.modality, "PLAN");
  assert.equal(decision.action, "start production");
});

test("compiler extracts location constraints", () => {
  const decision = compileDecisionObject({
    text: "Tesla expects to launch Robotaxi in parts of the U.S. later this year.",
    evidenceAnchors: [anchor("Tesla expects to launch Robotaxi in parts of the U.S. later this year.")],
  });
  assert.equal(decision.constraint_location, "parts of the U.S.");
});

test("compiler builds compact canonical text", () => {
  const decision = compileDecisionObject({
    text: "Tesla will begin ramping Megafactory Shanghai in Q1 2025.",
    evidenceAnchors: [anchor("Tesla will begin ramping Megafactory Shanghai in Q1 2025.")],
  });
  assert.ok(decision.canonical_text.length <= 160);
  assert.ok(decision.canonical_text.includes("Tesla"));
  assert.ok(decision.canonical_text.includes("ramp"));
});
