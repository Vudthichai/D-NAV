import type { DecisionEntry } from "./calculations";
import type { RegimeType } from "./judgment/posture";
import { computeQuadrantShares } from "./compare/evidence";
import type { ScatterPoint } from "./compare/types";

export type TemporalPoint = {
  xIndex: number;
  return: number | null;
  pressure: number | null;
  stability: number | null;
  dnav: number | null;
  regime: RegimeType;
};

export type RegimeSegment = {
  startIndex: number;
  endIndex: number;
  regime: RegimeType;
};

export type SummaryChips = {
  efficientUpsidePct: number;
  pressureWarningPct: number;
  stabilityMedian: number | null;
  dnavTrend: "up" | "down" | "flat";
  windowLabel: string;
};

const PRESSURE_WARNING_THRESHOLD = -3;
const ROLLING_DEADBAND = 0.5;

export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function windowDecisions(decisions: DecisionEntry[], windowSize: number | "all"): DecisionEntry[] {
  const sorted = [...decisions].sort((a, b) => a.ts - b.ts);
  if (windowSize === "all") return sorted;
  const size = Math.max(0, Math.min(windowSize, sorted.length));
  return size > 0 ? sorted.slice(-size) : [];
}

export function rollingMean(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1).filter((value): value is number => value !== null);
    if (!slice.length) return null;
    const total = slice.reduce((acc, value) => acc + value, 0);
    return total / slice.length;
  });
}

export function rollingStd(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1).filter((value): value is number => value !== null);
    if (slice.length <= 1) return 0;
    const mean = slice.reduce((acc, value) => acc + value, 0) / slice.length;
    const variance = slice.reduce((acc, value) => acc + (value - mean) ** 2, 0) / slice.length;
    return Math.sqrt(variance);
  });
}

export function buildTemporalPoints(decisions: DecisionEntry[]): TemporalPoint[] {
  return decisions.map((decision, index) => {
    const normalized = normalizeDecision(decision);
    return {
      xIndex: index + 1,
      return: normalized.return,
      pressure: normalized.pressure,
      stability: normalized.stability,
      dnav: normalized.dnav,
      regime: computeRegime(normalized),
    };
  });
}

export function computeRegime({
  return: ret,
  pressure,
  stability,
}: {
  return: number | null;
  pressure: number | null;
  stability: number | null;
}): RegimeType {
  if (ret === null || pressure === null || stability === null) {
    return "Exploratory";
  }

  if (pressure >= 3 && stability <= 0) {
    return "Stressed";
  }

  if (ret >= 3 && pressure <= 0 && stability >= 1) {
    return "Exploitative";
  }

  if (ret >= 2 && pressure > 0) {
    return "Asymmetric";
  }

  return "Exploratory";
}

export function mergeRegimeSegments(points: TemporalPoint[]): RegimeSegment[] {
  if (!points.length) return [];
  const segments: RegimeSegment[] = [];
  let current = { startIndex: 1, endIndex: 1, regime: points[0].regime };

  points.forEach((point, index) => {
    const xIndex = index + 1;
    if (point.regime === current.regime) {
      current.endIndex = xIndex;
    } else {
      segments.push(current);
      current = { startIndex: xIndex, endIndex: xIndex, regime: point.regime };
    }
  });
  segments.push(current);
  return segments;
}

export function computeSummaryChips(points: TemporalPoint[], rollingWindow: number): SummaryChips {
  const windowLabel = points.length >= 25 ? "Last 25" : `Last ${points.length}`;
  const scatterPoints: ScatterPoint[] = points
    .map((point) => ({
      xPressure: point.pressure,
      yReturn: point.return,
      stability: point.stability,
    }))
    .filter((point): point is ScatterPoint =>
      typeof point.xPressure === "number" && typeof point.yReturn === "number" && typeof point.stability === "number",
    );

  const quadrantShares = computeQuadrantShares(scatterPoints);
  const pressureWarnings = points.filter((point) =>
    typeof point.pressure === "number" ? point.pressure <= PRESSURE_WARNING_THRESHOLD : false,
  );
  const pressureWarningPct = points.length ? (pressureWarnings.length / points.length) * 100 : 0;

  const stabilities = points
    .map((point) => point.stability)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const mid = Math.floor(stabilities.length / 2);
  const stabilityMedian =
    stabilities.length === 0
      ? null
      : stabilities.length % 2
        ? stabilities[mid]
        : (stabilities[mid - 1] + stabilities[mid]) / 2;

  const dnavSeries = points.map((point) => point.dnav);
  const rolling = rollingMean(dnavSeries, rollingWindow).filter((value): value is number => value !== null);
  const first = rolling[0] ?? 0;
  const last = rolling[rolling.length - 1] ?? 0;
  const delta = last - first;
  const dnavTrend = Math.abs(delta) < ROLLING_DEADBAND ? "flat" : delta > 0 ? "up" : "down";

  return {
    efficientUpsidePct: quadrantShares.upperLeft,
    pressureWarningPct,
    stabilityMedian,
    dnavTrend,
    windowLabel,
  };
}

export function normalizeDecision(decision: DecisionEntry) {
  const ret =
    decision.return ??
    decision.Return ??
    decision.RETURN ??
    decision.R ??
    decision["Return"] ??
    decision["RETURN"] ??
    decision["R"];
  const pressure =
    decision.pressure ??
    decision.Pressure ??
    decision.PRESSURE ??
    decision.P ??
    decision["Pressure"] ??
    decision["PRESSURE"] ??
    decision["P"];
  const stability =
    decision.stability ??
    decision.Stability ??
    decision.STABILITY ??
    decision.S ??
    decision["Stability"] ??
    decision["STABILITY"] ??
    decision["S"];
  const dnav =
    decision.dnav ??
    decision.dNav ??
    decision["D-NAV"] ??
    decision.DNAV ??
    decision.D_NAV ??
    decision.D ??
    decision["DNAV"] ??
    decision["D_NAV"] ??
    decision["D"];

  return {
    return: toNumberOrNull(ret),
    pressure: toNumberOrNull(pressure),
    stability: toNumberOrNull(stability),
    dnav: toNumberOrNull(dnav),
  };
}
