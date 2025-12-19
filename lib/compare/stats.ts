export function mean(values: number[]): number {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function std(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function rollingMean(values: number[], window: number): number[] {
  if (!values.length || window <= 1) return values.slice();
  return values.map((_, idx) => {
    const slice = values.slice(Math.max(0, idx - window + 1), idx + 1);
    return mean(slice);
  });
}

export function rollingStd(values: number[], window: number): number[] {
  if (!values.length || window <= 1) return values.map(() => 0);
  return values.map((_, idx) => {
    const slice = values.slice(Math.max(0, idx - window + 1), idx + 1);
    return std(slice);
  });
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function clampRange(
  range: { start: number | null; end: number | null },
  limits?: { min?: number; max?: number },
): { start: number | null; end: number | null } {
  const min = limits?.min ?? Number.NEGATIVE_INFINITY;
  const max = limits?.max ?? Number.POSITIVE_INFINITY;
  const start = range.start !== null ? Math.max(min, Math.min(max, range.start)) : null;
  const end = range.end !== null ? Math.max(min, Math.min(max, range.end)) : null;
  return { start, end };
}

export function validateRange(range: { start: number | null; end: number | null }) {
  if (range.start && range.end && range.start > range.end) {
    return { ...range, start: range.end, end: range.start, warning: "Start date was after end date; swapped for validity." } as const;
  }
  return { ...range, warning: null as string | null } as const;
}

export function correlation(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  const meanA = mean(a);
  const meanB = mean(b);
  const numerator = a.reduce((sum, value, idx) => sum + (value - meanA) * (b[idx] - meanB), 0);
  const denomA = Math.sqrt(a.reduce((sum, value) => sum + (value - meanA) ** 2, 0));
  const denomB = Math.sqrt(b.reduce((sum, value) => sum + (value - meanB) ** 2, 0));
  const denominator = denomA * denomB || 1;
  return numerator / denominator;
}

export function describeVolatility(stdValue: number): "Steady" | "Mixed" | "Chaotic" {
  if (stdValue < 0.75) return "Steady";
  if (stdValue < 1.5) return "Mixed";
  return "Chaotic";
}

export const DISTRIBUTION_EPSILON = 0.25;

export type DistributionBuckets = {
  negative: number;
  neutral: number;
  positive: number;
  total: number;
  pctNegative: number;
  pctNeutral: number;
  pctPositive: number;
};

export function distributionBuckets(values: number[], epsilon: number = DISTRIBUTION_EPSILON): DistributionBuckets {
  if (!values.length) {
    return {
      negative: 0,
      neutral: 0,
      positive: 0,
      total: 0,
      pctNegative: 0,
      pctNeutral: 0,
      pctPositive: 0,
    };
  }

  const negative = values.filter((value) => value < -epsilon).length;
  const neutral = values.filter((value) => value >= -epsilon && value <= epsilon).length;
  const positive = values.filter((value) => value > epsilon).length;
  const total = values.length;

  return {
    negative,
    neutral,
    positive,
    total,
    pctNegative: (negative / total) * 100,
    pctNeutral: (neutral / total) * 100,
    pctPositive: (positive / total) * 100,
  };
}
