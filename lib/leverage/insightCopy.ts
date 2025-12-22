import type { DecisionInputs, DecisionMetrics, LeverageRow } from "@/types/leverage";

const variableLabels: Record<LeverageRow["variable"], string> = {
  impact: "Impact",
  cost: "Cost",
  risk: "Risk",
  urgency: "Urgency",
  confidence: "Confidence",
};

const isReturnUpStabilityDown = (base: DecisionMetrics, modified: DecisionMetrics) =>
  modified.return > base.return && modified.stability < base.stability;

const isReturnDownStabilityUp = (base: DecisionMetrics, modified: DecisionMetrics) =>
  modified.return < base.return && modified.stability > base.stability;

const contextClauseFor = (variable: LeverageRow["variable"], baseInputs: DecisionInputs, baseMetrics: DecisionMetrics) => {
  if (variable === "confidence" && baseInputs.urgency >= 7) {
    return "urgency is elevated";
  }
  if (variable === "urgency" && baseInputs.confidence >= 7) {
    return "confidence is already high";
  }
  if (variable === "risk" && baseMetrics.stability <= 0) {
    return "stability is fragile";
  }
  if ((variable === "impact" || variable === "cost") && baseMetrics.return <= 0) {
    return "baseline return is thin";
  }
  if (variable === "urgency" && baseMetrics.pressure > 0) {
    return "pressure is elevated";
  }
  if (variable === "confidence" && baseMetrics.pressure > 0) {
    return "pressure is elevated";
  }
  if ((variable === "impact" || variable === "cost") && baseMetrics.return > 0) {
    return "baseline return is already positive";
  }
  return "this context";
};

export function buildLeverageInsight({
  baseInputs,
  baseMetrics,
  modifiedMetrics,
  rows,
}: {
  baseInputs: DecisionInputs;
  baseMetrics: DecisionMetrics;
  modifiedMetrics: DecisionMetrics;
  rows: LeverageRow[];
}) {
  const hasChanges = rows.some((row) => row.deltaInput !== 0);
  if (!hasChanges) {
    return "No leverage signal yet — modify one input to measure sensitivity.";
  }

  const top = rows[0];
  const variableLabel = variableLabels[top.variable];
  const contextClause = contextClauseFor(top.variable, baseInputs, baseMetrics);
  const leverageSentence = `The strongest leverage is ${variableLabel} because ${contextClause}.`;

  if (isReturnUpStabilityDown(baseMetrics, modifiedMetrics)) {
    return `Higher upside is being achieved with lower repeatability, and ${leverageSentence.toLowerCase()}`;
  }

  if (isReturnDownStabilityUp(baseMetrics, modifiedMetrics)) {
    return `Lower upside is paired with more repeatable structure, and ${leverageSentence.toLowerCase()}`;
  }

  return leverageSentence;
}
