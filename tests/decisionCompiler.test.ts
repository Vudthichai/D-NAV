import test from "node:test";
import assert from "node:assert/strict";

import { buildCanonicalDecisions, cleanText, gateCandidates } from "../lib/decisionCompiler";
import type { RawCandidate } from "../components/stress-test/decision-intake-types";

const buildRawCandidate = (rawText: string, contextText?: string): RawCandidate => ({
  id: "doc-1-p1-u1",
  docId: "doc-1",
  page: 1,
  rawText,
  contextText,
  sectionHint: undefined,
  knowsItIsTableNoise: false,
  extractionScore: 0.8,
  dateMentions: [],
  evidence: [
    {
      docId: "doc-1",
      fileName: "Test.pdf",
      page: 1,
      excerpt: rawText,
      contextText,
    },
  ],
});

test("cleanText merges broken suffixes", () => {
  assert.equal(cleanText("deploy ments"), "deployments");
});

test("canonical titles include units when available", () => {
  const raw = buildRawCandidate(
    "Tesla plans to deploy 11 storage units in 2025.",
    "Tesla plans to deploy 11 storage units totaling 11.0 GWh in 2025.",
  );
  const { canonicals } = buildCanonicalDecisions([raw]);
  assert.ok(canonicals[0].title.includes("11.0 GWh"));
});

test("metric-only reporting statements are rejected", () => {
  const raw = buildRawCandidate("Revenue increased 2% YoY.");
  const { reject } = gateCandidates([raw]);
  assert.equal(reject[0].gate.bin, "Rejected");
});
