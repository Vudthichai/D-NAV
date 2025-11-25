import { type ArchetypePatterns, type CategoryHeatmapRow, type LearningMetrics, type RpsBaseline, type ReturnHygiene } from "./judgmentDashboard";

const formatNumber = (value: number, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : "0";

const describeDirection = (value: number, positive: string, negative: string, neutral: string) => {
  if (value > 0.1) return positive;
  if (value < -0.1) return negative;
  return neutral;
};

export const generateRPSSummary = (baseline: RpsBaseline): string => {
  if (!baseline.total)
    return "No decisions fall inside this window yet, so the RPS baseline has no usable signal for summary.";

  const bestReturn = baseline.bestWorst.find((item) => item.label === "Best Return")?.value ?? 0;
  const worstReturn = baseline.bestWorst.find((item) => item.label === "Worst Return")?.value ?? 0;
  const pressureTrend = describeDirection(baseline.avgPressure, "higher-pressure tilt", "calmer bias", "balanced pressure");
  const stabilityState = describeDirection(baseline.avgStability, "stable footing", "fragile footing", "mixed stability");
  const returnTone = describeDirection(baseline.avgReturn, "positive skew", "negative skew", "flat returns");

  return `RPS shows ${returnTone} under ${pressureTrend} and ${stabilityState}; best return ${formatNumber(bestReturn)}, worst return ${formatNumber(worstReturn)}, highlighting the current spread.`;
};

export const generateLearningRecoverySummary = (
  learning: LearningMetrics,
  hygiene: ReturnHygiene,
): string => {
  if (!Number.isFinite(learning.winRate) || !Number.isFinite(hygiene.decisionDebt)) {
    return "Learning and recovery signals will appear once this window logs enough decisions to measure consistency, recovery, and debt.";
  }

  const lciTone = describeDirection((learning.lci ?? 0) - 0.6, "strong LCI", "weaker LCI", "steady LCI");
  const winTone = describeDirection(learning.winRate - 50, "above-average win rate", "sub-50% win rate", "balanced win rate");

  return `Recovery profile shows ${lciTone} with ${winTone}; average ${formatNumber(learning.decisionsToRecover, 1)} decisions to recover and decision debt of ${formatNumber(hygiene.decisionDebt)}% negative returns.`;
};

export const generateCategorySummary = (categories: CategoryHeatmapRow[]): string => {
  if (!categories.length)
    return "No category heatmap is available because this window currently has zero logged decisions to analyze.";

  const sortedByVolume = [...categories].sort((a, b) => b.decisionCount - a.decisionCount);
  const topCategories = sortedByVolume.slice(0, 2).map((c) => c.category).join(" and ");
  const bestDnav = [...categories].sort((a, b) => b.avgDnav - a.avgDnav)[0];
  const worstDnav = [...categories].sort((a, b) => a.avgDnav - b.avgDnav)[0];
  const dominantVariable = [...categories]
    .map((c) => c.dominantVariable)
    .reduce<Record<string, number>>((acc, variable) => {
      acc[variable] = (acc[variable] || 0) + 1;
      return acc;
    }, {});
  const commonDominant = Object.entries(dominantVariable).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Impact";

  return `${topCategories} carry most activity; ${bestDnav?.category} leads D-NAV, ${worstDnav?.category} lags, and ${commonDominant} is the most common driver.`;
};

export const generateArchetypeSummary = (archetypes: ArchetypePatterns): string => {
  if (!archetypes.rows.length)
    return "Archetype patterns will surface once more decisions are logged in this window to establish clear behavioral clusters.";

  const bestArchetype = [...archetypes.rows].sort((a, b) => b.avgDnav - a.avgDnav)[0];
  const weakestArchetype = [...archetypes.rows].sort((a, b) => a.avgDnav - b.avgDnav)[0];
  const categoryNote = bestArchetype?.topCategories?.[0] ?? "your top categories";

  return `${archetypes.primary} dominates, with ${bestArchetype.archetype} producing the strongest D-NAV across ${categoryNote}, while ${weakestArchetype.archetype} remains the soft spot.`;
};
