"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ExecutiveOnePager from "@/components/reports/ExecutiveOnePager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { loadLog, type DecisionEntry } from "@/lib/storage";
import {
  buildDistributionInsights,
  buildReturnDebtSummary,
  computeDashboardStats,
} from "@/utils/dashboardStats";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";

const TIMEFRAMES = [
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "quarter", label: "Quarter to Date" },
  { value: "all", label: "All Time" },
] as const;

type TimeframeValue = (typeof TIMEFRAMES)[number]["value"];

const timeframeDescriptions: Record<TimeframeValue, string> = {
  "7": "Focus on the last seven days of logged decisions.",
  "30": "Aggregate view across the most recent thirty days.",
  quarter: "Quarter-to-date rollup of your decision portfolio.",
  all: "Complete historical view across every decision recorded.",
};

const CADENCE_LABEL = "week";

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
  if (value === "quarter") return 90;
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
  const onePagerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDecisions(loadLog());
  }, []);

  useEffect(() => {
    const handleStorage = () => setDecisions(loadLog());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const timeframeConfig = useMemo(
    () => TIMEFRAMES.find((timeframe) => timeframe.value === selectedTimeframe) ?? TIMEFRAMES[0],
    [selectedTimeframe],
  );
  const timeframeDays = useMemo(() => mapTimeframeToDays(selectedTimeframe), [selectedTimeframe]);
  const filteredDecisions = useMemo(
    () => filterDecisionsByTimeframe(decisions, timeframeDays),
    [decisions, timeframeDays],
  );

  const stats = useMemo(
    () => computeDashboardStats(decisions, { timeframeDays, cadenceUnit: CADENCE_LABEL }),
    [decisions, timeframeDays],
  );
  const distributionInsights = useMemo(() => buildDistributionInsights(stats), [stats]);
  const returnDebtSummary = useMemo(() => buildReturnDebtSummary(stats), [stats]);
  const hasData = stats.totalDecisions > 0;
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString());
  }, [selectedTimeframe, stats.totalDecisions]);

  const dataHighlight = hasData
    ? `Exports ${stats.totalDecisions} decision${stats.totalDecisions === 1 ? "" : "s"} with full variables, returns, stability, pressure, and D-NAV.`
    : "No decisions logged in this window yet.";

  const handleExportCsv = () => {
    if (filteredDecisions.length === 0) return;
    const csvContent = createCsvContent(filteredDecisions);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const filename = `dnav-decision-log-${slugify(timeframeConfig.label)}.csv`;
    downloadBlob(blob, filename);
  };

  const handleExportExcel = () => {
    if (filteredDecisions.length === 0) return;
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
    if (!onePagerRef.current || !hasData) return;
    setDownloading("summary-pdf");

    try {
      const element = onePagerRef.current;
      const scale = Math.min(3, window.devicePixelRatio || 2);
      const backgroundColor = window.getComputedStyle(document.body).backgroundColor || "#ffffff";
      const canvas = await html2canvas(element, { scale, backgroundColor });
      const imgData = canvas.toDataURL("image/png");
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 36;
      const renderWidth = pageWidth - margin * 2;
      const renderHeight = (canvas.height * renderWidth) / canvas.width;

      let position = margin;
      doc.addImage(imgData, "PNG", margin, position, renderWidth, renderHeight);

      let heightLeft = renderHeight - (pageHeight - margin * 2);
      while (heightLeft > 0) {
        position = heightLeft * -1 + margin;
        doc.addPage();
        doc.addImage(imgData, "PNG", margin, position, renderWidth, renderHeight);
        heightLeft -= pageHeight - margin * 2;
      }

      const filename = `dnav-executive-one-pager-${slugify(timeframeConfig.label)}.pdf`;
      doc.save(filename);
    } finally {
      setDownloading(null);
    }
  };

  return (
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

      <section className="grid gap-4">
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
                disabled={filteredDecisions.length === 0}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={filteredDecisions.length === 0}
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
              disabled={!hasData || downloading === "summary-pdf"}
            >
              {downloading === "summary-pdf" ? "Preparing..." : "Download PDF"}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ExecutiveOnePager
              ref={onePagerRef}
              stats={stats}
              timeframeLabel={timeframeConfig.label}
              cadenceLabel={CADENCE_LABEL}
              generatedAt={generatedAt}
              distributionInsights={distributionInsights}
              returnDebtSummary={returnDebtSummary}
              hasData={hasData}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
