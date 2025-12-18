import type { PostureSeriesPoint } from "../judgment/posture";
import { rollingStd } from "./stats";
import type { CompareMode, RPSPoint, ScatterPoint, VelocityGoalTarget, VelocityResult } from "./types";

type ScatterBuildOptions = { useSequence?: boolean };

export function buildScatterPoints(series: PostureSeriesPoint[] | undefined, mode: CompareMode, options?: ScatterBuildOptions): ScatterPoint[] {
  if (!series || series.length === 0) return [];
  const useSequence = options?.useSequence ?? mode === "temporal";
  return series.map((point, idx) => ({
    xPressure: point.P,
    yReturn: point.R,
    stability: point.S,
    t: point.t,
    label: useSequence ? `Decision ${idx + 1}` : formatTimestamp(point.t) ?? `Decision ${idx + 1}`,
  }));
}

export function buildVarianceSeries(series: PostureSeriesPoint[] | undefined, window = 5, options?: ScatterBuildOptions): RPSPoint[] {
  if (!series || series.length === 0) return [];
  const useSequence = options?.useSequence ?? false;
  const returns = series.map((point) => point.R);
  const pressures = series.map((point) => point.P);
  const stabilities = series.map((point) => point.S);
  const stdR = rollingStd(returns, window);
  const stdP = rollingStd(pressures, window);
  const stdS = rollingStd(stabilities, window);

  return series.map((point, idx) => ({
    x: useSequence ? idx + 1 : formatTimestamp(point.t) ?? idx + 1,
    R: stdR[idx],
    P: stdP[idx],
    S: stdS[idx],
  }));
}

export type RecoveryPoint = {
  window: number;
  value: number;
  inBand: boolean;
  t?: number;
};

export type RecoveryEvent = {
  deviationStart: number;
  recoveredAt: number;
  duration: number;
};

export function buildRecoverySeries(
  series: PostureSeriesPoint[] | undefined,
  velocity: VelocityResult,
  target: VelocityGoalTarget,
): { points: RecoveryPoint[]; events: RecoveryEvent[]; durations: number[] } {
  if (!series || series.length === 0) return { points: [], events: [], durations: [] };

  const points: RecoveryPoint[] = [];
  const events: RecoveryEvent[] = [];
  const durations: number[] = [];

  const { windowSize, thresholds, consecutiveWindows } = velocity;
  const checkWindow = buildWindowCheck(target, thresholds);
  let streak = 0;
  let inBand = false;
  let pendingDeviation: number | null = null;

  for (let idx = 0; idx < series.length; idx += 1) {
    const windowStart = idx - windowSize + 1;
    const hasWindow = windowStart >= 0;
    const windowEntries = hasWindow ? series.slice(windowStart, idx + 1) : [];
    const passes = hasWindow ? checkWindow(windowEntries) : false;
    streak = passes ? streak + 1 : 0;
    const meetsRule = streak >= consecutiveWindows;
    const windowNumber = hasWindow ? windowStart + 2 : 1;

    if (meetsRule && !inBand) {
      if (pendingDeviation !== null) {
        const duration = windowNumber - pendingDeviation;
        events.push({ deviationStart: pendingDeviation, recoveredAt: windowNumber, duration });
        durations.push(duration);
      }
      inBand = true;
      pendingDeviation = null;
    }

    if (!meetsRule && inBand) {
      pendingDeviation = windowNumber;
      inBand = false;
    }

    if (!meetsRule && !inBand && pendingDeviation === null && hasWindow) {
      pendingDeviation = windowNumber;
    }

    const rollingValue = computeRollingValue(target, windowEntries);
    points.push({ window: windowNumber, value: rollingValue, inBand, t: series[idx].t });
  }

  return { points, events, durations };
}

function buildWindowCheck(target: VelocityGoalTarget, thresholds: VelocityResult["thresholds"]) {
  return (window: PostureSeriesPoint[]) => {
    if (!window.length) return false;
    const avg = (key: "R" | "P" | "S") => average(window.map((point) => point[key]));
    if (target === "RETURN_RISE") return avg("R") >= thresholds.returnLift;
    if (target === "PRESSURE_STABILIZE") return Math.abs(avg("P")) <= thresholds.pressureBand && avg("S") >= thresholds.stabilityFloor;
    return Math.abs(avg("S")) <= thresholds.stabilityBand && avg("S") >= thresholds.stabilityFloor;
  };
}

function computeRollingValue(target: VelocityGoalTarget, window: PostureSeriesPoint[]) {
  if (!window.length) return 0;
  const avg = (key: "R" | "P" | "S") => average(window.map((point) => point[key]));
  if (target === "RETURN_RISE") return avg("R");
  if (target === "PRESSURE_STABILIZE") return avg("P");
  return avg("S");
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatTimestamp(value: number | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
