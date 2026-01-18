export const PERMITTED_PRECISIONS = [
  "relative",
  "month",
  "unknown",
  "day",
  "quarter",
  "year",
] as const;

export type TimingPrecision = (typeof PERMITTED_PRECISIONS)[number];

export const normalizePrecision = (value: unknown): TimingPrecision => {
  if (typeof value !== "string") return "unknown";
  return PERMITTED_PRECISIONS.includes(value as TimingPrecision) ? (value as TimingPrecision) : "unknown";
};
