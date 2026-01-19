export const TIMING_PRECISIONS = [
  "relative",
  "month",
  "unknown",
  "day",
  "quarter",
  "year",
] as const;

export type TimingPrecision = (typeof TIMING_PRECISIONS)[number];

export const normalizePrecision = (input?: string): TimingPrecision => {
  if (!input) return "unknown";
  return TIMING_PRECISIONS.includes(input as TimingPrecision) ? (input as TimingPrecision) : "unknown";
};
