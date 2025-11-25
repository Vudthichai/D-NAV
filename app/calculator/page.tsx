"use client";

import CompareSheet from "@/components/CompareSheet";
import SliderRow from "@/components/SliderRow";
import StatCard from "@/components/StatCard";
import SummaryCard from "@/components/SummaryCard";
import { InfoTooltip } from "@/components/InfoTooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DecisionEntry,
  DecisionMetrics,
  DecisionVariables,
  coachHint,
  computeMetrics,
} from "@/lib/calculations";
import { addDecision, loadLog } from "@/lib/storage";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import {
  BarChart3,
  Check,
  Download,
  FileText,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DashboardStats,
  buildDistributionInsights,
  buildPortfolioNarrative,
  buildReturnDebtSummary,
  computeDashboardStats,
  formatValue,
} from "@/utils/dashboardStats";
import {
  buildJudgmentDashboard,
  filterDecisionsByTimeframe,
  type ArchetypePatternRow,
  type CategoryHeatmapRow,
} from "@/utils/judgmentDashboard";

const DEFAULT_VARIABLES: DecisionVariables = {
  impact: 1,
  cost: 1,
  risk: 1,
  urgency: 1,
  confidence: 1,
};

interface DistributionSegment {
  label: string;
  value: number;
  color: string;
  metricKey: string;
}

interface DistributionCardProps {
  title: string;
  segments: DistributionSegment[];
}

const DistributionCard = ({ title, segments }: DistributionCardProps) => {
  const safeSegments = segments.map((segment) => ({
    ...segment,
    value: Number.isFinite(segment.value) ? Math.max(segment.value, 0) : 0,
  }));
  const hasData = safeSegments.some((segment) => segment.value > 0);
  const displayTitle = title.replace(/ Distribution$/i, "");

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{displayTitle}</h3>
        {hasData ? (
          <>
            <div className="h-3 rounded-full bg-muted overflow-hidden flex">
              {safeSegments.map((segment) => (
                <InfoTooltip
                  key={`${title}-${segment.metricKey}-bar`}
                  term={`${title}|${segment.metricKey}`}
                  side="bottom"
                >
                  <div
                    className="h-full cursor-help"
                    style={{
                      flexGrow: segment.value,
                      flexBasis: 0,
                      backgroundColor: segment.color,
                    }}
                  />
                </InfoTooltip>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
              {safeSegments.map((segment) => (
                <InfoTooltip
                  key={`${title}-${segment.metricKey}-legend`}
                  term={`${title}|${segment.metricKey}`}
                  side="bottom"
                >
                  <div className="flex items-center gap-2 cursor-help">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="text-foreground">{segment.label}</span>
                    <span className="ml-auto font-medium text-foreground">
                      {formatValue(segment.value)}%
                    </span>
                  </div>
                </InfoTooltip>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No logged decisions to display yet.</p>
        )}
      </CardContent>
    </Card>
  );
};

const CompactMetric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold text-foreground">{value}</p>
  </div>
);

const Sparkline = ({ data }: { data: number[] }) => {
  if (!data.length) return <p className="text-xs text-muted-foreground">No data in view.</p>;

  const width = 320;
  const height = 80;
  const padding = 6;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const baseLine = height - padding;
  const areaPath = `${path} L ${points[points.length - 1][0]},${baseLine} L ${points[0][0]},${baseLine} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" role="img" aria-label="RPS Index trend">
      <path d={areaPath} fill="currentColor" className="text-primary/10" />
      <path d={path} fill="none" stroke="currentColor" className="text-primary" strokeWidth={2} />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={3} className="fill-primary" />
    </svg>
  );
};

const getStatsReportSections = (current: DashboardStats, cadenceLabel: string) => ({
  generated: new Date().toLocaleString(),
  windowLabel: "",
  cadenceLabel,
  keyMetrics: [
    `Total decisions: ${current.totalDecisions}`,
    `Average D-NAV: ${current.avgDnav}`,
    `Decision cadence: ${current.cadence} per ${cadenceLabel}`,
    `Recent trend: ${current.last5vsPrior5}`,
    `Return on effort: ${current.returnOnEffort}`,
  ],
  distribution: buildDistributionInsights(current).map(({ label, message }) => `${label}: ${message}`),
  risk: [
    `Loss streak: ${current.lossStreak.current} current / ${current.lossStreak.longest} longest`,
    buildReturnDebtSummary(current),
    `Window archetype: ${current.windowArchetype} (Return: ${current.windowArchetypeBreakdown.returnType}, Stability: ${current.windowArchetypeBreakdown.stabilityType}, Pressure: ${current.windowArchetypeBreakdown.pressureType})`,
  ],
  narrative: [] as string[],
});

export default function TheDNavPage() {
  const [showCompare, setShowCompare] = useState(false);
  const [decisionName, setDecisionName] = useState("");
  const [decisionCategory, setDecisionCategory] = useState("");
  const [variables, setVariables] = useState<DecisionVariables>(() => ({ ...DEFAULT_VARIABLES }));
  const [metrics, setMetrics] = useState<DecisionMetrics>(() => computeMetrics(DEFAULT_VARIABLES));
  const [isSaved, setIsSaved] = useState(false);

  const [timeWindow, setTimeWindow] = useState("30");
  const [isGeneratingStatsPdf, setIsGeneratingStatsPdf] = useState(false);
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const { isLoggedIn, openLogin, logout } = useNetlifyIdentity();

  const updateVariable = useCallback((key: keyof DecisionVariables, value: number) => {
    setVariables((prev) => {
      const updated = { ...prev, [key]: value };
      setMetrics(computeMetrics(updated));
      return updated;
    });
    setIsSaved(false);
  }, []);

  const handleOpenCompare = () => {
    setShowCompare(true);
  };

  const handleSaveDecision = () => {
    if (!decisionName.trim() || !decisionCategory.trim()) {
      alert("Please enter both a decision name and category before saving.");
      return;
    }

    const decisionEntry: DecisionEntry = {
      ...variables,
      ...metrics,
      ts: Date.now(),
      name: decisionName.trim(),
      category: decisionCategory.trim(),
    };

    try {
      addDecision(decisionEntry);
      setIsSaved(true);

      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save decision:", error);
      alert("Failed to save decision. Please try again.");
    }
  };

  const handleReset = () => {
    setDecisionName("");
    setDecisionCategory("");
    setVariables({ ...DEFAULT_VARIABLES });
    setMetrics(computeMetrics(DEFAULT_VARIABLES));
    setIsSaved(false);
  };

  const [decisions, setDecisions] = useState<DecisionEntry[]>(() => loadLog());

  useEffect(() => {
    setDecisions(loadLog());
  }, [isSaved]);

  const timeframeDays = useMemo<number | null>(() => {
    if (timeWindow === "0") return null;
    const parsed = Number.parseInt(timeWindow, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [timeWindow]);

  const filteredDecisions = useMemo(
    () => filterDecisionsByTimeframe(decisions, timeframeDays),
    [decisions, timeframeDays],
  );

  const observedSpanDays = useMemo(() => {
    if (filteredDecisions.length === 0) return null;
    const msInDay = 24 * 60 * 60 * 1000;
    const referenceTimestamp = filteredDecisions[0]?.ts ?? Date.now();
    const earliestTimestamp = filteredDecisions[filteredDecisions.length - 1]?.ts ?? referenceTimestamp;
    return Math.max((referenceTimestamp - earliestTimestamp) / msInDay, 1);
  }, [filteredDecisions]);

  const cadenceBasisLabel = useMemo(() => {
    const effectiveSpan = timeframeDays ?? observedSpanDays;
    if (!effectiveSpan || effectiveSpan < 14) return "day";
    return "week";
  }, [observedSpanDays, timeframeDays]);

  const stats = useMemo<DashboardStats>(() => {
    return computeDashboardStats(decisions, { timeframeDays });
  }, [decisions, timeframeDays]);

  const judgment = useMemo(() => buildJudgmentDashboard(filteredDecisions), [filteredDecisions]);

  const timeWindowLabels: Record<string, string> = {
    "0": "All time",
    "7": "Last 7 days",
    "30": "Last 30 days",
    "90": "Last 90 days",
  };

  const { baseline, learning, hygiene, categories, archetypes, drift, signals } = {
    ...judgment,
  };

  const coachLine = useMemo(() => coachHint(variables, metrics), [metrics, variables]);
  const getPillColor = useCallback(
    (value: number, type: "return" | "stability" | "pressure") => {
      if (type === "pressure") {
        if (value > 0) return { text: "Pressured", color: "red" as const };
        if (value < 0) return { text: "Calm", color: "green" as const };
        return { text: "Balanced", color: "amber" as const };
      }

      if (value > 0) {
        return { text: type === "return" ? "Positive" : "Stable", color: "green" as const };
      }
      if (value < 0) {
        return { text: type === "return" ? "Negative" : "Fragile", color: "red" as const };
      }
      return { text: type === "return" ? "Neutral" : "Uncertain", color: "amber" as const };
    },
    [],
  );

  const createStatsReportPdf = async () => {
    if (!statsContainerRef.current) return;

    const element = statsContainerRef.current;
    const scale = Math.min(3, window.devicePixelRatio || 2);
    const backgroundColor = window.getComputedStyle(document.body).backgroundColor || "#ffffff";

    const canvas = await html2canvas(element, {
      scale,
      backgroundColor,
      ignoreElements: (node) => node.classList?.contains("pdf-ignore") ?? false,
    });

    const imgData = canvas.toDataURL("image/png");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const renderWidth = pageWidth - margin * 2;
    const renderHeight = (canvas.height * renderWidth) / canvas.width;
    let heightLeft = renderHeight;
    let position = margin;

    doc.addImage(imgData, "PNG", margin, position, renderWidth, renderHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = heightLeft - renderHeight + margin;
      doc.addPage();
      doc.addImage(imgData, "PNG", margin, position, renderWidth, renderHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    const filename = `dnav-stats-report-${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);
  };

  const createNarrativePdf = (current: DashboardStats) => {
    const sections = getStatsReportSections(current, cadenceBasisLabel);
    sections.windowLabel = timeWindowLabels[timeWindow] ?? `Last ${timeWindow} days`;
    sections.narrative = buildPortfolioNarrative(current, {
      timeframeLabel: sections.windowLabel,
      cadenceLabel: cadenceBasisLabel,
    }).split("\n\n");

    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 48;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = margin;

    const ensureSpace = (height: number) => {
      if (y + height > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const addParagraphs = (lines: string[]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const maxWidth = pageWidth - margin * 2;

      lines.forEach((line) => {
        const wrapped = doc.splitTextToSize(line, maxWidth);
        wrapped.forEach((segment: string) => {
          ensureSpace(18);
          doc.text(segment, margin, y);
          y += 18;
        });
        y += 6;
      });
    };

    const addSection = (title: string, lines: string[]) => {
      if (lines.length === 0) return;
      ensureSpace(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(title, margin, y);
      y += 22;
      addParagraphs(lines.map((line) => `• ${line}`));
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("D-NAV Narrative Brief", margin, y);
    y += 26;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const metadata = [
      `Generated: ${sections.generated}`,
      `Window: ${sections.windowLabel}`,
      `Cadence basis: per ${sections.cadenceLabel}`,
    ];
    addParagraphs(metadata);
    y += 6;

    addSection("Narrative Highlights", sections.narrative);
    addSection("Distribution Insights", sections.distribution);
    addSection("Key Metrics", sections.keyMetrics);
    addSection("Risk & Hygiene", sections.risk);

    ensureSpace(18);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Generated by D-NAV.", margin, y + 6);

    const filename = `dnav-narrative-report-${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);
  };

  const handleDownloadStatsReport = async () => {
    if (!hasData) return;
    try {
      setIsGeneratingStatsPdf(true);
      await createStatsReportPdf();
    } catch (error) {
      console.error("Failed to generate stats PDF", error);
    } finally {
      setIsGeneratingStatsPdf(false);
    }
  };

  const handleDownloadNarrative = () => {
    if (!hasData) return;
    createNarrativePdf(stats);
  };

  const hasData = filteredDecisions.length > 0;

  const showAnalytics = isLoggedIn;

  const handleSignInClick = () => {
    openLogin();
  };

  const handleBookAuditClick = () => {
    if (typeof window === "undefined") return;
    window.location.href = "/contact";
  };

  const handleLogoutClick = () => {
    logout();
  };

  const stepSummaries = [
    {
      step: "STEP 1",
      title: "Rate Your Decision",
      description: "Capture one real decision and rate the five forces shaping it.",
    },
    {
      step: "STEP 2",
      title: "See the Physics of Your Decision",
      description:
        "Your inputs generate the real-time signals shaping the direction of your call.",
    },
    {
      step: "STEP 3",
      title: "See Your Read Out",
      description:
        "The D-NAV score reads those signals and shows where your energy is going.",
    },
  ];

  return (
    <TooltipProvider>
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto p-6 space-y-12" ref={statsContainerRef}>
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3 max-w-3xl">
              <h1 className="text-3xl font-bold text-foreground">
                The D-NAV: A Live Readout of Your Judgment
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed">
                Turn decisions into data. Turn that data into patterns. Turn patterns into leverage.
              </p>
            </div>
            <div className="flex gap-2 self-start items-center">
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="logout-btn text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Log out
                </button>
              ) : null}
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          <section className="mt-8 space-y-10">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {stepSummaries.map((summary) => (
                <div key={summary.step} className="space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-orange-500">
                    <span className="uppercase">{summary.step}</span>
                    <span className="text-foreground font-semibold normal-case"> — {summary.title}</span>
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{summary.description}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 items-start md:grid-cols-2 lg:grid-cols-3">
              <div className="flex h-full flex-col">
                <div className="flex flex-1 flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-sm md:p-5 dnav-card-surface">
                  <div className="space-y-3 flex-1">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">Decision Inputs</h3>
                      <p className="text-sm text-muted-foreground">
                        Capture one real decision and rate the five forces shaping it.
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-muted-foreground">Quick Entry</p>
                        <Input
                          type="text"
                          placeholder="What's Your Decision?"
                          value={decisionName}
                          onChange={(e) => setDecisionName(e.target.value)}
                          className="h-12 text-base lg:text-lg"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Input
                          type="text"
                          placeholder="Categorize it"
                          value={decisionCategory}
                          onChange={(e) => setDecisionCategory(e.target.value)}
                        />
                        <Button
                          onClick={handleSaveDecision}
                          className="w-full"
                          disabled={!decisionName || !decisionCategory}
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Saved!
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Save Decision
                            </>
                          )}
                        </Button>
                        <Button variant="outline" className="w-full md:col-span-2" asChild>
                          <Link href="/log#import" className="flex items-center justify-center">
                            <Upload className="w-4 h-4 mr-2" />
                            Import Decisions
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">Decision Variables</p>
                        <p className="text-xs text-muted-foreground">
                          Each slider represents one of the five forces shaping your call.
                        </p>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            1 = minimal
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            10 = maximum
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <SliderRow
                          id="impact"
                          label="Impact"
                          hint="How big is the upside if this works?"
                          value={variables.impact}
                          onChange={(value) => updateVariable("impact", value)}
                        />
                        <SliderRow
                          id="cost"
                          label="Cost"
                          hint="What are you really spending — money, time, reputation, focus?"
                          value={variables.cost}
                          onChange={(value) => updateVariable("cost", value)}
                        />
                        <SliderRow
                          id="risk"
                          label="Risk"
                          hint="If you’re wrong, what breaks or becomes hard to undo?"
                          value={variables.risk}
                          onChange={(value) => updateVariable("risk", value)}
                        />
                        <SliderRow
                          id="urgency"
                          label="Urgency"
                          hint="How soon do you actually need to move?"
                          value={variables.urgency}
                          onChange={(value) => updateVariable("urgency", value)}
                        />
                        <SliderRow
                          id="confidence"
                          label="Confidence"
                          hint="How solid is your evidence and experience — not just your hope?"
                          value={variables.confidence}
                          onChange={(value) => updateVariable("confidence", value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col">
                <div className="flex flex-1 flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-sm md:p-5 dnav-card-surface">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">Return, Pressure, Stability</h3>
                      <p className="text-sm text-muted-foreground">
                        The physics of your decision — upside, execution stress, and survivability.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <StatCard
                        title="Return"
                        value={metrics.return}
                        pill={getPillColor(metrics.return, "return")}
                        subtitle="Impact − Cost"
                        description="Return shows if the upside beats the burn."
                      />
                      <StatCard
                        title="Pressure"
                        value={metrics.pressure}
                        pill={getPillColor(metrics.pressure, "pressure")}
                        subtitle="Urgency − Confidence"
                        description="Pressure shows whether urgency or conviction is steering you."
                      />
                      <StatCard
                        title="Stability"
                        value={metrics.stability}
                        pill={getPillColor(metrics.stability, "stability")}
                        subtitle="Confidence − Risk"
                        description="Stability tests if evidence can outlast fear."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col">
                <div className="flex flex-1 flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-sm md:p-5 dnav-card-surface">
                  <div className="space-y-4 h-full">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">Archetype &amp; Coach</h3>
                      <p className="text-sm text-muted-foreground">
                        Your decision pattern plus the live D-NAV score readout.
                      </p>
                    </div>
                    <SummaryCard metrics={metrics} coachText={coachLine} className="flex flex-1" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">STEP 4</p>
              <h2 className="text-2xl font-semibold text-foreground">See Your Decision Pattern</h2>
              <p className="text-sm text-muted-foreground">
                One decision is a readout. Ten decisions reveal your style. A team’s decisions reveal the operating system.
              </p>
            </div>
            {isLoggedIn ? (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleLogoutClick}>
                  Sign out
                </Button>
              </div>
            ) : null}
          </div>

          <section className="space-y-6 mt-10">

            <div className="relative">
              {!isLoggedIn && (
                <div className="pointer-events-none absolute inset-0 flex justify-center items-start">
                  <div className="pointer-events-auto sticky top-[200px] z-20 flex flex-col items-center justify-center text-center px-4">
                    <h2 className="text-2xl font-semibold mb-3">See the Story in Your Decisions</h2>
                    <p className="text-sm text-slate-700 mb-4 max-w-xl">
                      Sign in to see your full analytics — return, stability, pressure, momentum, and consistency — so you can
                      see how your judgment really behaves under uncertainty.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 mb-3">
                      <button
                        className="px-6 py-3 rounded-md bg-orange-400 text-white font-medium"
                        onClick={handleSignInClick}
                      >
                        Sign In to View Analytics
                      </button>
                      <button
                        className="px-6 py-3 rounded-md border border-slate-300 bg-white text-slate-800 font-medium"
                        onClick={handleBookAuditClick}
                      >
                        Book a Decision Audit
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Client dashboards and full analytics are available only to active teams and audit clients.
                    </p>
                  </div>
                </div>
              )}
              <div className={!isLoggedIn ? "pointer-events-none filter blur-sm opacity-50" : ""}>
                <div className="space-y-10">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2">
                      <Select value={timeWindow} onValueChange={setTimeWindow}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="0">All time</SelectItem>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleDownloadNarrative}
                        disabled={!hasData}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Narrative PDF
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleDownloadStatsReport}
                        disabled={!hasData || isGeneratingStatsPdf}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {isGeneratingStatsPdf ? "Preparing..." : "Stats PDF"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl font-semibold">RPS Baseline</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                          <CompactMetric label="Total decisions" value={baseline.total} />
                          <CompactMetric label="Avg Return (R)" value={formatValue(baseline.avgReturn)} />
                          <CompactMetric label="Avg Pressure (P)" value={formatValue(baseline.avgPressure)} />
                          <CompactMetric label="Avg Stability (S)" value={formatValue(baseline.avgStability)} />
                          <CompactMetric label="Std dev Return" value={formatValue(baseline.stdReturn)} />
                          <CompactMetric label="Std dev Pressure" value={formatValue(baseline.stdPressure)} />
                          <CompactMetric label="Std dev Stability" value={formatValue(baseline.stdStability)} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          {baseline.outliers.map((item) => (
                            <div key={item.label} className="rounded-lg border bg-muted/30 p-3 space-y-1">
                              <p className="text-xs text-muted-foreground">{item.label}</p>
                              <p className="text-sm font-semibold text-foreground line-clamp-1">{item.title}</p>
                              <p className="text-lg font-bold text-foreground">{formatValue(item.value)}</p>
                            </div>
                          ))}
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2">RPS Index</p>
                          <Sparkline data={baseline.indexSeries} />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-xl font-semibold">Feedback &amp; Learning</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <CompactMetric label="Learning Curve Index" value={learning.lci ? formatValue(learning.lci, 2) : "—"} />
                          <CompactMetric label="Decisions to recover" value={formatValue(learning.decisionsToRecover)} />
                          <CompactMetric label="Time to recover (days)" value={formatValue(learning.daysToRecover)} />
                          <CompactMetric label="Post-loss uplift" value={formatValue(learning.postLossUplift)} />
                          <CompactMetric label="D-NAV volatility" value={formatValue(learning.dnavVolatility)} />
                          <CompactMetric label="Win rate" value={`${formatValue(learning.winRate)}%`} />
                          <CompactMetric label="Longest win streak" value={learning.longestWin} />
                          <CompactMetric label="Longest loss streak" value={learning.longestLoss} />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-xl font-semibold">Return Hygiene</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <CompactMetric label="Current loss streak" value={hygiene.currentLossStreak} />
                          <CompactMetric label="Worst loss streak" value={hygiene.worstLossStreak} />
                          <CompactMetric label="Max drawdown" value={formatValue(hygiene.maxDrawdown)} />
                          <CompactMetric label="Return debt" value={formatValue(hygiene.returnDebt)} />
                          <CompactMetric label="Payback ratio" value={formatValue(hygiene.paybackRatio, 2)} />
                          <CompactMetric label="Average win" value={formatValue(hygiene.averageWin)} />
                          <CompactMetric label="Average loss" value={formatValue(hygiene.averageLoss)} />
                          <CompactMetric label="Hit rate" value={`${formatValue(hygiene.hitRate)}%`} />
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl font-semibold">Decision Category Heatmap</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {categories.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No categories in view.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Category</TableHead>
                                  <TableHead className="text-right">#</TableHead>
                                  <TableHead className="text-right">%</TableHead>
                                  <TableHead className="text-right">Avg D-NAV</TableHead>
                                  <TableHead className="text-right">Avg R</TableHead>
                                  <TableHead className="text-right">Avg P</TableHead>
                                  <TableHead className="text-right">Avg S</TableHead>
                                  <TableHead className="text-right">Dominant</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {categories.map((row: CategoryHeatmapRow) => (
                                  <TableRow key={row.category} className="hover:bg-muted/50">
                                    <TableCell className="font-medium">{row.category}</TableCell>
                                    <TableCell className="text-right">{row.decisionCount}</TableCell>
                                    <TableCell className="text-right">{formatValue(row.percent)}%</TableCell>
                                    <TableCell className="text-right">{formatValue(row.avgDnav)}</TableCell>
                                    <TableCell className="text-right">{formatValue(row.avgR)}</TableCell>
                                    <TableCell className="text-right">{formatValue(row.avgP)}</TableCell>
                                    <TableCell className="text-right">{formatValue(row.avgS)}</TableCell>
                                    <TableCell className="text-right">{row.dominantVariable}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3 space-y-1">
                        <CardTitle className="text-xl font-semibold">Archetypes &amp; Patterns</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          <CompactMetric label="Primary Archetype" value={archetypes.primary} />
                          <CompactMetric label="Secondary" value={archetypes.secondary} />
                          <CompactMetric label="% in Primary" value={`${formatValue(archetypes.primaryShare)}%`} />
                          <CompactMetric label="% in Top 3" value={`${formatValue(archetypes.topThreeShare)}%`} />
                          <CompactMetric label="Archetype churn" value={archetypes.churn} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <DistributionCard title="Return Distribution" segments={archetypes.distributions.returnSegments} />
                          <DistributionCard title="Pressure Distribution" segments={archetypes.distributions.pressureSegments} />
                          <DistributionCard title="Stability Distribution" segments={archetypes.distributions.stabilitySegments} />
                        </div>

                        {archetypes.rows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No archetype data yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Archetype</TableHead>
                                  <TableHead className="text-right">#</TableHead>
                                  <TableHead className="text-right">Avg R</TableHead>
                                  <TableHead className="text-right">Avg P</TableHead>
                                  <TableHead className="text-right">Avg S</TableHead>
                                  <TableHead className="text-right">Avg D-NAV</TableHead>
                                  <TableHead className="text-right">Top categories</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {archetypes.rows.map((row: ArchetypePatternRow) => (
                                  <TableRow key={row.archetype} className="hover:bg-muted/50">
                                    <TableCell className="font-medium">{row.archetype}</TableCell>
                                    <TableCell className="text-right">{row.count}</TableCell>
                                    <TableCell className="text-right">{formatValue(row.avgR)}</TableCell>
                                    <TableCell className="text-right">{formatValue(row.avgP)}</TableCell>
                                    <TableCell className="text-right">{formatValue(row.avgS)}</TableCell>
                                    <TableCell className="text-right">{formatValue(row.avgDnav)}</TableCell>
                                    <TableCell className="text-right">{row.topCategories.join(", ") || "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl font-semibold">Judgment Drift</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!drift.hasData ? (
                          <p className="text-sm text-muted-foreground">No hindsight data available yet.</p>
                        ) : (
                          <div className="grid gap-6 lg:grid-cols-3">
                            <div className="lg:col-span-2 overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Variable</TableHead>
                                    <TableHead className="text-right">Avg drift</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {drift.variableDrifts.map((entry) => (
                                    <TableRow key={entry.label} className="hover:bg-muted/50">
                                      <TableCell>{entry.label}</TableCell>
                                      <TableCell className="text-right">{formatValue(entry.value)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-2">
                                <CompactMetric label="Overconfidence" value={formatValue(drift.biasIndices.overconfidence)} />
                                <CompactMetric label="Underconfidence" value={formatValue(drift.biasIndices.underconfidence)} />
                                <CompactMetric label="Risk underest." value={formatValue(drift.biasIndices.riskUnder)} />
                                <CompactMetric label="Risk overest." value={formatValue(drift.biasIndices.riskOver)} />
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top positive drifts</p>
                                <ul className="space-y-1 text-sm text-foreground">
                                  {drift.positiveDrifts.length ? (
                                    drift.positiveDrifts.map((title) => <li key={`pos-${title}`} className="line-clamp-1">{title}</li>)
                                  ) : (
                                    <li className="text-muted-foreground">—</li>
                                  )}
                                </ul>
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top negative drifts</p>
                                <ul className="space-y-1 text-sm text-foreground">
                                  {drift.negativeDrifts.length ? (
                                    drift.negativeDrifts.map((title) => <li key={`neg-${title}`} className="line-clamp-1">{title}</li>)
                                  ) : (
                                    <li className="text-muted-foreground">—</li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl font-semibold">Judgment Signals</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {[
                          { title: "High-confidence", items: signals.highConfidence },
                          { title: "High-impact", items: signals.highImpact },
                          { title: "Positive RPS", items: signals.positiveRps },
                          { title: "Low-pressure efficiency", items: signals.lowPressureEfficiency },
                          { title: "Low-frequency high-impact", items: signals.lowFrequencyHighImpact },
                          { title: "High-volatility", items: signals.highVolatility },
                          { title: "High-drift", items: signals.highDrift },
                        ].map((group) => (
                          <div key={group.title} className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                            <div className="flex flex-wrap gap-2">
                              {group.items.length ? (
                                group.items.map((item) => (
                                  <Badge key={`${group.title}-${item}`} variant="secondary" className="rounded-full">
                                    {item}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">None</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border border-primary/40 bg-primary/5">
                      <CardHeader>
                        <CardTitle className="text-xl font-semibold text-foreground">Decision Audit</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Run a batch of decisions, surface archetypes, and tune your cadence.
                        </p>
                        <Button size="lg" onClick={handleBookAuditClick}>
                          Book a Decision Audit
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>

            </div>

          </section>

          {showAnalytics && (
            <div className="mt-8 flex justify-center gap-4 pdf-ignore">
              <Button size="lg" onClick={handleOpenCompare}>
                Compare Decisions
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleSaveDecision}
                disabled={!decisionName || !decisionCategory}
              >
                Save &amp; Continue
              </Button>
            </div>
          )}
        </div>
        {showAnalytics && (
          <Button
            className="fixed right-6 bottom-6 bg-primary shadow-lg z-50 rounded-full w-14 h-14"
            onClick={handleOpenCompare}
          >
            <BarChart3 className="w-5 h-5" />
          </Button>
        )}

        <CompareSheet
          open={showCompare}
          onOpenChange={setShowCompare}
          baseVariables={variables}
          baseMetrics={metrics}
        />
      </main>
    </TooltipProvider>
  );
}
