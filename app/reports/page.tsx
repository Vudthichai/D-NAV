"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import DatasetSelect from "@/components/DatasetSelect";
import SystemComparePanel from "@/components/SystemComparePanel";
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
import {
  buildCompanyPeriodSnapshot,
  CompanyPeriodSnapshot,
  FullInterpretation,
  generateFullInterpretation,
} from "@/lib/dnavSummaryEngine";
import { getDatasetMeta, REPORT_DATASETS, type DatasetId } from "@/lib/reportDatasets";
import { loadSnapshotForDataset } from "@/lib/reportSnapshot";
import { useDataset } from "@/components/DatasetProvider";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import {
  TIMEFRAMES,
  timeframeDescriptions,
  type TimeframeValue,
  useReportsData,
} from "@/hooks/useReportsData";
import { type DecisionEntry } from "@/lib/storage";
import { cn } from "@/lib/utils";
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
  const { datasetId } = useDataset();
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeValue>(resolvedTimeframe);
  const [datasetAId, setDatasetAId] = useState<DatasetId>(datasetId);
  const [datasetBId, setDatasetBId] = useState<DatasetId>("apple-2020-2025");
  const [snapshotA, setSnapshotA] = useState<CompanyPeriodSnapshot | null>(null);
  const [snapshotB, setSnapshotB] = useState<CompanyPeriodSnapshot | null>(null);
  const { isLoggedIn, openLogin } = useNetlifyIdentity();

  const datasetOptions = useMemo(
    () => REPORT_DATASETS.map((dataset) => ({ value: dataset.id, label: dataset.displayLabel })),
    [],
  );

  useEffect(() => {
    setSelectedTimeframe(resolvedTimeframe);
  }, [resolvedTimeframe]);

  useEffect(() => {
    setDatasetAId(datasetId);
  }, [datasetId]);

  useEffect(() => {
    let cancelled = false;
    loadSnapshotForDataset(datasetAId).then((snapshot) => {
      if (!cancelled) setSnapshotA(snapshot);
    });

    return () => {
      cancelled = true;
    };
  }, [datasetAId]);

  useEffect(() => {
    let cancelled = false;
    loadSnapshotForDataset(datasetBId).then((snapshot) => {
      if (!cancelled) setSnapshotB(snapshot);
    });

    return () => {
      cancelled = true;
    };
  }, [datasetBId]);

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

  const datasetAMeta = useMemo(() => getDatasetMeta(datasetAId), [datasetAId]);
  const datasetBMeta = useMemo(() => getDatasetMeta(datasetBId), [datasetBId]);

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

            {/* System-level compare */}
            <section className="no-print mt-10 space-y-4 print:hidden">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">System A</p>
                  <p className="text-xs text-muted-foreground">{datasetAMeta.displayLabel}</p>
                  <div className="mt-2">
                    <Select value={datasetAId} onValueChange={(value) => setDatasetAId(value as DatasetId)}>
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">System B</p>
                  <p className="text-xs text-muted-foreground">{datasetBMeta.displayLabel}</p>
                  <div className="mt-2">
                    <Select value={datasetBId} onValueChange={(value) => setDatasetBId(value as DatasetId)}>
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
              </div>

              {snapshotA && snapshotB ? (
                <SystemComparePanel
                  left={snapshotA}
                  right={snapshotB}
                  labelA={datasetAMeta.displayLabel}
                  labelB={datasetBMeta.displayLabel}
                />
              ) : (
                <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Unable to load comparison snapshots. Try selecting a different dataset.
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
