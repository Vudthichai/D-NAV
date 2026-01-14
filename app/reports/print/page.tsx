"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ReportPrintView } from "@/components/reports/ReportPrintView";
import { useDataset } from "@/components/DatasetProvider";
import { getCategoryActionInsight } from "@/lib/categoryActionInsight";
import {
  buildCompanyPeriodSnapshot,
  type CompanyPeriodSnapshot,
  generateFullInterpretation,
} from "@/lib/dnavSummaryEngine";
import {
  TIMEFRAMES,
  type TimeframeValue,
  useReportsData,
} from "@/hooks/useReportsData";
import { type DatasetId } from "@/types/dataset";

function PrintReportPageContent() {
  const searchParams = useSearchParams();
  const queryTimeframe = useMemo(() => searchParams.get("window"), [searchParams]);
  const queryDataset = useMemo(() => searchParams.get("dataset"), [searchParams]);
  const resolvedTimeframe = useMemo<TimeframeValue>(
    () =>
      TIMEFRAMES.some(({ value }) => value === queryTimeframe)
        ? (queryTimeframe as TimeframeValue)
        : "all",
    [queryTimeframe],
  );
  const { activeDatasetId, datasets } = useDataset();
  const resolvedDatasetId = useMemo<DatasetId | null>(() => {
    if (queryDataset && datasets.some((dataset) => dataset.id === queryDataset)) {
      return queryDataset as DatasetId;
    }
    return activeDatasetId ?? datasets[0]?.id ?? null;
  }, [activeDatasetId, datasets, queryDataset]);

  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeValue>(resolvedTimeframe);
  const hasPrintedRef = useRef(false);

  useEffect(() => {
    setSelectedTimeframe(resolvedTimeframe);
  }, [resolvedTimeframe]);

  const {
    company,
    baseline,
    categories,
    archetypes,
    learning,
    stats,
    filteredDecisions,
  } = useReportsData({ timeframe: selectedTimeframe, datasetId: resolvedDatasetId });

  const timeframeConfig = useMemo(
    () => TIMEFRAMES.find((timeframe) => timeframe.value === selectedTimeframe) ?? TIMEFRAMES[0],
    [selectedTimeframe],
  );

  const mapSegmentsToDistribution = (segments: { metricKey: string; value: number }[]) => {
    const positive = segments.find((segment) => segment.metricKey === "positive")?.value ?? 0;
    const neutral = segments.find((segment) => segment.metricKey === "neutral")?.value ?? 0;
    const negative = segments.find((segment) => segment.metricKey === "negative")?.value ?? 0;
    return { positive, neutral, negative };
  };

  const baselineDistributions = useMemo(() => {
    return {
      returnDistribution: mapSegmentsToDistribution(baseline.returnSegments),
      pressureDistribution: mapSegmentsToDistribution(baseline.pressureSegments),
      stabilityDistribution: mapSegmentsToDistribution(baseline.stabilitySegments),
    };
  }, [baseline.pressureSegments, baseline.returnSegments, baseline.stabilitySegments]);

  const categoryProfile = useMemo(
    () =>
      categories.map((category) => ({
        name: category.category,
        decisionCount: category.decisionCount,
        share: category.percent ?? 0,
        avgDnav: category.avgDnav,
        avgR: category.avgR,
        avgP: category.avgP,
        avgS: category.avgS,
        dominantFactor: category.dominantVariable,
      })),
    [categories],
  );

  const categoryInsightMap = useMemo(() => {
    const totals = new Map<
      string,
      { count: number; returnNeg: number; pressureHigh: number; stabilityNeg: number }
    >();

    filteredDecisions.forEach((decision) => {
      const key = decision.category ?? "Uncategorized";
      const entry = totals.get(key) ?? { count: 0, returnNeg: 0, pressureHigh: 0, stabilityNeg: 0 };
      entry.count += 1;
      if (decision.return < 0) entry.returnNeg += 1;
      if (decision.pressure > 0) entry.pressureHigh += 1;
      if (decision.stability < 0) entry.stabilityNeg += 1;
      totals.set(key, entry);
    });

    const distribution = new Map<
      string,
      { returnNegPct: number; pressureHighPct: number; stabilityNegPct: number }
    >();

    totals.forEach((entry, key) => {
      const total = Math.max(entry.count, 1);
      distribution.set(key, {
        returnNegPct: (entry.returnNeg / total) * 100,
        pressureHighPct: (entry.pressureHigh / total) * 100,
        stabilityNegPct: (entry.stabilityNeg / total) * 100,
      });
    });

    return distribution;
  }, [filteredDecisions]);

  const archetypeProfile = useMemo(() => archetypes, [archetypes]);

  const learningStats = useMemo(
    () => ({
      lci: learning.lci ?? 0,
      decisionsToRecover: learning.decisionsToRecover ?? 0,
      winRate: learning.winRate ?? 0,
      decisionDebt: learning.decisionDebt ?? 0,
    }),
    [learning.decisionDebt, learning.decisionsToRecover, learning.lci, learning.winRate],
  );

  const snapshot = useMemo<CompanyPeriodSnapshot>(() => {
    return buildCompanyPeriodSnapshot({
      company,
      baseline,
      categories,
      archetypes,
      learning,
      timeframeKey: selectedTimeframe,
      timeframeLabel: timeframeConfig.label,
    });
  }, [archetypes, baseline, categories, company, learning, selectedTimeframe, timeframeConfig.label]);

  const interpretation = useMemo(() => generateFullInterpretation(snapshot), [snapshot]);

  const topCategories = useMemo(
    () =>
      [...categoryProfile]
        .sort((a, b) => b.decisionCount - a.decisionCount)
        .slice(0, 3)
        .map((category) => {
          const distribution = categoryInsightMap.get(category.name);
          const insight = getCategoryActionInsight({
            count: category.decisionCount,
            avgR: category.avgR,
            avgP: category.avgP,
            avgS: category.avgS,
            returnNegPct: distribution?.returnNegPct ?? 0,
            pressureHighPct: distribution?.pressureHighPct ?? 0,
            stabilityNegPct: distribution?.stabilityNegPct ?? 0,
          });

          return {
            ...category,
            insight,
          };
        }),
    [categoryInsightMap, categoryProfile],
  );

  const sortedArchetypes = useMemo(
    () => [...archetypeProfile].sort((a, b) => b.count - a.count),
    [archetypeProfile],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `${snapshot.companyName} - Decision Orbit ${snapshot.periodLabel}`;
  }, [snapshot.companyName, snapshot.periodLabel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasPrintedRef.current) return;

    const timer = window.setTimeout(() => {
      hasPrintedRef.current = true;
      window.print();
    }, 300);

    const handleAfterPrint = () => {
      window.close();
    };
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [stats.totalDecisions]);

  return (
    <div className="print-page bg-white">
      <ReportPrintView
        snapshot={snapshot}
        interpretation={interpretation}
        baselineDistributions={baselineDistributions}
        topCategories={topCategories}
        sortedArchetypes={sortedArchetypes}
        learningStats={learningStats}
      />
    </div>
  );
}

export default function PrintReportPage() {
  return (
    <Suspense fallback={<div>Loading report…</div>}>
      <PrintReportPageContent />
    </Suspense>
  );
}
