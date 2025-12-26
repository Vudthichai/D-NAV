import type { DecisionVarKey } from "../types";
import type { NudgeResult, NudgeSettings } from "./types";

const LABELS: Record<DecisionVarKey, string> = {
  impact: "Impact",
  cost: "Cost",
  risk: "Risk",
  urgency: "Urgency",
  confidence: "Confidence",
};

function formatStep(step: { key: DecisionVarKey; from: number; to: number }): string {
  return `${LABELS[step.key]} from ${step.from} → ${step.to}${step.key === "urgency" && step.to > step.from ? " (faster)" : ""}`;
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

export function buildNudgeCopy(result: NudgeResult, settings: NudgeSettings) {
  const stepLines = result.steps.map((step) => `• ${formatStep(step)}`);
  const effects = [
    `ΔD-NAV ${formatDelta(result.deltas.dnav)}`,
    `ΔReturn ${formatDelta(result.deltas.return)}`,
    `ΔPressure ${formatDelta(result.deltas.pressure)}`,
    `ΔStability ${formatDelta(result.deltas.stability)}`,
  ].join(" • ");

  const rationale =
    result.rationale.length > 0
      ? result.rationale.join(" ")
      : "Balances the goal against the selected constraints.";

  const caution =
    settings.policy.allowUrgencyIncrease && result.steps.some((step) => step.key === "urgency" && step.to > step.from)
      ? "Faster path, higher stress: this may increase execution load."
      : undefined;

  return {
    title: "Best feasible nudge",
    steps: stepLines,
    effects,
    rationale,
    caution,
  };
}
