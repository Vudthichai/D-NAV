import type { DecisionEntry } from "../calculations";
import type { CohortSummary } from "../compare/types";

export type RegimeType = "Exploitative" | "Exploratory" | "Stressed" | "Asymmetric";

export type PostureSeriesPoint = { t: number; R: number; P: number; S: number };

export type PostureGeometry = {
  centroid: { R: number; P: number; S: number };
  variance: { R: number; P: number; S: number };
  distanceToAttractor: number;
  varianceMagnitude: number;
  varianceLabel: "Compressed" | "Expanding" | "Chaotic";
  stabilityRiskRatio: number;
  pressureDebtProxy: number;
  attractor: { R: number; P: number; S: number };
};

export type PostureTrends = {
  slopes: { R: number; P: number; S: number };
  slopeDirections: { R: -1 | 0 | 1; P: -1 | 0 | 1; S: -1 | 0 | 1 };
  varianceTrend: number | null;
  pressureLag: boolean;
};

export type RegimeResult = {
  regime: RegimeType;
  confidence: number;
  explanation: string;
};

export type PostureSummary = {
  geometry: PostureGeometry;
  trends: PostureTrends;
  regime: RegimeResult;
  stats: {
    mean: { R: number; P: number; S: number };
    std: { R: number; P: number; S: number };
  };
  series?: PostureSeriesPoint[];
};

export type PostureContrast = {
  postureSummary: string;
  regimeContrast: string;
  primaryRisk: string;
  bestUseCase: string;
};

const ATTRACTION_POINT = { R: 1, P: -1, S: 2 };
const R_GOOD = 0.5;
const P_LOW = 0;
const P_HIGH = 0.75;
const S_HIGH = 1.2;
const S_LOW = 0.2;
const VAR_LOW = 0.7;
const VAR_MED = 1.5;

const SLOPE_THRESHOLD = 0.05;
const VARIANCE_TREND_THRESHOLD = 0.15;

export function computePostureSummary(
  cohort: CohortSummary,
  decisions?: DecisionEntry[],
  options?: { slopeWindow?: number },
): PostureSummary {
  const mean = { R: cohort.avgReturn, P: cohort.avgPressure, S: cohort.avgStability };
  const std = { R: cohort.stdReturn, P: cohort.stdPressure, S: cohort.stdStability };
  const centroid = mean;
  const variance = std;
  const distanceToAttractor = euclideanDistance(centroid, ATTRACTION_POINT);
  const varianceMagnitude = Math.sqrt(std.R ** 2 + std.P ** 2 + std.S ** 2);
  const varianceLabel = getVarianceLabel(varianceMagnitude);
  const stabilityRiskRatio = std.S / Math.max(0.01, Math.abs(mean.S));
  const pressureDebtProxy = Math.max(0, mean.P) + std.P;

  const series = buildSeries(decisions);
  const trends = computeTrends(series, options?.slopeWindow ?? 5);
  const regime = classifyRegime({
    mean,
    std,
    geometry: { distanceToAttractor, varianceMagnitude },
    trends,
  });

  return {
    geometry: {
      centroid,
      variance,
      distanceToAttractor,
      varianceMagnitude,
      varianceLabel,
      stabilityRiskRatio,
      pressureDebtProxy,
      attractor: ATTRACTION_POINT,
    },
    trends,
    regime,
    stats: { mean, std },
    series,
  };
}

export function classifyRegime({
  mean,
  std,
  geometry,
  trends,
}: {
  mean: { R: number; P: number; S: number };
  std: { R: number; P: number; S: number };
  geometry: { distanceToAttractor: number; varianceMagnitude: number };
  trends: PostureTrends;
}): RegimeResult {
  const { varianceMagnitude } = geometry;
  const { slopes } = trends;

  const exploitativeScore =
    (mean.R >= R_GOOD ? 0.25 : 0) +
    (mean.P <= P_LOW ? 0.25 : 0) +
    (mean.S >= S_HIGH ? 0.25 : 0) +
    (varianceMagnitude <= VAR_LOW ? 0.25 : 0);

  const exploratoryScore =
    (varianceMagnitude >= VAR_MED ? 0.3 : 0) +
    (mean.S >= S_LOW && mean.S <= S_HIGH ? 0.2 : 0) +
    (trends.varianceTrend && trends.varianceTrend > VARIANCE_TREND_THRESHOLD ? 0.2 : 0) +
    (Math.abs(mean.R) <= 0.25 ? 0.1 : 0) +
    (slopes.S > SLOPE_THRESHOLD ? 0.2 : 0);

  const stressedScore =
    (mean.P >= P_HIGH ? 0.25 : 0) +
    (slopes.P > SLOPE_THRESHOLD ? 0.2 : 0) +
    (mean.S <= S_LOW ? 0.2 : 0) +
    (slopes.S < -SLOPE_THRESHOLD ? 0.2 : 0) +
    (varianceMagnitude >= VAR_MED ? 0.15 : 0) +
    (mean.R <= 0.1 ? 0.1 : 0);

  const asymmetricScore =
    (mean.R > 0.2 ? 0.25 : 0) +
    (varianceMagnitude >= VAR_LOW ? 0.2 : 0) +
    (mean.P >= P_LOW ? 0.15 : 0) +
    (mean.S >= S_LOW ? 0.15 : 0) +
    (std.R > Math.abs(mean.R) ? 0.15 : 0);

  const candidates: { regime: RegimeType; score: number; explanation: string }[] = [
    {
      regime: "Exploitative",
      score: exploitativeScore,
      explanation: "Clusters near the low-pressure, high-stability attractor; prioritizes compounding over exploration.",
    },
    {
      regime: "Exploratory",
      score: exploratoryScore,
      explanation: "Runs controlled experiments; volatility expands then contracts as learning stabilizes.",
    },
    {
      regime: "Stressed",
      score: stressedScore,
      explanation: "Forced decisions under strain; stability erodes and pressure accumulates.",
    },
    {
      regime: "Asymmetric",
      score: asymmetricScore,
      explanation: "Pursues convex outcomes; accepts pressure spikes to buy optionality.",
    },
  ];

  const best = candidates.reduce((acc, cur) => (cur.score > acc.score ? cur : acc));
  const confidence = Math.min(1, Math.max(0.2, best.score));

  return {
    regime: best.score === 0 ? "Exploratory" : best.regime,
    confidence,
    explanation: best.explanation,
  };
}

export function buildPostureContrast(
  a: PostureSummary,
  b: PostureSummary,
  labels: { a: string; b: string },
): PostureContrast {
  const closer = a.geometry.distanceToAttractor <= b.geometry.distanceToAttractor ? labels.a : labels.b;
  const steadier = a.geometry.varianceMagnitude <= b.geometry.varianceMagnitude ? labels.a : labels.b;

  const postureSummary = `${closer} sits closer to the attractor while ${steadier} carries a tighter variance halo.`;

  const regimeContrast = `${labels.a} is ${a.regime.regime.toLowerCase()}, ${labels.b} is ${b.regime.regime.toLowerCase()}.`;

  const primaryRiskSource =
    a.geometry.stabilityRiskRatio > b.geometry.stabilityRiskRatio
      ? `${labels.a} shows higher fragility (stability wobble ratio ${a.geometry.stabilityRiskRatio.toFixed(1)}).`
      : `${labels.b} shows higher fragility (stability wobble ratio ${b.geometry.stabilityRiskRatio.toFixed(1)}).`;

  const bestUseCase =
    a.regime.regime === "Exploitative" && b.regime.regime !== "Exploitative"
      ? `${labels.a} suits compounding; ${labels.b} is better for optionality plays.`
      : b.regime.regime === "Exploitative" && a.regime.regime !== "Exploitative"
        ? `${labels.b} suits compounding; ${labels.a} is better for optionality plays.`
        : `Use ${labels.a} when stability matters, and ${labels.b} when learning or aggression is needed.`;

  return {
    postureSummary,
    regimeContrast,
    primaryRisk: primaryRiskSource,
    bestUseCase,
  };
}

export function deriveEarlyWarnings(posture: PostureSummary): {
  key: string;
  title: string;
  status: "On" | "Off";
  reason: string;
}[] {
  const { stats, trends } = posture;
  const varianceTrend = trends.varianceTrend ?? 0;
  const hiddenFragility = varianceTrend > VARIANCE_TREND_THRESHOLD;
  const debtForming = trends.slopeDirections.R >= 0 && trends.slopeDirections.P > 0;
  const narrativeDrift = trends.slopeDirections.R <= 0 && stats.mean.R >= -0.1 && varianceTrend > 0;

  return [
    {
      key: "fragility",
      title: "Hidden Fragility",
      status: hiddenFragility ? "On" : "Off",
      reason: hiddenFragility
        ? `Stability variance is rising while the mean stays ${stats.mean.S.toFixed(1)}.`
        : "Stability variance is contained.",
    },
    {
      key: "debt",
      title: "Debt Forming",
      status: debtForming ? "On" : "Off",
      reason: debtForming
        ? "Return and pressure are climbing together; strain may be deferred."
        : "Pressure is not outpacing gains.",
    },
    {
      key: "drift",
      title: "Narrative Drift",
      status: narrativeDrift ? "On" : "Off",
      reason: narrativeDrift
        ? "Returns are flat-to-down while variance expands; story may be weakening."
        : "Trajectory is coherent; no narrative drift detected.",
    },
  ];
}

function buildSeries(decisions?: DecisionEntry[]): PostureSeriesPoint[] | undefined {
  if (!decisions || decisions.length === 0) return undefined;
  return [...decisions]
    .sort((a, b) => a.ts - b.ts)
    .map((d) => ({ t: d.ts, R: d.return, P: d.pressure, S: d.stability }));
}

function computeTrends(series: PostureSeriesPoint[] | undefined, window: number): PostureTrends {
  const slopes = {
    R: computeSlope(series, "R", window),
    P: computeSlope(series, "P", window),
    S: computeSlope(series, "S", window),
  };

  const slopeDirections = {
    R: slopeToDirection(slopes.R),
    P: slopeToDirection(slopes.P),
    S: slopeToDirection(slopes.S),
  };

  const varianceTrend = series ? computeVarianceTrend(series) : null;
  const pressureLag = slopes.R > SLOPE_THRESHOLD && slopes.P > SLOPE_THRESHOLD;

  return { slopes, slopeDirections, varianceTrend, pressureLag };
}

function computeSlope(series: PostureSeriesPoint[] | undefined, key: "R" | "P" | "S", window: number): number {
  if (!series || series.length < 2) return 0;
  const points = series.slice(-Math.max(window, 2));
  if (points.length < 2) return 0;
  const xs = points.map((p, idx) => idx);
  const ys = points.map((p) => p[key]);
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const numerator = xs.reduce((sum, x, idx) => sum + (x - xMean) * (ys[idx] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0) || 1;
  return numerator / denominator;
}

function computeVarianceTrend(series: PostureSeriesPoint[]): number {
  if (series.length < 4) return 0;
  const mid = Math.floor(series.length / 2);
  const first = series.slice(0, mid).map((p) => p.S);
  const second = series.slice(mid).map((p) => p.S);
  return stdev(second) - stdev(first);
}

function stdev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function slopeToDirection(value: number): -1 | 0 | 1 {
  if (value > SLOPE_THRESHOLD) return 1;
  if (value < -SLOPE_THRESHOLD) return -1;
  return 0;
}

function euclideanDistance(a: { R: number; P: number; S: number }, b: { R: number; P: number; S: number }) {
  return Math.sqrt((a.R - b.R) ** 2 + (a.P - b.P) ** 2 + (a.S - b.S) ** 2);
}

function getVarianceLabel(magnitude: number): "Compressed" | "Expanding" | "Chaotic" {
  if (magnitude < VAR_LOW) return "Compressed";
  if (magnitude < VAR_MED) return "Expanding";
  return "Chaotic";
}
