export const SESSION_ACTION_EPS = 0.25;
export const SESSION_ACTION_PRESSURE_THRESH = 1.5;

export type SessionActionInsightInput = {
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
  avgRisk: number;
  avgConfidence: number;
};

export const getSessionActionInsight = ({
  avgReturn,
  avgPressure,
  avgStability,
  avgRisk,
  avgConfidence,
}: SessionActionInsightInput): string => {
  const isBalanced =
    Math.abs(avgPressure) <= SESSION_ACTION_EPS &&
    Math.abs(avgStability) <= SESSION_ACTION_EPS &&
    avgReturn > 0;

  if (isBalanced) {
    return "Signals are aligned. Maintain current commitment speed and monitor for pressure drift.";
  }

  if (avgPressure <= -SESSION_ACTION_PRESSURE_THRESH && avgStability <= 0) {
    return "Pressure is driving decisions. Pause irreversible commitments until stability recovers.";
  }

  if (avgPressure <= -SESSION_ACTION_EPS && avgStability <= 0 && avgRisk > avgConfidence) {
    return "Reduce commitment speed until confidence matches the risk being taken.";
  }

  if (avgStability >= SESSION_ACTION_EPS && avgReturn <= 0) {
    return "Caution is suppressing return. Increase exposure selectively where conviction is strongest.";
  }

  return "Signals are aligned. Maintain current commitment speed and monitor for pressure drift.";
};
