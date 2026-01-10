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
    return "You’re stable and under low pressure — use the category results below to choose where to act: push Impact up (or Cost down) in the best-return category first, and avoid moves that reduce Stability.";
  }

  if (avgPressure > 1 || pressurePressuredPct >= 20) {
    return "You’re under high pressure — reduce execution strain first (lower Cost / lower Urgency), then raise Impact selectively in the categories that already perform.";
  }

  if (avgStability < 1 || stabilityFragilePct >= 15) {
    return "Stability is at risk — protect stable footing first (lower Risk / lower Cost), then push Impact selectively in the categories that can absorb it.";
  }

  return "You’re in a neutral posture — use the category results below to focus effort: improve Return by raising Impact or reducing Cost where outcomes are already consistent, and keep Stability steady.";
}
