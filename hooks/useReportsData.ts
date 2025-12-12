"use client";

import { useEffect, useMemo, useState } from "react";

import { loadDecisionsForDataset } from "@/lib/reportSnapshot";
import { getDatasetMeta, type DatasetId } from "@/lib/reportDatasets";
import { type DecisionEntry } from "@/lib/storage";
import { type CompanyContext } from "@/types/company";
import { computeDashboardStats, type DashboardStats } from "@/utils/dashboardStats";
import {
  buildJudgmentDashboard,
  filterDecisionsByTimeframe,
  type ArchetypePatternRow,
  type CategoryHeatmapRow,
  type JudgmentDashboardData,
  type RpsBaseline as JudgmentRpsBaseline,
} from "@/utils/judgmentDashboard";

export const TIMEFRAMES = [
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
] as const;

export type TimeframeValue = (typeof TIMEFRAMES)[number]["value"];

export const timeframeDescriptions: Record<TimeframeValue, string> = {
  "7": "Focus on the last seven days of logged decisions.",
  "30": "Aggregate view across the most recent thirty days.",
  "90": "Quarter-scale perspective across the most recent ninety days.",
  all: "Complete historical view across every decision recorded.",
};

export const mapTimeframeToDays = (value: TimeframeValue): number | null => {
  if (value === "all") return null;
  return Number.parseInt(value, 10);
};

export interface ReportsDataResult {
  company: CompanyContext | null;
  baseline: JudgmentRpsBaseline;
  categories: CategoryHeatmapRow[];
  archetypes: ArchetypePatternRow[];
  learning: {
    lci: number | null;
    decisionsToRecover: number;
    winRate: number;
    decisionDebt: number;
  };
  stats: DashboardStats;
  allDecisions: DecisionEntry[];
  filteredDecisions: DecisionEntry[];
  timeframeDays: number | null;
  observedSpanDays: number | null;
  judgmentDashboard: JudgmentDashboardData;
}

export function useReportsData({
  timeframe,
  datasetId,
}: {
  timeframe: TimeframeValue;
  datasetId: DatasetId | null;
}): ReportsDataResult {
  const [decisions, setDecisions] = useState<DecisionEntry[]>([]);
  const company = useMemo<CompanyContext>(() => getDatasetMeta(datasetId).company, [datasetId]);

  useEffect(() => {
    let cancelled = false;
    loadDecisionsForDataset(datasetId).then((entries) => {
      if (!cancelled) {
        setDecisions(entries);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const timeframeDays = useMemo(() => mapTimeframeToDays(timeframe), [timeframe]);

  const observedSpanDays = useMemo(() => {
    if (decisions.length === 0) return null;
    const msInDay = 24 * 60 * 60 * 1000;
    const referenceTimestamp = decisions[0]?.ts ?? decisions[decisions.length - 1]?.ts ?? 0;
    const earliestTimestamp = decisions[decisions.length - 1]?.ts ?? referenceTimestamp;
    return Math.max((referenceTimestamp - earliestTimestamp) / msInDay, 1);
  }, [decisions]);

  const filteredDecisions = useMemo(
    () => filterDecisionsByTimeframe(decisions, timeframeDays),
    [decisions, timeframeDays],
  );

  const judgmentDashboard = useMemo(
    () => buildJudgmentDashboard(filteredDecisions, company ?? undefined),
    [filteredDecisions, company],
  );

  const stats = useMemo(
    () => computeDashboardStats(decisions, { timeframeDays }),
    [decisions, timeframeDays],
  );

  const baseline = judgmentDashboard.baseline;

  const categories = useMemo(() => judgmentDashboard.categories, [judgmentDashboard.categories]);

  const archetypes = useMemo(
    () => judgmentDashboard.archetypes.rows,
    [judgmentDashboard.archetypes.rows],
  );

  const learning = useMemo(
    () => ({
      lci: judgmentDashboard.learning?.lci ?? 0,
      decisionsToRecover: judgmentDashboard.learning?.decisionsToRecover ?? 0,
      winRate: judgmentDashboard.learning?.winRate ?? 0,
      decisionDebt: judgmentDashboard.hygiene?.decisionDebt ?? 0,
    }),
    [judgmentDashboard.hygiene?.decisionDebt, judgmentDashboard.learning],
  );

  return {
    company,
    baseline,
    categories,
    archetypes,
    learning,
    stats,
    allDecisions: decisions,
    filteredDecisions,
    timeframeDays,
    observedSpanDays,
    judgmentDashboard,
  };
}
