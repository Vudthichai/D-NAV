import type { DecisionEntry } from "@/lib/storage";
import { distributionBuckets, mean, std } from "@/lib/compare/stats";

export type BucketShares = {
  negative: number;
  neutral: number;
  positive: number;
};

export type DistributionShares = {
  return: BucketShares;
  pressure: BucketShares;
  stability: BucketShares;
};

export type BasicStats = {
  meanDnav: number | null;
  varianceDnav: number | null;
  stdDnav: number | null;
};

export type WindowSlice = {
  recent: DecisionEntry[];
  previous: DecisionEntry[];
};

export function sliceRecentAndPrevious(decisions: DecisionEntry[], windowSize: number): WindowSlice {
  if (decisions.length === 0) return { recent: [], previous: [] };
  const sorted = [...decisions].sort((a, b) => a.ts - b.ts);
  const resolvedWindow = windowSize <= 0 ? sorted.length : Math.min(windowSize, sorted.length);
  const recent = sorted.slice(-resolvedWindow);
  const previousStart = Math.max(0, sorted.length - resolvedWindow * 2);
  const previous = sorted.slice(previousStart, sorted.length - resolvedWindow);
  return { recent, previous };
}

export function computeBucketShares(decisions: DecisionEntry[]): DistributionShares {
  const returnBuckets = distributionBuckets(decisions.map((decision) => decision.return));
  const pressureBuckets = distributionBuckets(decisions.map((decision) => decision.pressure));
  const stabilityBuckets = distributionBuckets(decisions.map((decision) => decision.stability));

  return {
    return: toBucketShares(returnBuckets),
    pressure: toBucketShares(pressureBuckets),
    stability: toBucketShares(stabilityBuckets),
  };
}

export function computeBasicStats(decisions: DecisionEntry[]): BasicStats {
  const values = decisions
    .map((decision) => decision.dnav)
    .filter((value): value is number => Number.isFinite(value));

  if (values.length === 0) {
    return { meanDnav: null, varianceDnav: null, stdDnav: null };
  }

  const meanValue = mean(values);
  const stdValue = std(values);
  return {
    meanDnav: meanValue,
    varianceDnav: stdValue ** 2,
    stdDnav: stdValue,
  };
}

export function computeConsistencyStd(decisions: DecisionEntry[]): number | null {
  const dnavValues = decisions
    .map((decision) => decision.dnav)
    .filter((value): value is number => Number.isFinite(value));

  if (dnavValues.length > 0) {
    return std(dnavValues);
  }

  const returnValues = decisions
    .map((decision) => decision.return)
    .filter((value): value is number => Number.isFinite(value));

  if (returnValues.length > 0) {
    return std(returnValues);
  }

  return null;
}

export type DeltaDirection = "up" | "down" | "flat";

export function getDeltaDirection(delta: number, epsilon = 0.1): DeltaDirection {
  if (Math.abs(delta) < epsilon) return "flat";
  return delta > 0 ? "up" : "down";
}

export function formatDeltaPp(value: number, digits = 1): string {
  const absValue = Math.abs(value);
  const formatted = absValue.toFixed(digits);
  if (value > 0) return `+${formatted}pp`;
  if (value < 0) return `−${formatted}pp`;
  return `${formatted}pp`;
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(digits)}%`;
}

function toBucketShares(buckets: { pctNegative: number; pctNeutral: number; pctPositive: number }): BucketShares {
  return {
    negative: buckets.pctNegative,
    neutral: buckets.pctNeutral,
    positive: buckets.pctPositive,
  };
}
