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

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function buildPrimaryClause(goal: NudgeSettings["goal"], deltas: NudgeResult["deltas"]) {
  switch (goal) {
    case "increase-return":
      return deltas.return > 0 ? "Raises projected return" : "Protects the return profile";
    case "reduce-pressure":
      return deltas.pressure < 0 ? "Reduces execution pressure" : "Keeps execution pressure in check";
    case "increase-stability":
      return deltas.stability > 0 ? "Improves survivability by reinforcing stability" : "Keeps resilience intact while adjusting the mix";
    case "increase-dnav":
    default:
      return deltas.dnav > 0 ? "Strengthens overall D-NAV position" : "Keeps the D-NAV path aligned while adjusting the mix";
  }
}

function buildAcknowledgment(settings: NudgeSettings, deltas: NudgeResult["deltas"]) {
  const segments: Array<{ lead: string; support: string }> = [];
  const pressureGuard = settings.constraints.preventPressureIncrease || deltas.pressure < 0;
  const returnGuard = settings.constraints.preventReturnDecrease || Math.abs(deltas.return) < 0.05;
  const stabilityGuard = settings.constraints.preventStabilityDecrease;
  const dnavGuard = typeof settings.constraints.minDnav === "number";

  if (pressureGuard) {
    const lead = deltas.pressure < 0 ? "Reduces execution stress" : "Avoids extra pressure";
    const support = deltas.pressure < 0 ? "reducing execution stress" : "avoiding extra pressure";
    segments.push({ lead, support });
  }
  if (returnGuard) {
    const lead = deltas.return >= 0 ? "Preserves upside" : "Preserves return";
    const support = deltas.return >= 0 ? "preserving upside" : "preserving return";
    segments.push({ lead, support });
  }
  if (stabilityGuard) {
    segments.push({ lead: "Keeps resilience intact", support: "keeping resilience intact" });
  }
  if (dnavGuard) {
    const value = formatNumber(settings.constraints.minDnav as number);
    segments.push({ lead: `Keeps D-NAV ≥ ${value}`, support: `keeping D-NAV ≥ ${value}` });
  }

  if (!segments.length) {
    return "respects the selected guardrails";
  }

  const [first, ...rest] = segments;
  const firstClause = first.lead.charAt(0).toLowerCase() + first.lead.slice(1);

  if (!rest.length) {
    return firstClause;
  }

  const supports = rest.map((segment) => segment.support);
  const combinedSupports = [supports[0], ...supports.slice(1)];

  if (combinedSupports.length === 1) {
    return `${firstClause} while ${combinedSupports[0]}`;
  }

  if (combinedSupports.length === 2) {
    return `${firstClause} while ${combinedSupports[0]} and ${combinedSupports[1]}`;
  }

  const head = combinedSupports.slice(0, -1).join(", ");
  const last = combinedSupports[combinedSupports.length - 1];

  return `${firstClause} while ${head}, and ${last}`;
}

export function buildNudgeCopy(result: NudgeResult, settings: NudgeSettings) {
  const stepLines = result.steps.map((step) => `• ${formatStep(step)}`);
  const effects = [
    `ΔD-NAV ${formatDelta(result.deltas.dnav)}`,
    `ΔReturn ${formatDelta(result.deltas.return)}`,
    `ΔPressure ${formatDelta(result.deltas.pressure)}`,
    `ΔStability ${formatDelta(result.deltas.stability)}`,
  ].join(" • ");

  const primaryClause = buildPrimaryClause(settings.goal, result.deltas);
  const ackClause = buildAcknowledgment(settings, result.deltas);
  const rationale = `${primaryClause}; ${ackClause}.`;

  const caution =
    settings.policy.allowUrgencyIncrease && result.steps.some((step) => step.key === "urgency" && step.to > step.from)
      ? "Note: urgency-up can increase stress in real execution."
      : undefined;

  return {
    title: "Best feasible nudge",
    steps: stepLines,
    effects,
    rationale,
    caution,
  };
}
