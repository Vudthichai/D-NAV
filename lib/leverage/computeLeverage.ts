import { computeMetrics } from "@/lib/calculations";
import type { DecisionInputs, DecisionMetrics, LeverageRow, LeverageTag, LeverageVariable } from "@/types/leverage";

const LEVERAGE_THRESHOLDS = {
  high: 7,
  medium: 3,
};

const leverageVariables: LeverageVariable[] = ["impact", "cost", "risk", "urgency", "confidence"];

const toDecisionMetrics = (metrics: ReturnType<typeof computeMetrics>): DecisionMetrics => ({
  return: metrics.return,
  pressure: metrics.pressure,
  stability: metrics.stability,
  dnav: metrics.dnav,
});

const toLeverageTag = (delta: number): LeverageTag => {
  const magnitude = Math.abs(delta);
  if (magnitude >= LEVERAGE_THRESHOLDS.high) return "High";
  if (magnitude >= LEVERAGE_THRESHOLDS.medium) return "Medium";
  return "Low";
};

export function computeLeverage(base: DecisionInputs, modified: DecisionInputs) {
  const baseMetricsRaw = computeMetrics(base);
  const modifiedMetricsRaw = computeMetrics(modified);
  const baseMetrics = toDecisionMetrics(baseMetricsRaw);
  const modifiedMetrics = toDecisionMetrics(modifiedMetricsRaw);

  const rows = leverageVariables.map((variable) => {
    const deltaInput = modified[variable] - base[variable];
    const oneChange: DecisionInputs = {
      ...base,
      [variable]: modified[variable],
    };
    const oneChangeMetrics = computeMetrics(oneChange);
    const deltaDnav = oneChangeMetrics.dnav - baseMetricsRaw.dnav;

    return {
      variable,
      deltaInput,
      deltaDnav,
      leverageTag: toLeverageTag(deltaDnav),
      direction: deltaDnav > 0 ? "up" : deltaDnav < 0 ? "down" : "flat",
    } satisfies LeverageRow;
  });

  rows.sort((a, b) => Math.abs(b.deltaDnav) - Math.abs(a.deltaDnav));

  return {
    baseMetrics,
    modifiedMetrics,
    rows,
  };
}

export { LEVERAGE_THRESHOLDS };
