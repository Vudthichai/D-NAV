import type { CompareResult, CohortSummary } from "./types";

export function runEntityCompare({
  cohortA,
  cohortB,
}: {
  cohortA: CohortSummary;
  cohortB: CohortSummary;
}): CompareResult {
  const returnDelta = cohortB.avgReturn - cohortA.avgReturn;
  const pressureDelta = cohortB.avgPressure - cohortA.avgPressure;
  const stabilityDelta = cohortB.avgStability - cohortA.avgStability;

  return {
    mode: "entity",
    cohortA,
    cohortB,
    deltas: {
      returnDelta,
      pressureDelta,
      stabilityDelta,
    },
    postureLine: buildPostureLine(returnDelta, pressureDelta, stabilityDelta),
  };
}

function describeDelta(value: number, label: string) {
  if (Math.abs(value) < 0.05) return `${label.toLowerCase()} steady`;
  const direction = value > 0 ? "higher" : "lower";
  return `${direction} ${label.toLowerCase()}`;
}

function buildPostureLine(returnDelta: number, pressureDelta: number, stabilityDelta: number) {
  const bits = [
    describeDelta(returnDelta, "Return"),
    describeDelta(pressureDelta, "Pressure"),
    describeDelta(stabilityDelta, "Stability"),
  ].filter(Boolean);

  if (bits.length === 0) return "Posture unchanged across return, pressure, and stability.";
  if (bits.length === 1) return `System B shows ${bits[0]}.`;
  if (bits.length === 2) return `System B shows ${bits[0]} and ${bits[1]}.`;
  return `System B shows ${bits[0]}, ${bits[1]}, and ${bits[2]}.`;
}
