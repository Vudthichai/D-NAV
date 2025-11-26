import {
  type ArchetypePatternRow,
  type ArchetypePatterns,
  type CategoryHeatmapRow,
  type LearningMetrics,
  type ReturnHygiene,
  type RpsBaseline,
} from "./judgmentDashboard";

export type Insight = {
  id: string;
  title: string;
  body: string;
  priority: number;
};

export interface InsightsInput {
  baseline: RpsBaseline;
  learning: LearningMetrics;
  hygiene: ReturnHygiene;
  categories: CategoryHeatmapRow[];
  archetypes: ArchetypePatterns;
  totalDecisions: number;
}

const RETURN_THRESHOLD = 0.5;
const PRESSURE_DRAG_THRESHOLD = -0.5;
const STABILITY_DRAG_THRESHOLD = -0.5;
const DECISION_DEBT_THRESHOLD = 0.35;
const STRONG_RECOVERY_LCI = 0.7;
const STRONG_RECOVERY_DECISIONS = 5;
const SLOW_RECOVERY_LCI = 0.4;
const SLOW_RECOVERY_DECISIONS = 8;
const CATEGORY_CONCENTRATION_THRESHOLD = 0.6;
const CATEGORY_NEGLECT_THRESHOLD = 0.02;
const CATEGORY_DNAV_THRESHOLD = 10;
const CATEGORY_RETURN_THRESHOLD = 1;
const ARCHETYPE_DOMINANCE_THRESHOLD = 0.5;
const ARCHETYPE_COUNT_MIN = 5;
const ARCHETYPE_RETURN_THRESHOLD = 1;
const ARCHETYPE_STABILITY_THRESHOLD = -1;

const asNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const normalizeShare = (percent: number) => percent / 100;

const buildPressureDrag = (avgReturn: number, avgPressure: number): Insight => ({
  id: "pressure-drag",
  title: "Pressure Drag",
  body: `Return averages ${avgReturn.toFixed(1)}, but Pressure averages ${avgPressure.toFixed(
    1,
  )}, suggesting good outcomes are being driven with a heavy execution load.`,
  priority: 90,
});

const buildStabilityDrag = (avgReturn: number, avgStability: number): Insight => ({
  id: "stability-drag",
  title: "Stability Drag",
  body: `Return averages ${avgReturn.toFixed(1)}, but Stability averages ${avgStability.toFixed(
    1,
  )}, indicating results are positive but outcomes remain shaky.`,
  priority: 85,
});

const buildDecisionDebt = (decisionDebtShare: number): Insight => ({
  id: "high-decision-debt",
  title: "High Decision Debt",
  body: `${(decisionDebtShare * 100).toFixed(
    0,
  )}% of decisions in this window produced negative Return, tilting the portfolio toward losses.`,
  priority: 80,
});

const buildStrongRecovery = (lci: number, decisionsToRecover: number): Insight => ({
  id: "strong-recovery",
  title: "Strong Recovery",
  body: `Losses are absorbed quickly, with LCI at ${lci.toFixed(2)} and recovery typically within ${decisionsToRecover.toFixed(
    1,
  )} decisions.`,
  priority: 75,
});

const buildSlowRecovery = (lci: number, decisionsToRecover: number): Insight => ({
  id: "slow-recovery",
  title: "Slow Recovery",
  body: `Recovery from losses is slow, with LCI at ${lci.toFixed(2)} and about ${decisionsToRecover.toFixed(
    1,
  )} decisions needed to regain footing.`,
  priority: 74,
});

const buildCategoryConcentration = (
  top1: CategoryHeatmapRow,
  top2: CategoryHeatmapRow,
  combinedShare: number,
): Insight => ({
  id: "category-concentration",
  title: "Category Concentration",
  body: `${top1.category} and ${top2.category} account for ${(combinedShare * 100).toFixed(
    0,
  )}% of decisions, indicating attention is heavily concentrated in a few areas.`,
  priority: 70,
});

const buildCategoryNeglect = (category: CategoryHeatmapRow): Insight => ({
  id: "category-neglect",
  title: "Category Blind Spot",
  body: `${category.category} shows strong performance (Avg D-NAV ${category.avgDnav.toFixed(
    1,
  )}), but only ${(normalizeShare(category.percent) * 100).toFixed(
    1,
  )}% of decisions focus here.`,
  priority: 68,
});

const buildArchetypeDominance = (archetype: ArchetypePatternRow, share: number): Insight => ({
  id: "archetype-dominance",
  title: "Archetype Dominance",
  body: `${archetype.archetype} drives ${(share * 100).toFixed(
    0,
  )}% of decisions, setting the tone for how calls are typically made.`,
  priority: 65,
});

const buildArchetypeInstability = (archetype: ArchetypePatternRow): Insight => ({
  id: "archetype-instability",
  title: "High-Variance Archetype",
  body: `${archetype.archetype} delivers strong upside (Avg Return ${archetype.avgR.toFixed(
    1,
  )}) but unstable outcomes (Avg Stability ${archetype.avgS.toFixed(1)}), making results more volatile when this style shows up.`,
  priority: 64,
});

export const generateInsights = (stats: InsightsInput): Insight[] => {
  const insights: Insight[] = [];

  const avgReturn = asNumber(stats.baseline.avgReturn);
  const avgPressure = asNumber(stats.baseline.avgPressure);
  const avgStability = asNumber(stats.baseline.avgStability);
  const lci = asNumber(stats.learning.lci);
  const decisionsToRecover = asNumber(stats.learning.decisionsToRecover);
  const decisionDebtShare = asNumber(stats.hygiene.decisionDebt) / 100;

  if (avgReturn > RETURN_THRESHOLD && avgPressure < PRESSURE_DRAG_THRESHOLD) {
    insights.push(buildPressureDrag(avgReturn, avgPressure));
  }

  if (avgReturn > RETURN_THRESHOLD && avgStability < STABILITY_DRAG_THRESHOLD) {
    insights.push(buildStabilityDrag(avgReturn, avgStability));
  }

  if (decisionDebtShare >= DECISION_DEBT_THRESHOLD) {
    insights.push(buildDecisionDebt(decisionDebtShare));
  }

  if (lci >= STRONG_RECOVERY_LCI && decisionsToRecover <= STRONG_RECOVERY_DECISIONS) {
    insights.push(buildStrongRecovery(lci, decisionsToRecover));
  }

  if (lci <= SLOW_RECOVERY_LCI || decisionsToRecover >= SLOW_RECOVERY_DECISIONS) {
    insights.push(buildSlowRecovery(lci, decisionsToRecover));
  }

  const sortedCategories = [...stats.categories].sort((a, b) => b.percent - a.percent);
  if (sortedCategories.length >= 2) {
    const [top1, top2] = sortedCategories;
    const combinedShare = normalizeShare(top1.percent) + normalizeShare(top2.percent);

    if (combinedShare >= CATEGORY_CONCENTRATION_THRESHOLD) {
      insights.push(buildCategoryConcentration(top1, top2, combinedShare));
    }
  }

  const neglectedCategory = stats.categories
    .filter(
      (category) =>
        normalizeShare(category.percent) <= CATEGORY_NEGLECT_THRESHOLD &&
        (category.avgDnav >= CATEGORY_DNAV_THRESHOLD || category.avgR >= CATEGORY_RETURN_THRESHOLD),
    )
    .sort((a, b) => b.avgDnav - a.avgDnav)[0];

  if (neglectedCategory) {
    insights.push(buildCategoryNeglect(neglectedCategory));
  }

  const totalArchetypeDecisions =
    stats.totalDecisions > 0
      ? stats.totalDecisions
      : stats.archetypes.rows.reduce((sum, row) => sum + row.count, 0);

  if (totalArchetypeDecisions > 0 && stats.archetypes.rows.length) {
    const sortedArchetypes = [...stats.archetypes.rows].sort((a, b) => b.count - a.count);
    const primary = sortedArchetypes[0];
    const primaryShare = primary ? primary.count / totalArchetypeDecisions : 0;

    if (primary && primaryShare >= ARCHETYPE_DOMINANCE_THRESHOLD) {
      insights.push(buildArchetypeDominance(primary, primaryShare));
    }

    const highVarianceArchetype = stats.archetypes.rows
      .filter(
        (row) =>
          row.count >= ARCHETYPE_COUNT_MIN &&
          row.avgR >= ARCHETYPE_RETURN_THRESHOLD &&
          row.avgS <= ARCHETYPE_STABILITY_THRESHOLD,
      )
      .sort((a, b) => a.avgS - b.avgS)[0];

    if (highVarianceArchetype) {
      insights.push(buildArchetypeInstability(highVarianceArchetype));
    }
  }

  const deduped = Array.from(new Map(insights.map((insight) => [insight.id, insight])).values());

  return deduped.sort((a, b) => b.priority - a.priority).slice(0, 3);
};
