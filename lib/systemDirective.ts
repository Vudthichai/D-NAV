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
}: SystemDirectiveInput): string[] {
  void _avgReturn;

  const systemDirective = [
    "This decision system is operating with stable footing and low overall pressure, favoring repeatable execution over high-variance bets.",
    "The one thing the dataset must protect right now is Stability — improve results by increasing Impact selectively, without adding stress that weakens the base.",
    "Most upside will come from concentration, not acceleration.",
  ];

  if (avgPressure <= -1 && avgStability >= 1) {
    return systemDirective;
  }

  if (avgPressure > 1 || pressurePressuredPct >= 20) {
    return systemDirective;
  }

  if (avgStability < 1 || stabilityFragilePct >= 15) {
    return systemDirective;
  }

  return systemDirective;
}
