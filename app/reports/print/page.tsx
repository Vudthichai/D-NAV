"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ReportPrintView } from "@/components/reports/ReportPrintView";
import { useDataset } from "@/components/DatasetProvider";
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
  const isPdfRender = useMemo(() => searchParams.get("render") === "pdf", [searchParams]);
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
        .slice(0, 3),
    [categoryProfile],
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
    if (isPdfRender) return;

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
  }, [isPdfRender, stats.totalDecisions]);

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
