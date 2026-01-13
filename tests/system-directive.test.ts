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
    "This dataset is operating under low pressure with stable footing. Use the category results below to choose where to act: increase Impact (or reduce Cost) in the highest-return categories first, and avoid changes that reduce Stability.",
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
    "This dataset is under high pressure — reduce execution strain first (lower Cost / lower Urgency), then raise Impact selectively in the categories that already perform.",
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
    "This dataset’s stability is thin — protect stable footing first (lower Risk / lower Cost), then raise Impact selectively in the categories that can absorb it.",
  );
});
