import test from "node:test";
import assert from "node:assert/strict";

import { getSystemDirective } from "../lib/systemDirective";

test("getSystemDirective returns low-pressure stable directive", () => {
  const directive = getSystemDirective({
    avgReturn: 1.2,
    avgPressure: -1,
    avgStability: 1,
    returnNegativePct: 2,
    pressurePressuredPct: 5,
    stabilityFragilePct: 3,
  });

  assert.equal(
    directive,
    "You're stable and under low pressure — increase ambition selectively by raising Impact or reducing Cost where return is already strongest without destabilizing the operating base.",
  );
});

test("getSystemDirective emphasizes strain when pressure is high", () => {
  const directive = getSystemDirective({
    avgReturn: -0.2,
    avgPressure: 1.4,
    avgStability: 1.3,
    returnNegativePct: 22,
    pressurePressuredPct: 32,
    stabilityFragilePct: 5,
  });

  assert.equal(
    directive,
    "You're under high pressure — prioritize increasing Return by raising Impact or reducing Cost while reducing execution strain.",
  );
});

test("getSystemDirective protects footing when stability is thin", () => {
  const directive = getSystemDirective({
    avgReturn: 0.4,
    avgPressure: 0.1,
    avgStability: -1.2,
    returnNegativePct: 8,
    pressurePressuredPct: 10,
    stabilityFragilePct: 18,
  });

  assert.equal(
    directive,
    "Stability is thin — increase ambition selectively by raising Impact or reducing Cost where return is already strongest while keeping decisions on stable footing.",
  );
});
