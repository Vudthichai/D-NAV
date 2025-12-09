"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import SystemComparePanel from "@/components/SystemComparePanel";
import OnePageReport from "@/components/reports/OnePageReport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  buildCompanyPeriodSnapshot,
  CompanyPeriodSnapshot,
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

export default function ReportsPage() {
  return (
    <Suspense fallback={<div>Loading reports…</div>}>
      <ReportsPageContent />
    </Suspense>
  );
}
