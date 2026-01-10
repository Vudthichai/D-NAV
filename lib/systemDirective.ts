type SystemDirectiveInput = {
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
  returnNegativePct?: number;
  pressurePressuredPct?: number;
  stabilityFragilePct?: number;
};

export function getSystemDirective({
  avgReturn,
  avgPressure,
  avgStability,
  returnNegativePct = 0,
  pressurePressuredPct = 0,
  stabilityFragilePct = 0,
}: SystemDirectiveInput) {
  let permission: string;

  if (avgPressure <= -1 && avgStability >= 1) {
    permission = "You're stable and under low pressure —";
  } else if (avgPressure > 1) {
    permission = "You're under high pressure —";
  } else if (avgStability < -1 || stabilityFragilePct >= 15) {
    permission = "Stability is thin —";
  } else {
    permission = "You're in a neutral posture —";
  }

  const primaryLever =
    avgReturn <= 0 || returnNegativePct >= 15
      ? "prioritize increasing Return by raising Impact or reducing Cost"
      : "increase ambition selectively by raising Impact or reducing Cost where return is already strongest";

  let guardrail: string;
  if (avgStability < 1 || stabilityFragilePct >= 15) {
    guardrail = "while keeping decisions on stable footing";
  } else if (avgPressure > 1 || pressurePressuredPct >= 20) {
    guardrail = "while reducing execution strain";
  } else {
    guardrail = "without destabilizing the operating base";
  }

  return `${permission} ${primaryLever} ${guardrail}.`;
}
