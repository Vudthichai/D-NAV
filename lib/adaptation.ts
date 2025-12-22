// Consistency thresholds (std dev) for D-NAV/Return dispersion.
export const CONSISTENCY_STD_THRESHOLDS = {
  tight: 4.0,
  moderate: 7.0,
};

// Minimum positive-return share shift (pp) to call the signal stronger/weaker.
export const SIGNAL_DELTA_THRESHOLD = 3.0;

export type ConsistencyLabel = "Tight" | "Moderate" | "Volatile" | "—";

export function classifyConsistency(stdValue: number | null): ConsistencyLabel {
  if (stdValue === null || !Number.isFinite(stdValue)) return "—";
  if (stdValue <= CONSISTENCY_STD_THRESHOLDS.tight) return "Tight";
  if (stdValue <= CONSISTENCY_STD_THRESHOLDS.moderate) return "Moderate";
  return "Volatile";
}

export function stddev(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function safeMinMax(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: Number.NaN, max: Number.NaN };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function formatPP(delta: number, digits = 1): string {
  if (!Number.isFinite(delta)) return "—";
  const formatted = Math.abs(delta).toFixed(digits);
  if (delta > 0) return `+${formatted}pp`;
  if (delta < 0) return `−${formatted}pp`;
  return `${formatted}pp`;
}

export function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}
