import {
  type ArchetypeSummaryInput,
  type CategorySummaryInput,
  type CompanyContext,
  type CompanySummaryInput,
  type SingleArchetypeSummaryInput,
} from "@/types/company";
import { type JudgmentDashboardData } from "@/utils/judgmentDashboard";

const normalizeContext = (context?: CompanyContext): CompanyContext => ({
  companyName: context?.companyName?.trim() || "Unnamed Company",
  timeframeLabel: context?.timeframeLabel?.trim() || "Selected window",
  ticker: context?.ticker?.trim() || undefined,
  type: context?.type,
  sector: context?.sector?.trim() || undefined,
  stage: context?.stage,
  source: context?.source?.trim() || undefined,
  contextNote: context?.contextNote?.trim() || undefined,
});

export function buildCompanySummaryInput(
  data: JudgmentDashboardData & { companyContext: CompanyContext },
): CompanySummaryInput {
  const normalizedContext = normalizeContext(data.companyContext);
  const totalDecisions = data.baseline.total ?? data.normalized.length;

  const topCategories: CategorySummaryInput[] = [...data.categories]
    .sort((a, b) => b.decisionCount - a.decisionCount)
    .slice(0, 5)
    .map((category) => ({
      name: category.category,
      count: category.decisionCount,
      share: category.percent,
      avgDNAV: category.avgDnav,
    }));

  const archetypes: ArchetypeSummaryInput[] = [...data.archetypes.rows]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((row) => ({
      name: row.archetype,
      count: row.count,
      avgR: row.avgR,
      avgP: row.avgP,
      avgS: row.avgS,
      avgDNAV: row.avgDnav,
      topCategories: row.topCategories,
    }));

  return {
    company: {
      ...normalizedContext,
      totalDecisions,
      avgReturn: data.baseline.avgReturn,
      avgPressure: data.baseline.avgPressure,
      avgStability: data.baseline.avgStability,
    },
    topCategories,
    archetypes,
  };
}

export function buildArchetypeSummaryInput(
  data: JudgmentDashboardData & { companyContext: CompanyContext },
  archetypeName: string,
): SingleArchetypeSummaryInput {
  const normalizedContext = normalizeContext(data.companyContext);
  const archetype = data.archetypes.rows.find((row) => row.archetype === archetypeName);

  const fallback: ArchetypeSummaryInput = {
    name: archetypeName,
    count: archetype?.count ?? 0,
    avgR: archetype?.avgR ?? 0,
    avgP: archetype?.avgP ?? 0,
    avgS: archetype?.avgS ?? 0,
    avgDNAV: archetype?.avgDnav ?? 0,
    topCategories: archetype?.topCategories ?? [],
  };

  const sampleTitles = data.normalized
    .filter((decision) => decision.archetype === archetypeName)
    .slice(0, 5)
    .map((decision) => decision.title || decision.id);

  return {
    company: normalizedContext,
    archetype: fallback,
    sampleTitles,
  };
}
