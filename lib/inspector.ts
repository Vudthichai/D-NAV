import type { DecisionEntry } from "@/lib/calculations";

type NullableNumber = number | null;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" ? (value as UnknownRecord) : {};
}

export function toNumberOrNull(value: unknown): NullableNumber {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getRegimeLabel(r: NullableNumber, p: NullableNumber, s: NullableNumber): string {
  if (r === null || p === null || s === null) return "Unscored";
  if (r >= 2 && s >= 2 && p >= -2) return "Efficient Upside";
  if (p <= -4) return "Pressure Risk";
  if (s <= 0 && p <= -2) return "Fragility";
  if (Math.abs(r) <= 1) return "Low Signal";
  return "Mixed";
}

export function getWhySentence(r: NullableNumber, p: NullableNumber, s: NullableNumber): string {
  const regime = getRegimeLabel(r, p, s);
  switch (regime) {
    case "Efficient Upside":
      return "Return and Stability lead with manageable pressure, landing in Efficient Upside.";
    case "Pressure Risk":
      return "High pressure outweighs return and stability, pushing this into Pressure Risk.";
    case "Fragility":
      return "Stability is soft while pressure builds, so this reads as Fragility.";
    case "Low Signal":
      return "Low return signal dominates, so this falls into Low Signal.";
    case "Mixed":
      return "Signals are mixed, so this decision lands in Mixed.";
    default:
      return "This decision is missing one or more inputs.";
  }
}

export function normalizeDecisionMetrics(raw: unknown): {
  return: NullableNumber;
  pressure: NullableNumber;
  stability: NullableNumber;
  dnav: NullableNumber;
} {
  const record = asRecord(raw);

  const ret = record["return"] ?? record["Return"] ?? record["R"];
  const pres = record["pressure"] ?? record["Pressure"] ?? record["P"];
  const stab = record["stability"] ?? record["Stability"] ?? record["S"];
  const dn =
    record["dnav"] ??
    record["dNav"] ??
    record["D-NAV"] ??
    record["DNAV"] ??
    record["D_NAV"] ??
    record["D"];

  return {
    return: toNumberOrNull(ret),
    pressure: toNumberOrNull(pres),
    stability: toNumberOrNull(stab),
    dnav: toNumberOrNull(dn),
  };
}

export function normalizeDecisionEntry(decision: DecisionEntry | null): {
  returnValue: NullableNumber;
  pressureValue: NullableNumber;
  stabilityValue: NullableNumber;
  dnavValue: NullableNumber;
} {
  if (!decision) {
    return {
      returnValue: null,
      pressureValue: null,
      stabilityValue: null,
      dnavValue: null,
    };
  }

  return {
    returnValue: toNumberOrNull(decision.return),
    pressureValue: toNumberOrNull(decision.pressure),
    stabilityValue: toNumberOrNull(decision.stability),
    dnavValue: toNumberOrNull(decision.dnav),
  };
}
