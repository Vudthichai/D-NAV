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

  assert.deepEqual(directive, [
    "This decision system is operating with stable footing and low overall pressure, favoring repeatable execution over high-variance bets.",
    "The one thing we must protect right now is Stability — improve results by increasing Impact selectively, without adding stress that weakens the base.",
    "Most upside will come from concentration, not acceleration.",
  ]);
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

  assert.deepEqual(directive, [
    "This decision system is operating with stable footing and low overall pressure, favoring repeatable execution over high-variance bets.",
    "The one thing we must protect right now is Stability — improve results by increasing Impact selectively, without adding stress that weakens the base.",
    "Most upside will come from concentration, not acceleration.",
  ]);
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

  assert.deepEqual(directive, [
    "This decision system is operating with stable footing and low overall pressure, favoring repeatable execution over high-variance bets.",
    "The one thing we must protect right now is Stability — improve results by increasing Impact selectively, without adding stress that weakens the base.",
    "Most upside will come from concentration, not acceleration.",
  ]);
});
