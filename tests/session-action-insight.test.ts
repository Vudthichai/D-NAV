import test from "node:test";
import assert from "node:assert/strict";

import { getSessionActionInsight } from "../lib/sessionActionInsight";

test("getSessionActionInsight returns balanced action line", () => {
  const insight = getSessionActionInsight({
    avgReturn: 0.6,
    avgPressure: 0.1,
    avgStability: -0.05,
    avgRisk: 4,
    avgConfidence: 5,
  });

  assert.equal(
    insight,
    "Signals are aligned. Maintain current commitment speed and monitor for pressure drift.",
  );
});

test("getSessionActionInsight returns acceleration risk action line", () => {
  const insight = getSessionActionInsight({
    avgReturn: 0.2,
    avgPressure: -0.6,
    avgStability: 0,
    avgRisk: 7,
    avgConfidence: 5,
  });

  assert.equal(
    insight,
    "Reduce commitment speed until confidence matches the risk being taken.",
  );
});

test("getSessionActionInsight returns over-caution action line", () => {
  const insight = getSessionActionInsight({
    avgReturn: 0,
    avgPressure: 0.2,
    avgStability: 0.6,
    avgRisk: 4,
    avgConfidence: 6,
  });

  assert.equal(
    insight,
    "Caution is suppressing return. Increase exposure selectively where conviction is strongest.",
  );
});

test("getSessionActionInsight returns pressure-distorted action line", () => {
  const insight = getSessionActionInsight({
    avgReturn: -0.4,
    avgPressure: -2.1,
    avgStability: -0.2,
    avgRisk: 6,
    avgConfidence: 5,
  });

  assert.equal(
    insight,
    "Pressure is driving decisions. Pause irreversible commitments until stability recovers.",
  );
});
