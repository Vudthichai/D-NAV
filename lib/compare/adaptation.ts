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

const DEFAULT_ALL_RECENT = 50;

export function sliceRecentAndPrevious(decisions: DecisionEntry[], windowSize: number): WindowSlice {
  if (decisions.length === 0) return { recent: [], previous: [] };
  const sorted = [...decisions].sort((a, b) => a.ts - b.ts);

  if (windowSize <= 0) {
    if (sorted.length >= DEFAULT_ALL_RECENT * 2) {
      return {
        recent: sorted.slice(-DEFAULT_ALL_RECENT),
        previous: sorted.slice(-DEFAULT_ALL_RECENT * 2, -DEFAULT_ALL_RECENT),
      };
    }
    const midpoint = Math.floor(sorted.length / 2);
    return {
      previous: sorted.slice(0, midpoint),
      recent: sorted.slice(midpoint),
    };
  }

  const resolvedWindow = Math.min(windowSize, sorted.length);
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

export type DeltaDirection = "up" | "down" | "flat";

export function getDeltaDirection(delta: number, epsilon = 0.1): DeltaDirection {
  if (Math.abs(delta) < epsilon) return "flat";
  return delta > 0 ? "up" : "down";
}

export function formatDelta(value: number, digits = 1): string {
  const absValue = Math.abs(value);
  const formatted = absValue.toFixed(digits);
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `−${formatted}%`;
  return `${formatted}%`;
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(digits)}%`;
}

export function getConsistencyLabel(stdValue: number | null): "Tight" | "Moderate" | "Volatile" | "—" {
  if (stdValue === null || !Number.isFinite(stdValue)) return "—";
  if (stdValue <= 3) return "Tight";
  if (stdValue <= 6) return "Moderate";
  return "Volatile";
}

export function scoreConsistency(label: "Tight" | "Moderate" | "Volatile" | "—"): number {
  switch (label) {
    case "Tight":
      return 3;
    case "Moderate":
      return 2;
    case "Volatile":
      return 1;
    default:
      return 0;
  }
}

function toBucketShares(buckets: { pctNegative: number; pctNeutral: number; pctPositive: number }): BucketShares {
  return {
    negative: buckets.pctNegative,
    neutral: buckets.pctNeutral,
    positive: buckets.pctPositive,
  };
}
