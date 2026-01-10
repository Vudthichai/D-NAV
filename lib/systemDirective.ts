type SystemDirectiveInput = {
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
  pressurePressuredPct?: number;
  stabilityFragilePct?: number;
};

export function getSystemDirective({
  avgReturn: _avgReturn,
  avgPressure,
  avgStability,
  pressurePressuredPct = 0,
  stabilityFragilePct = 0,
}: SystemDirectiveInput) {
  if (avgPressure <= -1 && avgStability >= 1) {
    return "This dataset is operating under low pressure with stable footing. Use the category results below to choose where to act: increase Impact (or reduce Cost) in the highest-return categories first, and avoid changes that reduce Stability.";
  }

  if (avgPressure > 1 || pressurePressuredPct >= 20) {
    return "This dataset is under high pressure — reduce execution strain first (lower Cost / lower Urgency), then raise Impact selectively in the categories that already perform.";
  }

  if (avgStability < 1 || stabilityFragilePct >= 15) {
    return "This dataset’s stability is thin — protect stable footing first (lower Risk / lower Cost), then raise Impact selectively in the categories that can absorb it.";
  }

  return "This dataset is in a neutral posture — use the category results below to focus effort: improve Return by raising Impact or reducing Cost where outcomes are already consistent, and keep Stability steady.";
}
