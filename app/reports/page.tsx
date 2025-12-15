"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import DatasetSelect from "@/components/DatasetSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { runComparison, type CompareMode, type VelocityTarget, type CohortSpec } from "@/lib/compare/compareEngine";
import { type NormalizationBasis, type VelocityGoalType, type CompareResult } from "@/lib/compare/types";
import {
  buildCompanyPeriodSnapshot,
  CompanyPeriodSnapshot,
  FullInterpretation,
  generateFullInterpretation,
} from "@/lib/dnavSummaryEngine";
import { useDataset } from "@/components/DatasetProvider";
import { type DatasetId, type DatasetState } from "@/types/dataset";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import {
  TIMEFRAMES,
  mapTimeframeToDays,
  timeframeDescriptions,
  type TimeframeValue,
  useReportsData,
} from "@/hooks/useReportsData";
import { type DecisionEntry } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { filterDecisionsByTimeframe } from "@/utils/judgmentDashboard";
import { FileDown } from "lucide-react";
import * as XLSX from "xlsx";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const buildDecisionRows = (decisions: DecisionEntry[]) =>
  decisions.map((decision) => ({
    Date: new Date(decision.ts).toLocaleDateString(),
    Name: decision.name,
    Category: decision.category,
    Impact: decision.impact,
    Cost: decision.cost,
    Risk: decision.risk,
    Urgency: decision.urgency,
    Confidence: decision.confidence,
    Return: Number(decision.return.toFixed(2)),
    Stability: Number(decision.stability.toFixed(2)),
    Pressure: Number(decision.pressure.toFixed(2)),
    Merit: Number(decision.merit.toFixed(2)),
    Energy: Number(decision.energy.toFixed(2)),
    "D-NAV": Number(decision.dnav.toFixed(2)),
  }));

const createCsvContent = (decisions: DecisionEntry[]) => {
  const headers = [
    "Date",
    "Name",
    "Category",
    "Impact",
    "Cost",
    "Risk",
    "Urgency",
    "Confidence",
    "Return",
    "Stability",
    "Pressure",
    "Merit",
    "Energy",
    "D-NAV",
  ];

  const rows = decisions.map((decision) => [
    new Date(decision.ts).toLocaleDateString(),
    decision.name,
    decision.category,
    decision.impact.toString(),
    decision.cost.toString(),
    decision.risk.toString(),
    decision.urgency.toString(),
    decision.confidence.toString(),
    decision.return.toFixed(2),
    decision.stability.toFixed(2),
    decision.pressure.toFixed(2),
    decision.merit.toFixed(2),
    decision.energy.toFixed(2),
    decision.dnav.toFixed(2),
  ]);

  const serialize = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [headers.map(serialize).join(","), ...rows.map((row) => row.map(serialize).join(","))].join("\n");
};

const normalizationLabels: Record<NormalizationBasis, string> = {
  PER_DECISION: "Per decision",
  PER_DAY: "Per day",
  PER_WEEK: "Per week",
  PER_MONTH: "Per month",
  PER_QUARTER: "Per quarter",
};

const velocityTargetFromGoal = (goalType: VelocityGoalType, normalization: NormalizationBasis): VelocityTarget => {
  switch (goalType) {
    case "STABILIZATION":
      return { goalType, metricKey: "PRESSURE", threshold: -2, direction: "LTE", normalization };
    case "ADAPTATION":
      return { goalType, metricKey: "STABILITY", threshold: 2.5, direction: "GTE", normalization };
    default:
      return { goalType, metricKey: "RETURN", threshold: 1, direction: "GTE", normalization };
  }
};

const buildCohort = (dataset: DatasetState | null, timeframe: TimeframeValue, labelFallback: string) => {
  const timeframeDays = mapTimeframeToDays(timeframe);
  const decisions = filterDecisionsByTimeframe(dataset?.decisions ?? [], timeframeDays);
  const timestamps = decisions.map((d) => d.ts);
  const startTs = timestamps.length ? Math.min(...timestamps) : Date.now();
  const endTs = timestamps.length ? Math.max(...timestamps) : Date.now();

  return {
    cohort: {
      entityId: dataset?.meta.companyName || dataset?.id || "unknown-entity",
      entityLabel: dataset?.label || labelFallback || "Entity",
      timeframe: { start: new Date(startTs).toISOString(), end: new Date(endTs).toISOString() },
    },
    decisions,
  };
};

function ReportsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTimeframe = useMemo(() => searchParams.get("window"), [searchParams]);
  const resolvedTimeframe = useMemo<TimeframeValue>(
    () =>
      TIMEFRAMES.some(({ value }) => value === queryTimeframe)
        ? (queryTimeframe as TimeframeValue)
        : "all",
    [queryTimeframe],
  );
  const { activeDatasetId: datasetId, datasets, getDatasetById } = useDataset();
  const hasAtLeastTwoDatasets = datasets.length >= 2;
  const defaultDatasetAId = datasets[0]?.id ?? null;
  const defaultDatasetBId = datasets.at(1)?.id ?? null;
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeValue>(resolvedTimeframe);
  const [datasetAId, setDatasetAId] = useState<DatasetId | null>(defaultDatasetAId);
  const [datasetBId, setDatasetBId] = useState<DatasetId | null>(defaultDatasetBId);
  const [compareMode, setCompareMode] = useState<CompareMode>("ENTITY");
  const [compareTimeframeA, setCompareTimeframeA] = useState<TimeframeValue>("30");
  const [compareTimeframeB, setCompareTimeframeB] = useState<TimeframeValue>("30");
  const [velocityGoal, setVelocityGoal] = useState<VelocityGoalType>("VALUE_CREATION");
  const [normalizationBasis, setNormalizationBasis] = useState<NormalizationBasis>("PER_DECISION");
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const { isLoggedIn, openLogin } = useNetlifyIdentity();

  const datasetOptions = useMemo(
    () =>
      datasets.map((dataset) => ({
        value: dataset.id,
        label: dataset.label,
      })),
    [datasets],
  );
  const datasetLabelMap = useMemo(() => new Map(datasetOptions.map((option) => [option.value, option.label])), [
    datasetOptions,
  ]);

  const resolveDatasetLabel = (id: DatasetId | null) => {
    if (!id) return "";
    const mapped = datasetLabelMap.get(id);
    if (mapped) return mapped;
    const index = datasets.findIndex((dataset) => dataset.id === id);
    return index >= 0 ? datasets[index]?.label ?? "" : "";
  };

  const datasetALabel = resolveDatasetLabel(datasetAId);
  const datasetBLabel = resolveDatasetLabel(datasetBId);

  useEffect(() => {
    setSelectedTimeframe(resolvedTimeframe);
  }, [resolvedTimeframe]);

  useEffect(() => {
    setCompareTimeframeA(selectedTimeframe);
    setCompareTimeframeB(selectedTimeframe);
  }, [selectedTimeframe]);

  useEffect(() => {
    setDatasetAId(datasetId ?? defaultDatasetAId);
  }, [datasetId, defaultDatasetAId]);

  useEffect(() => {
    if (datasetAId && !datasets.some((dataset) => dataset.id === datasetAId)) {
      setDatasetAId(datasets[0]?.id ?? null);
    }
    if (datasetBId && !datasets.some((dataset) => dataset.id === datasetBId)) {
      setDatasetBId(datasets.at(1)?.id ?? null);
    }
  }, [datasetAId, datasetBId, datasets]);

  const datasetA = useMemo(() => getDatasetById(datasetAId) ?? null, [datasetAId, getDatasetById]);
  const datasetB = useMemo(() => getDatasetById(datasetBId) ?? null, [datasetBId, getDatasetById]);

  const {
    company,
    baseline,
    categories,
    archetypes,
    learning,
    stats,
    allDecisions,
  } = useReportsData({ timeframe: selectedTimeframe, datasetId });

  const timeframeConfig = useMemo(
    () => TIMEFRAMES.find((timeframe) => timeframe.value === selectedTimeframe) ?? TIMEFRAMES[0],
    [selectedTimeframe],
  );

  const hasData = stats.totalDecisions > 0;

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

  const handleUpdateTimeframe = (value: TimeframeValue) => {
    setSelectedTimeframe(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("window", value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleSignInClick = () => {
    openLogin();
  };

  const handleBookAuditClick = () => {
    if (typeof window === "undefined") return;
    window.location.href = "/contact";
  };

  const handleExportCsv = () => {
    if (!isLoggedIn || allDecisions.length === 0) return;
    const csvContent = createCsvContent(allDecisions);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const filename = `dnav-decision-log-${slugify(timeframeConfig.label)}.csv`;
    downloadBlob(blob, filename);
  };

  const handleExportExcel = () => {
    if (!isLoggedIn || allDecisions.length === 0) return;
    const rows = buildDecisionRows(allDecisions);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Decisions");
    const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const filename = `dnav-decision-log-${slugify(timeframeConfig.label)}.xlsx`;
    downloadBlob(blob, filename);
  };

  // Use the browser print dialog to export the report view.
  const handlePrint = () => {
    if (typeof window === "undefined") return;

    const filename = `${snapshot.companyName} - Decision Orbit ${snapshot.periodLabel}.pdf`;

    document.title = filename;
    window.print();
  };

  const handleRunCompare = () => {
    const placeholderCohort: CohortSpec = {
      entityId: "unknown",
      entityLabel: "",
      timeframe: { start: new Date().toISOString(), end: new Date().toISOString() },
    };
    const datasetForA = datasetA;
    const datasetForB = compareMode === "TEMPORAL" ? datasetA : datasetB;

    if (!datasetForA || !datasetForB) {
      setCompareResult({
        mode: compareMode,
        cohortA: datasetForA ? buildCohort(datasetForA, compareTimeframeA, datasetALabel).cohort : placeholderCohort,
        cohortB: datasetForB ? buildCohort(datasetForB, compareTimeframeB, datasetBLabel).cohort : placeholderCohort,
        summaryA: null,
        summaryB: null,
        delta: null,
        failureModes: [],
        explainability: { question: "", contractLine: "", methodBullets: [], resultHeadline: "" },
        warnings: [],
        errors: ["Select both cohorts before running a comparison."],
      });
      return;
    }

    const timeframeForA = compareTimeframeA;
    const timeframeForB = compareMode === "ENTITY" ? compareTimeframeA : compareTimeframeB;
    const cohortAInput = buildCohort(datasetForA, timeframeForA, datasetALabel);
    const cohortBInput = buildCohort(datasetForB, timeframeForB, datasetBLabel || datasetALabel);

    const velocityTarget =
      compareMode === "VELOCITY" ? velocityTargetFromGoal(velocityGoal, normalizationBasis) : undefined;

    const result = runComparison({
      mode: compareMode,
      cohortA: cohortAInput.cohort,
      cohortB: cohortBInput.cohort,
      decisionsA: cohortAInput.decisions,
      decisionsB: cohortBInput.decisions,
      velocityTarget,
    });

    setCompareResult(result);
  };

  const handleExportCompareJson = () => {
    if (!compareResult) return;
    const blob = new Blob([JSON.stringify(compareResult, null, 2)], { type: "application/json" });
    downloadBlob(blob, `compare-result-${compareMode.toLowerCase()}.json`);
  };

  return (
    <TooltipProvider>
      <div className="dn-reports-root flex flex-col gap-8">
        <section className="no-print rounded-2xl border bg-card/80 p-6 shadow-sm print:hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-3">
              <Badge variant="secondary" className="w-fit uppercase tracking-wide">
                Reports Hub
              </Badge>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold">Share decision intelligence</h1>
                <p className="text-sm text-muted-foreground">Download structured decision data without leaving D-NAV.</p>
              </div>
            </div>
            <DatasetSelect label="Base dataset" />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={!isLoggedIn || allDecisions.length === 0}
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={!isLoggedIn || allDecisions.length === 0}
              >
                Export Excel
              </Button>
              <Button
                size="sm"
                className="bg-orange-500 text-white hover:bg-orange-600"
                onClick={handlePrint}
                disabled={!isLoggedIn || !hasData}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download report
              </Button>
            </div>
            <div className="print:hidden text-xs text-muted-foreground">
              For best results, enable “Background Graphics” in the print dialog.
            </div>
          </div>
        </section>

        <section className="no-print flex flex-col gap-2 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-muted/60 pb-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeframe</p>
              <p className="text-sm text-muted-foreground">{timeframeDescriptions[selectedTimeframe]}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={selectedTimeframe === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleUpdateTimeframe(value)}
                  className={cn(
                    "rounded-full px-3 text-xs",
                    selectedTimeframe === value ? "shadow-sm" : "bg-muted/60 text-foreground",
                  )}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </section>

        <section className="relative">
          {!isLoggedIn && (
            <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
              <div className="pointer-events-auto sticky top-24 z-20 flex max-w-2xl flex-col items-center gap-4 rounded-2xl border bg-background/95 p-6 text-center shadow-lg">
                <h2 className="text-2xl font-semibold">Unlock Your Decision Reports</h2>
                <p className="text-sm text-muted-foreground">
                  Export-ready datasets are reserved for D-NAV clients. Sign in to access your reports or book a Decision Audit to get started.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={handleSignInClick}>
                    Sign In to View Reports
                  </Button>
                  <Button variant="outline" onClick={handleBookAuditClick}>
                    Book a Decision Audit
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Client dashboards and exports are available only to active teams and audit clients.
                </p>
              </div>
            </div>
          )}
          <div
            className={cn("space-y-6", !isLoggedIn && "pointer-events-none filter blur-sm opacity-50")}
          >
            <OnePageReport
              snapshot={snapshot}
              interpretation={interpretation}
              baselineDistributions={baselineDistributions}
              topCategories={topCategories}
              sortedArchetypes={sortedArchetypes}
              learningStats={learningStats}
            />

            {/* Compare workbench */}
            <section className="no-print mt-10 space-y-4 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/70 p-4 shadow-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Compare Mode</p>
                  <p className="text-xs text-muted-foreground">ENTITY · TEMPORAL · VELOCITY</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["ENTITY", "TEMPORAL", "VELOCITY"] as CompareMode[]).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={compareMode === mode ? "default" : "outline"}
                      onClick={() => setCompareMode(mode)}
                      className="rounded-full"
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              </div>

              {compareMode === "ENTITY" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Entity A</p>
                    <p className="text-xs text-muted-foreground">{datasetALabel || "Select a dataset"}</p>
                    <div className="mt-2">
                      <Select value={datasetAId ?? undefined} onValueChange={(value) => setDatasetAId(value as DatasetId)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select dataset" />
                        </SelectTrigger>
                        <SelectContent>
                          {datasetOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Entity B</p>
                    <p className="text-xs text-muted-foreground">
                      {hasAtLeastTwoDatasets ? datasetBLabel || "Select a dataset" : "Add another dataset"}
                    </p>
                    <div className="mt-2">
                      <Select
                        value={datasetBId ?? undefined}
                        onValueChange={(value) => setDatasetBId(value as DatasetId)}
                        disabled={!hasAtLeastTwoDatasets}
                      >
                        <SelectTrigger className="w-full" disabled={!hasAtLeastTwoDatasets}>
                          <SelectValue placeholder={hasAtLeastTwoDatasets ? "Select dataset" : "Need at least two datasets"} />
                        </SelectTrigger>
                        <SelectContent>
                          {datasetOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Shared timeframe</p>
                    <div className="mt-2">
                      <Select
                        value={compareTimeframeA}
                        onValueChange={(value) => {
                          setCompareTimeframeA(value as TimeframeValue);
                          setCompareTimeframeB(value as TimeframeValue);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEFRAMES.map((frame) => (
                            <SelectItem key={frame.value} value={frame.value}>
                              {frame.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Hard constraint: timeframes must match.</p>
                  </div>
                </div>
              )}

              {compareMode === "TEMPORAL" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Entity</p>
                    <p className="text-xs text-muted-foreground">{datasetALabel || "Select a dataset"}</p>
                    <div className="mt-2">
                      <Select value={datasetAId ?? undefined} onValueChange={(value) => setDatasetAId(value as DatasetId)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select dataset" />
                        </SelectTrigger>
                        <SelectContent>
                          {datasetOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Same entity, different timeframes only.</p>
                  </div>

                  <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Window A</p>
                    <div className="mt-2">
                      <Select value={compareTimeframeA} onValueChange={(value) => setCompareTimeframeA(value as TimeframeValue)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEFRAMES.map((frame) => (
                            <SelectItem key={frame.value} value={frame.value}>
                              {frame.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Window B</p>
                    <div className="mt-2">
                      <Select value={compareTimeframeB} onValueChange={(value) => setCompareTimeframeB(value as TimeframeValue)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEFRAMES.map((frame) => (
                            <SelectItem key={frame.value} value={frame.value}>
                              {frame.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {compareMode === "VELOCITY" && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cohort A</p>
                      <p className="text-xs text-muted-foreground">{datasetALabel || "Select a dataset"}</p>
                      <div className="mt-2">
                        <Select value={datasetAId ?? undefined} onValueChange={(value) => setDatasetAId(value as DatasetId)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select dataset" />
                          </SelectTrigger>
                          <SelectContent>
                            {datasetOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cohort B</p>
                      <p className="text-xs text-muted-foreground">
                        {hasAtLeastTwoDatasets ? datasetBLabel || "Select a dataset" : "Add another dataset"}
                      </p>
                      <div className="mt-2">
                        <Select
                          value={datasetBId ?? undefined}
                          onValueChange={(value) => setDatasetBId(value as DatasetId)}
                          disabled={!hasAtLeastTwoDatasets}
                        >
                          <SelectTrigger className="w-full" disabled={!hasAtLeastTwoDatasets}>
                            <SelectValue placeholder={hasAtLeastTwoDatasets ? "Select dataset" : "Need at least two datasets"} />
                          </SelectTrigger>
                          <SelectContent>
                            {datasetOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Goal type</p>
                      <div className="mt-2">
                        <Select value={velocityGoal} onValueChange={(value) => setVelocityGoal(value as VelocityGoalType)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select goal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="VALUE_CREATION">Value creation</SelectItem>
                            <SelectItem value="STABILIZATION">Stabilization</SelectItem>
                            <SelectItem value="ADAPTATION">Adaptation</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">Target metric auto-selected.</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Timeframe A</p>
                      <div className="mt-2">
                        <Select value={compareTimeframeA} onValueChange={(value) => setCompareTimeframeA(value as TimeframeValue)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select timeframe" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEFRAMES.map((frame) => (
                              <SelectItem key={frame.value} value={frame.value}>
                                {frame.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Timeframe B</p>
                      <div className="mt-2">
                        <Select value={compareTimeframeB} onValueChange={(value) => setCompareTimeframeB(value as TimeframeValue)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select timeframe" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEFRAMES.map((frame) => (
                              <SelectItem key={frame.value} value={frame.value}>
                                {frame.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">Velocity allows unequal timeframes.</p>
                    </div>

                    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Normalization</p>
                      <div className="mt-2">
                        <Select
                          value={normalizationBasis}
                          onValueChange={(value) => setNormalizationBasis(value as NormalizationBasis)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select basis" />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(normalizationLabels) as NormalizationBasis[]).map((basis) => (
                              <SelectItem key={basis} value={basis}>
                                {normalizationLabels[basis]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleRunCompare} variant="default" size="sm">
                  Run comparison
                </Button>
                <Button onClick={handleExportCompareJson} variant="outline" size="sm" disabled={!compareResult}>
                  Export Compare JSON
                </Button>
              </div>

              {compareResult ? (
                <div className="space-y-3 rounded-2xl border bg-muted/40 p-4">
                  {compareResult.errors && compareResult.errors.length > 0 ? (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                      <p className="font-semibold">Comparison blocked</p>
                      <ul className="list-disc space-y-1 pl-4">
                        {compareResult.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Layer 1 · Question
                        </p>
                        <p className="text-sm">{compareResult.explainability.question}</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layer 2 · Contract</p>
                        <p className="text-sm text-muted-foreground">{compareResult.explainability.contractLine}</p>
                        <details className="rounded-md border bg-card/50 p-3 text-sm">
                          <summary className="cursor-pointer font-semibold">Layer 3 · How this is measured</summary>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                            {compareResult.explainability.methodBullets.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </details>
                        <div className="rounded-md bg-primary/10 p-3 text-sm font-semibold text-primary">
                          Layer 4 · {compareResult.explainability.resultHeadline}
                        </div>
                      </div>

                      {compareResult.warnings && compareResult.warnings.length > 0 && (
                        <div className="rounded-md border border-amber-300/60 bg-amber-100/60 p-3 text-sm text-amber-900">
                          <p className="font-semibold">Warnings</p>
                          <ul className="list-disc space-y-1 pl-4">
                            {compareResult.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {compareResult.summaryA && compareResult.summaryB && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border bg-background/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cohort A</p>
                            <p className="text-sm">{compareResult.cohortA.entityLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              Avg D-NAV {compareResult.summaryA.avgDnav.toFixed(2)} · R {compareResult.summaryA.avgReturn.toFixed(2)} · P {" "}
                              {compareResult.summaryA.avgPressure.toFixed(2)} · S {compareResult.summaryA.avgStability.toFixed(2)}
                            </p>
                          </div>
                          <div className="rounded-lg border bg-background/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cohort B</p>
                            <p className="text-sm">{compareResult.cohortB.entityLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              Avg D-NAV {compareResult.summaryB.avgDnav.toFixed(2)} · R {compareResult.summaryB.avgReturn.toFixed(2)} · P {" "}
                              {compareResult.summaryB.avgPressure.toFixed(2)} · S {compareResult.summaryB.avgStability.toFixed(2)}
                            </p>
                          </div>
                          <div className="rounded-lg border bg-background/60 p-3 md:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deltas (A - B)</p>
                            <p className="text-sm text-muted-foreground">
                              D-NAV {compareResult.delta.avgDnav.toFixed(2)} · Return {compareResult.delta.avgReturn.toFixed(2)} · Pressure {" "}
                              {compareResult.delta.avgPressure.toFixed(2)} · Stability {compareResult.delta.avgStability.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      )}

                      {compareResult.velocity && (
                        <div className="rounded-lg border bg-background/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Velocity</p>
                          <p className="text-sm font-semibold">{compareResult.velocity.comparisonLine}</p>
                          <p className="text-xs text-muted-foreground">
                            Target: {compareResult.velocity.target.metricKey} {compareResult.velocity.target.direction} {compareResult.velocity.target.threshold} ({
                              normalizationLabels[compareResult.velocity.target.normalization]
                            })
                          </p>
                        </div>
                      )}

                      {compareResult.decisionTerrain && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border bg-background/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category terrain</p>
                            <p className="text-sm font-semibold">Top increases in B</p>
                            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                              {compareResult.decisionTerrain.topIncreases.map((row) => (
                                <li key={row.category}>
                                  {row.category} (+{(row.deltaWeight * 100).toFixed(1)} pp)
                                </li>
                              ))}
                              {compareResult.decisionTerrain.topIncreases.length === 0 && <li>No increases.</li>}
                            </ul>
                            <p className="mt-2 text-sm font-semibold">New in B</p>
                            <p className="text-xs text-muted-foreground">
                              {compareResult.decisionTerrain.newInB.length > 0
                                ? compareResult.decisionTerrain.newInB.join(", ")
                                : "No new categories."}
                            </p>
                          </div>
                          <div className="rounded-lg border bg-background/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category losses</p>
                            <p className="text-sm font-semibold">Top decreases in B</p>
                            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                              {compareResult.decisionTerrain.topDecreases.map((row) => (
                                <li key={row.category}>
                                  {row.category} ({(row.deltaWeight * 100).toFixed(1)} pp)
                                </li>
                              ))}
                              {compareResult.decisionTerrain.topDecreases.length === 0 && <li>No decreases.</li>}
                            </ul>
                            <p className="mt-2 text-sm font-semibold">Missing in B</p>
                            <p className="text-xs text-muted-foreground">
                              {compareResult.decisionTerrain.missingInB.length > 0
                                ? compareResult.decisionTerrain.missingInB.join(", ")
                                : "No missing categories."}
                            </p>
                          </div>
                        </div>
                      )}

                      {compareResult.failureModes.length > 0 && (
                        <div className="rounded-lg border bg-background/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Failure modes</p>
                          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                            {compareResult.failureModes.map((mode) => (
                              <li key={mode.code}>
                                <span className="font-semibold">{mode.title}:</span> {mode.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Configure cohorts and run a comparison to see explainability layers.
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}

type BaselineDistribution = {
  positive: number;
  neutral: number;
  negative: number;
};

type BaselineDistributions = {
  returnDistribution: BaselineDistribution;
  pressureDistribution: BaselineDistribution;
  stabilityDistribution: BaselineDistribution;
};

type TopCategory = {
  name: string;
  decisionCount: number;
  share: number;
  avgDnav: number;
  avgR: number;
  avgP: number;
  avgS: number;
  dominantFactor: string | null;
};

type ArchetypeSummary = {
  archetype: string;
  avgR: number;
  avgP: number;
  avgS: number;
  count: number;
};

type LearningStats = {
  lci: number;
  decisionsToRecover: number;
  winRate: number;
  decisionDebt: number;
};

type OnePageReportProps = {
  snapshot: CompanyPeriodSnapshot;
  interpretation: FullInterpretation;
  baselineDistributions: BaselineDistributions;
  topCategories: TopCategory[];
  sortedArchetypes: ArchetypeSummary[];
  learningStats: LearningStats;
};

const formatPct = (value: number) => `${value.toFixed(1)}%`;

function OnePageReport({
  snapshot,
  interpretation,
  baselineDistributions,
  topCategories,
  sortedArchetypes,
  learningStats,
}: OnePageReportProps) {
  const { companyName, periodLabel, rpsBaseline } = snapshot;
  const { returnDistribution, pressureDistribution, stabilityDistribution } = baselineDistributions;

  const primaryArchetype = sortedArchetypes[0];
  const secondaryArchetype = sortedArchetypes[1];
  const archetypeRows = sortedArchetypes.slice(0, 4);

  const getArchetypeShare = (count: number) =>
    rpsBaseline.totalDecisions > 0 ? ((count / rpsBaseline.totalDecisions) * 100).toFixed(1) : "0.0";

  return (
    <div className="report-page space-y-6">
      <div className="report-print-page mx-auto max-w-6xl space-y-5 rounded-3xl border bg-background p-7 text-foreground shadow-sm print:max-w-none print:border-none print:bg-white print:shadow-none">
        <header className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">D-NAV Executive Readout</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {companyName} · Decision Orbit {periodLabel}
            </h1>
            <p className="text-sm text-muted-foreground">
              System-level RPS profile across {rpsBaseline.totalDecisions} logged decisions
            </p>
          </div>
          <div className="text-sm text-muted-foreground sm:text-right">
            <p className="font-medium text-foreground">R · P · S baseline · Learning · Terrain · Archetypes</p>
            <p>Executive decision intelligence view</p>
          </div>
        </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] print:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <div className="report-card rounded-2xl border bg-card/70 p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Executive Overview</p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {companyName} · Decision Orbit {periodLabel}
            </h2>
            <p className="text-sm text-muted-foreground">
              System-level RPS profile across {rpsBaseline.totalDecisions} logged decisions
            </p>
          </div>

          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">RPS Baseline — Calm, repeatable execution</h3>
              <p>{interpretation.rpsSummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Category Profile — Where judgment actually lives</h3>
              <p>{interpretation.categorySummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Archetype Profile — Behavioral fingerprint</h3>
              <p>{interpretation.archetypeSummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Learning &amp; Recovery — Decision debt &amp; correction</h3>
              <p>{interpretation.learningSummary}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="report-card rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Key Metrics Snapshot</p>
                <p className="text-xs text-muted-foreground">Period: {periodLabel}</p>
              </div>
              <span className="text-xs text-muted-foreground">R · P · S averages</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Average D-NAV</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgDnav.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Average judgment quality in this window after cost.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Avg Return (R)</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgReturn.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Net value creation per decision.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Avg Pressure (P)</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgPressure.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Execution stress posture.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Avg Stability (S)</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgStability.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">How safe decisions leave the system.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Learning Curve Index</p>
                <p className="text-lg font-semibold text-foreground">{learningStats.lci.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Recovery efficiency after dips.</p>
              </div>
            </div>
          </div>

          <div className="report-card rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Distributions (Return / Pressure / Stability)
            </p>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Return</span>
                  <span>
                    Positive {formatPct(returnDistribution.positive)} · Neutral {formatPct(returnDistribution.neutral)} · Negative {formatPct(returnDistribution.negative)}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted/60">
                  <div className="bg-emerald-500" style={{ width: `${returnDistribution.positive}%` }} />
                  <div className="bg-muted" style={{ width: `${returnDistribution.neutral}%` }} />
                  <div className="bg-rose-500" style={{ width: `${returnDistribution.negative}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Pressure</span>
                  <span>
                    Pressured {formatPct(pressureDistribution.positive)} · Neutral {formatPct(pressureDistribution.neutral)} · Calm {formatPct(pressureDistribution.negative)}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted/60">
                  <div className="bg-amber-500" style={{ width: `${pressureDistribution.positive}%` }} />
                  <div className="bg-muted" style={{ width: `${pressureDistribution.neutral}%` }} />
                  <div className="bg-sky-500" style={{ width: `${pressureDistribution.negative}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Stability</span>
                  <span>
                    Stable {formatPct(stabilityDistribution.positive)} · Neutral {formatPct(stabilityDistribution.neutral)} · Fragile {formatPct(stabilityDistribution.negative)}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted/60">
                  <div className="bg-emerald-600" style={{ width: `${stabilityDistribution.positive}%` }} />
                  <div className="bg-muted" style={{ width: `${stabilityDistribution.neutral}%` }} />
                  <div className="bg-rose-500" style={{ width: `${stabilityDistribution.negative}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="report-card rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Decision Terrain — Top Judgment Arenas
            </p>
            <h3 className="text-lg font-semibold text-foreground">Where judgment volume concentrates</h3>
          </div>
          <span className="text-xs text-muted-foreground">Top 3 categories</span>
        </div>
        <div className="mt-4 space-y-4">
          {topCategories.map((category) => (
            <div key={category.name} className="rounded-xl border border-muted/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{category.name}</span>
                <span className="text-xs text-muted-foreground">{category.decisionCount} decisions</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Share of volume</p>
                  <p className="text-sm font-semibold text-foreground">{formatPct(category.share)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Avg D-NAV</p>
                  <p className="text-sm font-semibold text-foreground">{category.avgDnav.toFixed(1)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">R / P / S</p>
                  <p className="text-sm font-semibold text-foreground">
                    {category.avgR.toFixed(1)} / {category.avgP.toFixed(1)} / {category.avgS.toFixed(1)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Dominant factor</p>
                  <p className="text-sm font-semibold text-foreground">{category.dominantFactor ?? "Balanced"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="report-card rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Archetype Fingerprint — {periodLabel}
          </p>
          <p className="text-sm text-muted-foreground">
            Primary: {primaryArchetype?.archetype ?? "N/A"} · Secondary: {secondaryArchetype?.archetype ?? "N/A"}
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Archetype</th>
                <th className="px-3 py-2 text-right font-semibold">Decisions</th>
                <th className="px-3 py-2 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/60 bg-card">
              {archetypeRows.map((entry) => (
                <tr key={entry.archetype}>
                  <td className="px-3 py-2 font-medium text-foreground">{entry.archetype}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{entry.count}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{getArchetypeShare(entry.count)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="border-t border-muted/60 pt-6">
        <section className="report-card rounded-2xl border bg-card/70 p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Decision Terrain — System Momentum
          </p>
          <h3 className="text-xl font-semibold text-foreground">{interpretation.momentumLabel}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{interpretation.momentumSummary}</p>
        </section>
      </div>
    </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div>Loading reports…</div>}>
      <ReportsPageContent />
    </Suspense>
  );
}
