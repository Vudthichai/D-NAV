import { DECISION_VAR_KEYS, clampVars, type DecisionVars } from "./types";

export function serializeVars(vars: DecisionVars): string {
  const normalized = clampVars(vars);
  return DECISION_VAR_KEYS.map((key) => `${key}=${normalized[key]}`).join(",");
}

export function parseVars(raw: string | null | undefined): DecisionVars | null {
  if (!raw) return null;

  const result: Partial<DecisionVars> = {};
  const pieces = raw.split(",");

  for (const piece of pieces) {
    const [left, right] = piece.split("=");
    if (!left || right === undefined) return null;
    const key = left.trim();
    if (!DECISION_VAR_KEYS.includes(key as (typeof DECISION_VAR_KEYS)[number])) return null;

    const value = Number.parseFloat(right);
    if (!Number.isFinite(value)) return null;

    (result as Record<string, number>)[key] = value;
  }

  for (const key of DECISION_VAR_KEYS) {
    if (result[key] === undefined) return null;
  }

  return clampVars(result as DecisionVars);
}
