"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import StatCard from "@/components/StatCard";
import ReturnDistributionCard from "@/components/ReturnDistributionCard";
import PressureDistributionCard from "@/components/PressureDistributionCard";
import StabilityDistributionCard from "@/components/StabilityDistributionCard";
import SystemComparePanel from "@/components/SystemComparePanel";
import ExecutiveOnePager from "@/components/reports/ExecutiveOnePager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompanyPeriodSnapshot, generateFullInterpretation } from "@/lib/dnavSummaryEngine";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import { loadCompanyContext, loadLog, type DecisionEntry } from "@/lib/storage";
import { type CompanyContext } from "@/types/company";
import {
  buildDistributionInsights,
  buildReturnDebtSummary,
  computeDashboardStats,
} from "@/utils/dashboardStats";
import { buildJudgmentDashboard } from "@/utils/judgmentDashboard";
import { cn } from "@/lib/utils";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
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

type Html2CanvasFn = typeof import("html2canvas")["default"];
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
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeValue>("all");
  const [decisions, setDecisions] = useState<DecisionEntry[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toLocaleString());
  const [companyContext, setCompanyContext] = useState<CompanyContext | null>(null);
  const onePagerRef = useRef<HTMLDivElement>(null);
  const { isLoggedIn, openLogin } = useNetlifyIdentity();

  useEffect(() => {
    setDecisions(loadLog());
    setCompanyContext(loadCompanyContext());
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      setDecisions(loadLog());
      setCompanyContext(loadCompanyContext());
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

  const baseline = judgmentDashboard.baseline;

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
      judgmentDashboard.categories.map((category) => ({
        name: category.category,
        decisionCount: category.decisionCount,
        share: category.percent ?? 0,
        avgDnav: category.avgDnav,
        avgR: category.avgR,
        avgP: category.avgP,
        avgS: category.avgS,
        dominantFactor: category.dominantVariable,
      })),
    [judgmentDashboard.categories],
  );

  const archetypeProfile = useMemo(() => judgmentDashboard.archetypes.rows, [judgmentDashboard.archetypes.rows]);

  const learningStats = useMemo(
    () => ({
      lci: judgmentDashboard.learning?.lci ?? 0,
      decisionsToRecover: judgmentDashboard.learning?.decisionsToRecover ?? 0,
      winRate: judgmentDashboard.learning?.winRate ?? 0,
      decisionDebt: judgmentDashboard.hygiene?.decisionDebt ?? 0,
    }),
    [judgmentDashboard.hygiene?.decisionDebt, judgmentDashboard.learning],
  );

  const snapshot = useMemo<CompanyPeriodSnapshot>(() => {
    const distributionFromSegments = (segments: { metricKey: string; value: number }[]) => {
      const positivePct = segments.find((segment) => segment.metricKey === "positive")?.value ?? 0;
      const neutralPct = segments.find((segment) => segment.metricKey === "neutral")?.value ?? 0;
      const negativePct = segments.find((segment) => segment.metricKey === "negative")?.value ?? 0;
      return { positivePct, neutralPct, negativePct };
    };

    const totalArchetypeDecisions = archetypeProfile.reduce((sum, row) => sum + row.count, 0);

    return {
      companyName: companyContext?.companyName ?? "Your Company",
      periodLabel: companyContext?.timeframeLabel ?? timeframeConfig.label,
      rpsBaseline: {
        totalDecisions: baseline.total,
        avgDnav: baseline.avgDnav,
        avgReturn: baseline.avgReturn,
        avgPressure: baseline.avgPressure,
        avgStability: baseline.avgStability,
        returnDist: distributionFromSegments(baseline.returnSegments),
        pressureDist: distributionFromSegments(baseline.pressureSegments),
        stabilityDist: distributionFromSegments(baseline.stabilitySegments),
      },
      categories: categoryProfile.map((category) => ({
        name: category.name,
        decisionCount: category.decisionCount,
        avgReturn: category.avgR,
        avgPressure: category.avgP,
        avgStability: category.avgS,
        totalDnav: category.avgDnav * category.decisionCount,
      })),
      archetypes: archetypeProfile.map((row) => ({
        name: row.archetype,
        percentage: totalArchetypeDecisions ? (row.count / totalArchetypeDecisions) * 100 : 0,
      })),
      learningRecovery: {
        averageRecoveryDecisions: learningStats.decisionsToRecover,
        winRate: learningStats.winRate,
        decisionDebtIndex: Number.isFinite(learningStats.decisionDebt)
          ? Math.max(0, Math.min(1, learningStats.decisionDebt / 100))
          : undefined,
      },
    };
  }, [
    archetypeProfile,
    baseline.avgDnav,
    baseline.avgPressure,
    baseline.avgReturn,
    baseline.avgStability,
    baseline.pressureSegments,
    baseline.returnSegments,
    baseline.stabilitySegments,
    baseline.total,
    categoryProfile,
    companyContext?.companyName,
    companyContext?.timeframeLabel,
    learningStats.decisionDebt,
    learningStats.decisionsToRecover,
    learningStats.winRate,
    timeframeConfig.label,
  ]);

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
  const primaryArchetype = sortedArchetypes[0];
  const secondaryArchetype = sortedArchetypes[1];
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString());
  }, [selectedTimeframe, stats.totalDecisions]);

  const dataHighlight = hasData
    ? `Exports ${stats.totalDecisions} decision${stats.totalDecisions === 1 ? "" : "s"} with full variables, returns, stability, pressure, and D-NAV.`
    : "No decisions logged in this window yet.";

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

  const handleDownloadOnePager = async () => {
    if (!onePagerRef.current || !hasData || !isLoggedIn) return;
    setDownloading("summary-pdf");

    try {
      const html2canvasModule = await import("html2canvas");
      const html2canvas =
        html2canvasModule.default ?? (html2canvasModule as unknown as Html2CanvasFn);
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
          <div className={cn("space-y-10", !isLoggedIn && "pointer-events-none filter blur-sm opacity-50")}>
            <section className="mt-4">
              <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold">Executive Summary</h1>
                <p className="text-sm text-muted-foreground">
                  Snapshot for {snapshot.companyName} · {snapshot.periodLabel}
                </p>
              </div>
              <button
                type="button"
                className="text-xs px-3 py-1 rounded-full border bg-background hover:bg-muted transition-colors"
                onClick={() => {
                  const text = [
                    interpretation.rpsSummary,
                    interpretation.categorySummary,
                    interpretation.archetypeSummary,
                    interpretation.learningSummary,
                  ].join("\n\n");
                  navigator.clipboard?.writeText(text).catch(() => {});
                }}
              >
                Copy summary
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-muted/40 p-4">
                <h3 className="text-sm font-semibold mb-1">RPS Baseline</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {interpretation.rpsSummary}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-4">
                <h3 className="text-sm font-semibold mb-1">Decision Category Profile</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {interpretation.categorySummary}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-4">
                <h3 className="text-sm font-semibold mb-1">Archetype Profile</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {interpretation.archetypeSummary}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-4">
                <h3 className="text-sm font-semibold mb-1">Learning &amp; Recovery</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {interpretation.learningSummary}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4">Key Metrics Snapshot</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <StatCard
                label="Average D-NAV"
                value={baseline.avgDnav.toFixed(1)}
                helper="Average judgment quality in this window"
              />
              <StatCard label="Avg Return (R)" value={baseline.avgReturn.toFixed(1)} helper="Value created per decision after cost" />
              <StatCard label="Avg Pressure (P)" value={baseline.avgPressure.toFixed(1)} helper="Execution stress posture" />
              <StatCard label="Avg Stability (S)" value={baseline.avgStability.toFixed(1)} helper="How safe decisions leave the system" />
              <StatCard label="Learning Curve Index" value={(learningStats.lci ?? 0).toFixed(1)} helper="Recovery efficiency after dips" />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4">Distributions</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <ReturnDistributionCard distribution={baselineDistributions.returnDistribution} />
              <StabilityDistributionCard distribution={baselineDistributions.stabilityDistribution} />
              <PressureDistributionCard distribution={baselineDistributions.pressureDistribution} />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Decision Terrain</h2>
              <p className="text-xs text-muted-foreground">Top 3 categories by judgment load.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {topCategories.map((cat) => (
                <div key={cat.name} className="rounded-xl border bg-muted/40 p-4">
                  <h3 className="text-sm font-semibold mb-1">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{cat.share.toFixed(1)}% of decisions</p>
                  <p className="text-xs text-muted-foreground">
                    Avg D-NAV: <strong>{cat.avgDnav.toFixed(1)}</strong>
                    <br />
                    Avg R / P / S: <strong>{cat.avgR.toFixed(1)} / {cat.avgP.toFixed(1)} / {cat.avgS.toFixed(1)}</strong>
                    <br />
                    Dominant factor: <strong>{cat.dominantFactor}</strong>
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4">Archetype Fingerprint</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-muted/40 p-4">
                <h3 className="text-sm font-semibold mb-1">Primary archetype</h3>
                <p className="text-sm">{primaryArchetype?.archetype ?? "Not enough data"}</p>
                {primaryArchetype && (
                  <p className="text-xs text-muted-foreground mt-1">
                    R {primaryArchetype.avgR.toFixed(1)} · P {primaryArchetype.avgP.toFixed(1)} · S {primaryArchetype.avgS.toFixed(1)} · {primaryArchetype.count} decisions
                  </p>
                )}
              </div>
              <div className="rounded-xl border bg-muted/40 p-4">
                <h3 className="text-sm font-semibold mb-1">Secondary archetype</h3>
                <p className="text-sm">{secondaryArchetype?.archetype ?? "Not enough data"}</p>
                {secondaryArchetype && (
                  <p className="text-xs text-muted-foreground mt-1">
                    R {secondaryArchetype.avgR.toFixed(1)} · P {secondaryArchetype.avgP.toFixed(1)} · S {secondaryArchetype.avgS.toFixed(1)} · {secondaryArchetype.count} decisions
                  </p>
                )}
              </div>
              <div className="rounded-xl border bg-muted/40 p-4">
                <h3 className="text-sm font-semibold mb-2">Top archetypes</h3>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {sortedArchetypes.slice(0, 4).map((a) => (
                    <li key={a.archetype} className="flex items-center justify-between">
                      <span>{a.archetype}</span>
                      <span>
                        {a.count} · {(
                          snapshot.rpsBaseline.totalDecisions
                            ? (a.count / snapshot.rpsBaseline.totalDecisions) * 100
                            : 0
                        ).toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Exports</h2>
              <p className="text-sm text-muted-foreground">
                Download the full decision log or export a polished one-page brief with the executive summary and metrics shown above.
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
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleExportCsv} disabled={!isLoggedIn || filteredDecisions.length === 0}>
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
          </section>

          {/* System-level compare (v1: self vs self) */}
          <section className="mt-10">
            <SystemComparePanel left={snapshot} right={snapshot} />
          </section>
        </div>
      </section>
      </div>
    </TooltipProvider>
  );
}
