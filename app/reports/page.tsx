"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ExecutiveOnePager from "@/components/reports/ExecutiveOnePager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  loadCompanyContext,
  loadCompanySummary,
  loadLog,
  saveCompanySummary,
  type DecisionEntry,
} from "@/lib/storage";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import { generateCompanySummary } from "@/lib/judgmentSummaryLLM";
import { buildCompanySummaryInput } from "@/lib/judgmentSummaryPayload";
import { type CompanyContext, type CompanySummaryOutput } from "@/types/company";
import {
  buildDistributionInsights,
  buildReturnDebtSummary,
  computeDashboardStats,
} from "@/utils/dashboardStats";
import { buildJudgmentDashboard } from "@/utils/judgmentDashboard";
import { FileDown, FileSpreadsheet, FileText, Lock } from "lucide-react";
import * as XLSX from "xlsx";

const TIMEFRAMES = [
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
] as const;

type TimeframeValue = (typeof TIMEFRAMES)[number]["value"];

const timeframeDescriptions: Record<TimeframeValue, string> = {
  "7": "Focus on the last seven days of logged decisions.",
  "30": "Aggregate view across the most recent thirty days.",
  "90": "Quarter-scale perspective across the most recent ninety days.",
  all: "Complete historical view across every decision recorded.",
};

type Html2CanvasFn = typeof import("html2canvas");
type JsPDFClass = typeof import("jspdf").jsPDF;

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

const mapTimeframeToDays = (value: TimeframeValue): number | null => {
  if (value === "all") return null;
  return Number.parseInt(value, 10);
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

const filterDecisionsByTimeframe = (decisions: DecisionEntry[], timeframeDays: number | null) => {
  if (!timeframeDays) return decisions;
  if (decisions.length === 0) return [];

  const now = decisions[0]?.ts ?? Date.now();
  const msInDay = 24 * 60 * 60 * 1000;
  return decisions.filter((decision) => now - decision.ts <= timeframeDays * msInDay);
};

export default function ReportsPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeValue>("7");
  const [decisions, setDecisions] = useState<DecisionEntry[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toLocaleString());
  const [companyContext, setCompanyContext] = useState<CompanyContext | null>(null);
  const [companySummary, setCompanySummary] = useState<CompanySummaryOutput | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const isContextReady = Boolean(companyContext?.companyName && companyContext?.timeframeLabel);
  const onePagerRef = useRef<HTMLDivElement>(null);
  const { isLoggedIn, openLogin } = useNetlifyIdentity();

  useEffect(() => {
    setDecisions(loadLog());
    setCompanyContext(loadCompanyContext());
    setCompanySummary(loadCompanySummary());
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      setDecisions(loadLog());
      setCompanyContext(loadCompanyContext());
      setCompanySummary(loadCompanySummary());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const timeframeConfig = useMemo(
    () => TIMEFRAMES.find((timeframe) => timeframe.value === selectedTimeframe) ?? TIMEFRAMES[0],
    [selectedTimeframe],
  );
  const timeframeDays = useMemo(() => mapTimeframeToDays(selectedTimeframe), [selectedTimeframe]);
  const observedSpanDays = useMemo(() => {
    if (decisions.length === 0) return null;
    const msInDay = 24 * 60 * 60 * 1000;
    const referenceTimestamp = decisions[0]?.ts ?? Date.now();
    const earliestTimestamp = decisions[decisions.length - 1]?.ts ?? referenceTimestamp;
    return Math.max((referenceTimestamp - earliestTimestamp) / msInDay, 1);
  }, [decisions]);
  const filteredDecisions = useMemo(
    () => filterDecisionsByTimeframe(decisions, timeframeDays),
    [decisions, timeframeDays],
  );

  const judgmentDashboard = useMemo(
    () => buildJudgmentDashboard(filteredDecisions, companyContext ?? undefined),
    [filteredDecisions, companyContext],
  );

  const stats = useMemo(
    () => computeDashboardStats(decisions, { timeframeDays }),
    [decisions, timeframeDays],
  );
  const cadenceBasisLabel = useMemo(() => {
    const effectiveSpan = timeframeDays ?? observedSpanDays;
    if (!effectiveSpan || effectiveSpan < 14) return "day";
    return "week";
  }, [observedSpanDays, timeframeDays]);
  const distributionInsights = useMemo(() => buildDistributionInsights(stats), [stats]);
  const returnDebtSummary = useMemo(() => buildReturnDebtSummary(stats), [stats]);
  const hasData = stats.totalDecisions > 0;
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString());
  }, [selectedTimeframe, stats.totalDecisions]);

  const dataHighlight = hasData
    ? `Exports ${stats.totalDecisions} decision${stats.totalDecisions === 1 ? "" : "s"} with full variables, returns, stability, pressure, and D-NAV.`
    : "No decisions logged in this window yet.";

  const narrativeParagraphs = companySummary?.summary.split("\n").filter(Boolean) ?? [];
  const summaryButtonDisabled = !isLoggedIn || summaryLoading || !canGenerateSummary;

  const canGenerateSummary = Boolean(isContextReady && filteredDecisions.length > 0);

  const handleSignInClick = () => {
    openLogin();
  };

  const handleBookAuditClick = () => {
    if (typeof window === "undefined") return;
    window.location.href = "/contact";
  };

  const handleGenerateSummary = async () => {
    if (!companyContext || !canGenerateSummary) {
      setSummaryError("Add company context in the Decision Log and log at least one decision to generate a summary.");
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const input = buildCompanySummaryInput({ ...judgmentDashboard, companyContext });
      const summary = await generateCompanySummary(input);
      setCompanySummary(summary);
      saveCompanySummary(summary);
    } catch (error) {
      console.error("Failed to generate company summary", error);
      setSummaryError("Unable to generate a summary right now. Please try again.");
    } finally {
      setSummaryLoading(false);
    }
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

  const handleDownloadOnePager = async () => {
    if (!onePagerRef.current || !hasData || !isLoggedIn) return;
    setDownloading("summary-pdf");

    try {
      const html2canvasModule = await import("html2canvas");
      const html2canvas = (html2canvasModule.default ?? html2canvasModule) as Html2CanvasFn;
      const jsPDFModule = await import("jspdf");
      const JsPDFConstructor =
        (jsPDFModule as { jsPDF?: JsPDFClass; default?: JsPDFClass }).jsPDF ??
        (jsPDFModule as { jsPDF?: JsPDFClass; default?: JsPDFClass }).default;
      if (!JsPDFConstructor) {
        throw new Error("Failed to load jsPDF");
      }
      const element = onePagerRef.current;
      const scale = Math.min(3, window.devicePixelRatio || 2);
      const backgroundColor = window.getComputedStyle(document.body).backgroundColor || "#ffffff";
      const canvas = await html2canvas(element, { scale, backgroundColor });
      const imgData = canvas.toDataURL("image/png");
      const doc = new JsPDFConstructor({ unit: "pt", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 36;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const rgb = backgroundColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const [r, g, b] = rgb.map((value) => parseInt(value, 10));
        doc.setFillColor(r, g, b);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
      }
      const widthRatio = maxWidth / canvas.width;
      const heightRatio = maxHeight / canvas.height;
      const renderRatio = Math.min(widthRatio, heightRatio);
      const renderWidth = canvas.width * renderRatio;
      const renderHeight = canvas.height * renderRatio;
      const offsetX = (pageWidth - renderWidth) / 2;
      const offsetY = (pageHeight - renderHeight) / 2;

      doc.addImage(imgData, "PNG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");

      const filename = `dnav-executive-one-pager-${slugify(timeframeConfig.label)}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("Failed to download one-pager", error);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-8">
      <section className="rounded-2xl border bg-card/80 p-6 shadow-sm">
        <div className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit uppercase tracking-wide">
            Reports Hub
          </Badge>
          <h1 className="text-3xl font-semibold">Export ready-to-share intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Download structured decision data or generate the Executive One-Pager without leaving D-NAV.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border bg-card/80 p-6 shadow-sm">
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
                onClick={() => setSelectedTimeframe(value)}
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
                Export-ready datasets and the Executive One-Pager are reserved for D-NAV clients. Sign in to access your reports or book a Decision Audit to get started.
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
        <div className={cn("grid gap-4", !isLoggedIn && "pointer-events-none filter blur-sm opacity-50")}>
          <Card className="border-muted/60 bg-card/90 shadow-sm">
            <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">Judgment Summary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Auto-generated narrative plus strengths and vulnerabilities based on your latest decisions.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {companyContext?.companyName && companyContext.timeframeLabel ? (
                  <Badge variant="outline" className="w-fit">
                    {companyContext.companyName} · {companyContext.timeframeLabel}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="w-fit">Add company context in the Decision Log</Badge>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleGenerateSummary}
                      disabled={summaryButtonDisabled}
                      variant={isContextReady ? "default" : "outline"}
                    >
                      {isContextReady ? (
                        summaryLoading ? "Generating..." : companySummary ? "Regenerate" : "Generate Summary"
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Add context to unlock
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  {!isContextReady && (
                    <TooltipContent className="max-w-xs text-xs">
                      Add company context in the Decision Log to unlock summaries.
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {summaryError && <p className="text-sm text-destructive">{summaryError}</p>}
              {!companySummary && !summaryError && (
                <p className="text-sm text-muted-foreground">
                  Provide a company name and timeframe in the Decision Log, then generate a summary once at least one decision is
                  logged.
                </p>
              )}
              {companySummary && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground">Portfolio Narrative</h4>
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        Decision Portfolio Brief
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">
                      {narrativeParagraphs.map((paragraph, idx) => (
                        <p key={idx} className="whitespace-pre-wrap">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <h4 className="text-sm font-semibold text-foreground">Strengths</h4>
                      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {companySummary.strengths.map((item, idx) => (
                          <li key={`strength-${idx}`} className="flex gap-2">
                            <span className="mt-1 block h-2 w-2 rounded-full bg-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <h4 className="text-sm font-semibold text-foreground">Vulnerabilities</h4>
                      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {companySummary.vulnerabilities.map((item, idx) => (
                          <li key={`vulnerability-${idx}`} className="flex gap-2">
                            <span className="mt-1 block h-2 w-2 rounded-full bg-amber-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleExportCsv}
                  disabled={!isLoggedIn || filteredDecisions.length === 0}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  disabled={!isLoggedIn || filteredDecisions.length === 0}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-muted/60 bg-card/90 shadow-sm">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Executive One-Pager</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    A polished one-page brief mirroring the in-app analytics beneath The D-NAV dashboard.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleDownloadOnePager}
                disabled={!isLoggedIn || !hasData || downloading === "summary-pdf"}
              >
                {downloading === "summary-pdf" ? "Preparing..." : "Download PDF"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ExecutiveOnePager
                ref={onePagerRef}
                stats={stats}
                timeframeLabel={timeframeConfig.label}
                cadenceLabel={cadenceBasisLabel}
                generatedAt={generatedAt}
                distributionInsights={distributionInsights}
                returnDebtSummary={returnDebtSummary}
                hasData={hasData}
              />
            </CardContent>
          </Card>
        </div>
      </section>
      </div>
    </TooltipProvider>
  );
}
