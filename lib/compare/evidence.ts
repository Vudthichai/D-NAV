import type { ScatterPoint } from "./types";
import type { PostureSeriesPoint } from "../judgment/posture";
import { mean, rollingStd, std } from "./stats";

export type QuadrantShares = {
  upperRight: number;
  upperLeft: number;
  lowerRight: number;
  lowerLeft: number;
};

export type VarianceProfile = {
  baseline: number;
  tail: number;
  max: number;
  volatility: number;
  average: number;
};

export type RegimeCall = "deviation" | "regime shift";

export function computeQuadrantShares(points: ScatterPoint[]): QuadrantShares {
  if (!points.length) {
    return { upperRight: 0, upperLeft: 0, lowerRight: 0, lowerLeft: 0 };
  }
  const total = points.length;
  const counts = points.reduce(
    (acc, point) => {
      if (point.yReturn >= 0 && point.xPressure >= 0) acc.upperRight += 1;
      else if (point.yReturn >= 0 && point.xPressure < 0) acc.upperLeft += 1;
      else if (point.yReturn < 0 && point.xPressure >= 0) acc.lowerRight += 1;
      else acc.lowerLeft += 1;
      return acc;
    },
    { upperRight: 0, upperLeft: 0, lowerRight: 0, lowerLeft: 0 },
  );

  return {
    upperRight: (counts.upperRight / total) * 100,
    upperLeft: (counts.upperLeft / total) * 100,
    lowerRight: (counts.lowerRight / total) * 100,
    lowerLeft: (counts.lowerLeft / total) * 100,
  };
}

export function computeSteadiness(stdR: number, stdP: number, stdS: number) {
  const avg = mean([stdR, stdP, stdS]);
  return 1 / (1 + avg);
}

export function buildVarianceProfile(series: PostureSeriesPoint[] | undefined, window = 5): VarianceProfile {
  if (!series || series.length === 0) {
    return { baseline: 0, tail: 0, max: 0, volatility: 0, average: 0 };
  }
  const returns = series.map((point) => point.R);
  const pressures = series.map((point) => point.P);
  const stabilities = series.map((point) => point.S);
  const stdR = rollingStd(returns, window);
  const stdP = rollingStd(pressures, window);
  const stdS = rollingStd(stabilities, window);
  const composite = stdR.map((value, idx) => mean([value, stdP[idx], stdS[idx]]));

  const sliceSize = Math.max(1, Math.floor(composite.length / 3));
  const baseline = mean(composite.slice(0, sliceSize));
  const tail = mean(composite.slice(composite.length - sliceSize));
  const max = Math.max(...composite);
  return {
    baseline,
    tail,
    max,
    volatility: std(composite),
    average: mean(composite),
  };
}

export function determineRegimeCall(
  seriesA: PostureSeriesPoint[] | undefined,
  seriesB: PostureSeriesPoint[] | undefined,
  deltas: { returnDelta: number; pressureDelta: number; stabilityDelta: number },
  window = 5,
): RegimeCall {
  const meanShift = mean([
    Math.abs(deltas.returnDelta),
    Math.abs(deltas.pressureDelta),
    Math.abs(deltas.stabilityDelta),
  ]);
  const profileA = buildVarianceProfile(seriesA, window);
  const profileB = buildVarianceProfile(seriesB, window);
  const varianceShift = Math.abs(profileB.average - profileA.average);

  const varianceSpike = profileB.max > profileB.baseline * 1.4;
  const varianceRecompresses = profileB.tail <= profileB.baseline * 1.15;
  const varianceStable = profileB.volatility <= Math.max(0.05, profileB.average * 0.25);

  if (meanShift >= 0.08 && varianceShift > 0.12 && varianceStable) {
    return "regime shift";
  }
  if (varianceSpike && varianceRecompresses) {
    return "deviation";
  }
  return meanShift >= 0.08 && varianceShift > 0.12 ? "regime shift" : "deviation";
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 2) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(digits);
}
