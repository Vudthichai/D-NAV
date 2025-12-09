"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import SystemComparePanel from "@/components/SystemComparePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  buildCompanyPeriodSnapshot,
  CompanyPeriodSnapshot,
  FullInterpretation,
  generateFullInterpretation,
} from "@/lib/dnavSummaryEngine";
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
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeValue>(resolvedTimeframe);
  const { isLoggedIn, openLogin } = useNetlifyIdentity();
  const reportRef = useRef<HTMLDivElement | null>(null);

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
  } = useReportsData({ timeframe: selectedTimeframe });

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

  const dataHighlight = hasData
    ? `Exports ${stats.totalDecisions} decision${stats.totalDecisions === 1 ? "" : "s"} with full variables, returns, stability, pressure, and D-NAV.`
    : "No decisions logged in this window yet.";

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
    if (!isLoggedIn || filteredDecisions.length === 0) return;
    const csvContent = createCsvContent(filteredDecisions);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const filename = `dnav-decision-log-${slugify(timeframeConfig.label)}.csv`;
    downloadBlob(blob, filename);
  };

  const handleExportExcel = () => {
    if (!isLoggedIn || filteredDecisions.length === 0) return;
    const rows = buildDecisionRows(filteredDecisions);
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
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <TooltipProvider>
      <div className="dn-reports-root flex flex-col gap-8">
        <section className="rounded-2xl border bg-card/80 p-6 shadow-sm no-print print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Badge variant="secondary" className="w-fit uppercase tracking-wide">
              Reports Hub
            </Badge>
            <div className="flex flex-1 flex-col gap-3">
              <h1 className="text-3xl font-semibold">Export ready-to-share intelligence</h1>
              <p className="text-sm text-muted-foreground">Download structured decision data without leaving D-NAV.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
              Download report
            </Button>
          </div>
        </section>

        <section className="no-print flex flex-col gap-4 rounded-2xl border bg-card/80 p-6 shadow-sm print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Filter by timeframe</h2>
              <p className="text-xs text-muted-foreground">{timeframeDescriptions[selectedTimeframe]}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={selectedTimeframe === value ? "default" : "outline"}
                  onClick={() => handleUpdateTimeframe(value)}
                  className={cn("px-4", selectedTimeframe === value ? "shadow-sm" : "bg-muted/60")}
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
            ref={reportRef}
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

            <section className="no-print space-y-6 print:hidden">
              <div>
                <h2 className="text-lg font-semibold">Exports</h2>
                <p className="text-sm text-muted-foreground">
                  Download the full decision log for your chosen timeframe.
                </p>
              </div>

              <Card className="border-muted/60 bg-card/90 shadow-sm">
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FileDown className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Raw Data Export</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Download the full decision log with variables, calculated metrics, and D-NAV.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="rounded-lg border border-dashed border-muted/70 bg-background/60 p-4 text-sm text-muted-foreground">
                    {dataHighlight}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCsv}
                      disabled={!isLoggedIn || filteredDecisions.length === 0}
                    >
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportExcel}
                      disabled={!isLoggedIn || filteredDecisions.length === 0}
                    >
                      Export Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrint}
                      disabled={!isLoggedIn || !hasData}
                    >
                      Download PDF
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
                </CardContent>
              </Card>
            </section>

            {/* System-level compare (v1: self vs self) */}
            <section className="no-print mt-10 print:hidden">
              <SystemComparePanel left={snapshot} right={snapshot} />
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

  return (
    <div className="report-print-page mx-auto max-w-5xl bg-white text-slate-900 p-8 print:p-6 print:max-w-none">
      {/* Header */}
      <header className="flex items-baseline justify-between gap-4 border-b pb-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {companyName} · Decision Orbit {periodLabel}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            System-level RPS profile across {rpsBaseline.totalDecisions} logged decisions
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="font-medium">D-NAV Executive Readout</p>
          <p className="text-slate-500">R · P · S baseline · Learning · Terrain · Archetypes</p>
        </div>
      </header>

      {/* Top grid: narratives + metrics */}
      <section className="grid grid-cols-12 gap-4">
        {/* Narrative column */}
        <div className="col-span-12 space-y-3 md:col-span-7">
          <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase mb-1">Executive Summary</h2>

          <div className="space-y-2 text-xs leading-relaxed">
            {/* RPS Baseline */}
            <div>
              <h3 className="font-semibold text-slate-800">RPS Baseline — Calm, repeatable execution</h3>
              <p>{interpretation.rpsSummary}</p>
            </div>

            {/* Category Profile */}
            <div>
              <h3 className="font-semibold text-slate-800">Category Profile — Where judgment actually lives</h3>
              <p>{interpretation.categorySummary}</p>
            </div>

            {/* Archetype Profile */}
            <div>
              <h3 className="font-semibold text-slate-800">Archetype Profile — Behavioral fingerprint</h3>
              <p>{interpretation.archetypeSummary}</p>
            </div>

            {/* Learning & Recovery */}
            <div>
              <h3 className="font-semibold text-slate-800">Learning &amp; Recovery — Decision debt &amp; correction</h3>
              <p>{interpretation.learningSummary}</p>
            </div>
          </div>
        </div>

        {/* Metrics column */}
        <div className="col-span-12 space-y-3 md:col-span-5">
          {/* Key metrics */}
          <div className="border rounded-md p-3">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Key Metrics Snapshot</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[10px] uppercase text-slate-500">Average D-NAV</p>
                <p className="text-lg font-semibold">{rpsBaseline.avgDnav.toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">Average judgment quality in this window after cost.</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Avg Return (R)</p>
                <p className="text-lg font-semibold">{rpsBaseline.avgReturn.toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">Net value creation per decision.</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Avg Pressure (P)</p>
                <p className="text-lg font-semibold">{rpsBaseline.avgPressure.toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">Execution stress posture.</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Avg Stability (S)</p>
                <p className="text-lg font-semibold">{rpsBaseline.avgStability.toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">How safe decisions leave the system.</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Learning Curve Index</p>
                <p className="text-lg font-semibold">{learningStats.lci.toFixed(1)}</p>
                <p className="text-[11px] text-slate-500">Recovery efficiency after dips.</p>
              </div>
            </div>
          </div>

          {/* Distributions */}
          <div className="border rounded-md p-3 space-y-2">
            <h2 className="text-sm font-semibold text-slate-700">Distributions ({periodLabel})</h2>

            {/* Return */}
            <div className="text-xs">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Return</span>
                <span>
                  Positive {formatPct(returnDistribution.positive)} · Neutral {formatPct(returnDistribution.neutral)} · Negative {formatPct(returnDistribution.negative)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-emerald-500" style={{ width: `${returnDistribution.positive}%` }} />
                <div className="bg-slate-400" style={{ width: `${returnDistribution.neutral}%` }} />
                <div className="bg-rose-500" style={{ width: `${returnDistribution.negative}%` }} />
              </div>
            </div>

            {/* Pressure */}
            <div className="text-xs">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Pressure</span>
                <span>
                  Pressured {formatPct(pressureDistribution.positive)} · Neutral {formatPct(pressureDistribution.neutral)} · Calm {formatPct(pressureDistribution.negative)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-amber-500" style={{ width: `${pressureDistribution.positive}%` }} />
                <div className="bg-slate-400" style={{ width: `${pressureDistribution.neutral}%` }} />
                <div className="bg-sky-500" style={{ width: `${pressureDistribution.negative}%` }} />
              </div>
            </div>

            {/* Stability */}
            <div className="text-xs">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Stability</span>
                <span>
                  Stable {formatPct(stabilityDistribution.positive)} · Neutral {formatPct(stabilityDistribution.neutral)} · Fragile {formatPct(stabilityDistribution.negative)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-emerald-600" style={{ width: `${stabilityDistribution.positive}%` }} />
                <div className="bg-slate-400" style={{ width: `${stabilityDistribution.neutral}%` }} />
                <div className="bg-rose-500" style={{ width: `${stabilityDistribution.negative}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Baseline section */}
      <section className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-12 md:col-span-4 border rounded-md p-3">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">R · P · S Baseline</h2>
          <p className="text-xs text-slate-500 mb-2">Normalized decision quality profile</p>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-[11px] text-slate-500">Return (R)</span>
              <span className="font-semibold">{rpsBaseline.avgReturn.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-slate-500">Pressure (P)</span>
              <span className="font-semibold">{rpsBaseline.avgPressure.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-slate-500">Stability (S)</span>
              <span className="font-semibold">{rpsBaseline.avgStability.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-slate-500">Average D-NAV</span>
              <span className="font-semibold">{rpsBaseline.avgDnav.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-slate-500">Total Decisions</span>
              <span className="font-semibold">{rpsBaseline.totalDecisions}</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 border rounded-md p-3">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Top Categories</h2>
          <div className="space-y-2 text-xs">
            {topCategories.map((category) => (
              <div key={category.name}>
                <div className="flex justify-between">
                  <span className="font-semibold">{category.name}</span>
                  <span className="text-[11px] text-slate-500">{category.decisionCount} decisions</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Share of volume</span>
                  <span>{formatPct(category.share)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Avg D-NAV</span>
                  <span>{category.avgDnav.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>R / P / S</span>
                  <span>
                    {category.avgR.toFixed(1)} / {category.avgP.toFixed(1)} / {category.avgS.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Dominant factor</span>
                  <span>{category.dominantFactor ?? "Balanced"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 border rounded-md p-3">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Archetypes</h2>
          <div className="space-y-2 text-xs">
            {primaryArchetype && (
              <div>
                <div className="flex justify-between">
                  <span className="font-semibold">Primary · {primaryArchetype.archetype}</span>
                  <span className="text-[11px] text-slate-500">{primaryArchetype.count} entries</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>R / P / S</span>
                  <span>
                    {primaryArchetype.avgR.toFixed(1)} / {primaryArchetype.avgP.toFixed(1)} / {primaryArchetype.avgS.toFixed(1)}
                  </span>
                </div>
              </div>
            )}

            {secondaryArchetype && (
              <div>
                <div className="flex justify-between">
                  <span className="font-semibold">Secondary · {secondaryArchetype.archetype}</span>
                  <span className="text-[11px] text-slate-500">{secondaryArchetype.count} entries</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>R / P / S</span>
                  <span>
                    {secondaryArchetype.avgR.toFixed(1)} / {secondaryArchetype.avgP.toFixed(1)} / {secondaryArchetype.avgS.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bottom grid: Learning + Terrain */}
      <section className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-12 md:col-span-6 border rounded-md p-3">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Learning &amp; Recovery</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[11px] uppercase text-slate-500">Learning Curve Index</p>
              <p className="text-lg font-semibold">{learningStats.lci.toFixed(1)}</p>
              <p className="text-[11px] text-slate-500">Higher is faster learning and recovery.</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-slate-500">Decisions to Recover</p>
              <p className="text-lg font-semibold">{learningStats.decisionsToRecover}</p>
              <p className="text-[11px] text-slate-500">Volume required to regain baseline after a dip.</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-slate-500">Win Rate</p>
              <p className="text-lg font-semibold">{formatPct(learningStats.winRate)}</p>
              <p className="text-[11px] text-slate-500">Share of positive decisions.</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-slate-500">Decision Debt</p>
              <p className="text-lg font-semibold">{learningStats.decisionDebt.toFixed(1)}</p>
              <p className="text-[11px] text-slate-500">Backlog of overdue decision fixes.</p>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-6 border rounded-md p-3">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Decision Terrain</h2>
          <div className="text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] uppercase text-slate-500">High-Confidence Bets</p>
                <p className="text-lg font-semibold">{interpretation.highConfidenceCount}</p>
                <p className="text-[11px] text-slate-500">Impactful moves with conviction.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-500">High-Urgency Calls</p>
                <p className="text-lg font-semibold">{interpretation.highUrgencyCount}</p>
                <p className="text-[11px] text-slate-500">Time-sensitive, high-stakes decisions.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] uppercase text-slate-500">High-Risk Plays</p>
                <p className="text-lg font-semibold">{interpretation.highRiskCount}</p>
                <p className="text-[11px] text-slate-500">Moves with elevated downside.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-500">High-Cost Initiatives</p>
                <p className="text-lg font-semibold">{interpretation.highCostCount}</p>
                <p className="text-[11px] text-slate-500">Resource-intensive commitments.</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase text-slate-500">System Momentum</p>
              <p className="text-lg font-semibold">{interpretation.momentumLabel}</p>
              <p className="text-[11px] text-slate-500">{interpretation.momentumSummary}</p>
            </div>
          </div>
        </div>
      </section>
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
