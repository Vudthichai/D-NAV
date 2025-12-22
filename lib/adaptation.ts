// Conservative defaults: keep labels stable unless dispersion is meaningfully wide.
export const CONSISTENCY_STD_THRESHOLDS = {
  tight: 3,
  moderate: 6,
};

// Minimum positive-return share shift (pp) to call the signal stronger/weaker.
export const SIGNAL_DELTA_THRESHOLD = 2;

export type ConsistencyLabel = "Tight" | "Moderate" | "Volatile" | "—";

export function classifyConsistency(stdValue: number | null): ConsistencyLabel {
  if (stdValue === null || !Number.isFinite(stdValue)) return "—";
  if (stdValue <= CONSISTENCY_STD_THRESHOLDS.tight) return "Tight";
  if (stdValue <= CONSISTENCY_STD_THRESHOLDS.moderate) return "Moderate";
  return "Volatile";
}
