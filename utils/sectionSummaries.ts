import { type ArchetypePatterns, type CategoryHeatmapRow, type LearningMetrics, type RpsBaseline, type ReturnHygiene } from "./judgmentDashboard";

const formatNumber = (value: number, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : "0");

const describeDirection = (value: number, positive: string, negative: string, neutral: string) => {
  if (value > 0.1) return positive;
  if (value < -0.1) return negative;
  return neutral;
};

export const getRpsSummary = (baseline: RpsBaseline): string => {
  if (!baseline.total) {
    return "No decisions fall within this window yet, so the RPS baseline needs more entries before trends become reliable.";
  }

  const bestReturn = baseline.bestWorst.find((item) => item.label === "Best Return")?.value ?? 0;
  const worstReturn = baseline.bestWorst.find((item) => item.label === "Worst Return")?.value ?? 0;
  const pressureTone = describeDirection(baseline.avgPressure, "pressure tilts higher", "pressure stays calm", "pressure is balanced");
  const stabilityTone = describeDirection(baseline.avgStability, "stability leans positive", "stability leans fragile", "stability is mixed");

  return `Baseline covers ${baseline.total} decisions; average return ${formatNumber(baseline.avgReturn)} with ${pressureTone} and ${stabilityTone}. Best return ${formatNumber(bestReturn)}, worst ${formatNumber(worstReturn)}.`;
};

export const getLearningRecoverySummary = (learning: LearningMetrics, hygiene: ReturnHygiene): string => {
  if (!Number.isFinite(learning.winRate) || !Number.isFinite(hygiene.decisionDebt)) {
    return "Learning and recovery signals activate once this window logs enough decisions to measure win rate, recovery pace, and decision debt.";
  }

  const lciTone = describeDirection((learning.lci ?? 0) - 0.6, "LCI trends strong", "LCI trends softer", "LCI holds steady");
  const winTone = describeDirection(learning.winRate - 50, "win rate above midline", "win rate below midline", "win rate near even");

  return `${lciTone} with ${winTone}; recoveries average ${formatNumber(learning.decisionsToRecover, 1)} decisions and ${formatNumber(hygiene.decisionDebt)}% of calls produced negative return.`;
};

export const getCategorySummary = (categories: CategoryHeatmapRow[]): string => {
  if (!categories.length) {
    return "No category heatmap is available because this window currently has zero logged decisions to analyze.";
  }

  const sortedByVolume = [...categories].sort((a, b) => b.decisionCount - a.decisionCount);
  const topCategories = sortedByVolume
    .slice(0, 2)
    .map((c) => c.category)
    .join(" and ");
  const bestDnav = [...categories].sort((a, b) => b.avgDnav - a.avgDnav)[0];
  const weakestDnav = [...categories].sort((a, b) => a.avgDnav - b.avgDnav)[0];
  const dominantVariable = [...categories]
    .map((c) => c.dominantVariable)
    .reduce<Record<string, number>>((acc, variable) => {
      acc[variable] = (acc[variable] || 0) + 1;
      return acc;
    }, {});
  const commonDominant = Object.entries(dominantVariable).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Impact";

  return `${topCategories} carry most logged activity; ${bestDnav?.category} leads D-NAV while ${weakestDnav?.category} trails, and ${commonDominant} most often drives category weightings.`;
};

export const getArchetypeSummary = (archetypes: ArchetypePatterns): string => {
  if (!archetypes.rows.length) {
    return "Archetype patterns will surface once more decisions are logged in this window to establish clear behavioral clusters.";
  }

  const bestArchetype = [...archetypes.rows].sort((a, b) => b.avgDnav - a.avgDnav)[0];
  const weakestArchetype = [...archetypes.rows].sort((a, b) => a.avgDnav - b.avgDnav)[0];
  const categoryNote = bestArchetype?.topCategories?.[0] ?? "top categories";

  return `${archetypes.primary} leads frequency; ${bestArchetype.archetype} posts the strongest D-NAV across ${categoryNote}, while ${weakestArchetype.archetype} remains the lowest-performing cluster.`;
};
