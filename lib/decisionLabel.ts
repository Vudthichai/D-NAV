import type { DecisionEntry } from "@/lib/calculations";

function getOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveDecisionLabel(decision: DecisionEntry): string {
  const candidates = [
    decision.regimeLabel,
    decision.regime,
    decision.policyLabel,
    decision.policy,
    decision.vehicleSegment,
    decision.archetype,
    decision.label,
  ];

  for (const candidate of candidates) {
    const resolved = getOptionalString(candidate);
    if (resolved) return resolved;
  }

  return "Unlabeled";
}
