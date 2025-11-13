"use client";

import CompareSheet from "@/components/CompareSheet";
import DecisionCalculator from "@/components/DecisionCalculator";
import FeedbackLoops from "@/components/FeedbackLoops";
import { InfoTooltip } from "@/components/InfoTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DecisionEntry,
  DecisionMetrics,
  DecisionVariables,
  coachHint,
  energyTier,
  getArchetype,
  getScoreTagText,
} from "@/lib/calculations";
import { addDecision, loadLog } from "@/lib/storage";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle,
  Download,
  FileText,
  Gauge,
  LineChart,
  Minus,
  RotateCcw,
  Save,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const FLAGS = { showFeedbackLoops: true };

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  trend?: number;
  color?: "default" | "positive" | "negative" | "warning";
  helper?: string;
}

const DashboardStatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "default",
  helper,
}: DashboardStatCardProps) => {
  const colorClasses = {
    default: "text-muted-foreground",
    positive: "text-green-600",
    negative: "text-red-600",
    warning: "text-amber-600",
  } as const;

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <InfoTooltip term={title}>
              <p className="text-sm font-medium text-muted-foreground cursor-help">{title}</p>
            </InfoTooltip>
            <InfoTooltip term={title} side="bottom">
              <div className="flex items-center gap-2 mt-1 cursor-help">
                <p className="text-xl font-bold sm:text-2xl">{value}</p>
                {trend !== undefined && (
                  <div className="flex items-center gap-1">
                    {trend > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : trend < 0 ? (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span
                      className={`text-sm ${
                        trend > 0
                          ? "text-green-600"
                          : trend < 0
                          ? "text-red-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {Math.abs(trend)}
                    </span>
                  </div>
                )}
              </div>
            </InfoTooltip>
            <p className={`text-xs mt-1 ${colorClasses[color]}`}>{subtitle}</p>
            {helper ? <p className="text-xs text-muted-foreground mt-1">{helper}</p> : null}
          </div>
          <Icon className="h-6 w-6 text-muted-foreground sm:h-7 sm:w-7" />
        </div>
      </CardContent>
    </Card>
  );
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

type IdentityEventHandler = (user?: NetlifyIdentityUser | null) => void;

interface NetlifyIdentityUser {
  app_metadata?: {
    roles?: string[];
  };
}

interface NetlifyIdentity {
  on?: (event: string, callback: IdentityEventHandler) => void;
  off?: (event: string, callback: IdentityEventHandler) => void;
  open?: (modal?: string) => void;
  init?: () => void;
  currentUser?: () => NetlifyIdentityUser | null;
  logout?: () => void;
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

const getStatsReportSections = (current: DashboardStats) => ({
  generated: new Date().toLocaleString(),
  windowLabel: "",
  cadenceLabel: "",
  keyMetrics: [
    `Total decisions: ${current.totalDecisions}`,
    `Average D-NAV: ${current.avgDnav}`,
    `Decision cadence: ${current.cadence}`,
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
  const [variables, setVariables] = useState<DecisionVariables>({
    impact: 1,
    cost: 1,
    risk: 1,
    urgency: 1,
    confidence: 1,
  });
  const [metrics, setMetrics] = useState<DecisionMetrics>({
    return: 0,
    stability: 0,
    pressure: 0,
    merit: 0,
    energy: 0,
    dnav: 0,
  });
  const [isSaved, setIsSaved] = useState(false);

  const [timeWindow, setTimeWindow] = useState("30");
  const [cadenceUnit, setCadenceUnit] = useState("week");
  const [isGeneratingStatsPdf, setIsGeneratingStatsPdf] = useState(false);
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [, setIsAdmin] = useState(false);

  const handleDataChange = useCallback(
    (newVariables: DecisionVariables, newMetrics: DecisionMetrics) => {
      setVariables(newVariables);
      setMetrics(newMetrics);
      setIsSaved(false);
    },
    [],
  );

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
    setVariables({
      impact: 1,
      cost: 1,
      risk: 1,
      urgency: 1,
      confidence: 1,
    });
    setMetrics({
      return: 0,
      stability: 0,
      pressure: 0,
      merit: 0,
      energy: 0,
      dnav: 0,
    });
    setIsSaved(false);
  };

  const [decisions, setDecisions] = useState<DecisionEntry[]>(() => loadLog());

  useEffect(() => {
    setDecisions(loadLog());
  }, [isSaved]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cleanup: (() => void) | undefined;
    let interval: number | undefined;
    let initialized = false;

    const updateUserState = (user?: NetlifyIdentityUser | null) => {
      const hasUser = Boolean(user);
      setIsSignedIn(hasUser);
      const roles =
        hasUser && Array.isArray(user?.app_metadata?.roles) ? (user.app_metadata.roles as string[]) : [];
      setIsAdmin(hasUser && roles.includes("admin"));
    };

    const setupIdentity = () => {
      if (initialized) return true;

      const identity = (window as Window & { netlifyIdentity?: NetlifyIdentity }).netlifyIdentity;
      if (!identity || typeof identity.on !== "function") {
        return false;
      }

      initialized = true;
      const handleInit: IdentityEventHandler = (user) => updateUserState(user ?? undefined);
      const handleLogin: IdentityEventHandler = (user) => updateUserState(user ?? undefined);
      const handleLogout = () => updateUserState(undefined);
      const handleUserEvent: IdentityEventHandler = (user) => updateUserState(user ?? undefined);

      identity.on("init", handleInit);
      identity.on("login", handleLogin);
      identity.on("logout", handleLogout);
      identity.on("user", handleUserEvent);

      identity.init?.();

      const currentUser = identity.currentUser?.();
      if (currentUser) {
        updateUserState(currentUser);
      }

      cleanup = () => {
        identity.off?.("init", handleInit);
        identity.off?.("login", handleLogin);
        identity.off?.("logout", handleLogout);
        identity.off?.("user", handleUserEvent);
      };

      return true;
    };

    if (!setupIdentity()) {
      interval = window.setInterval(() => {
        if (setupIdentity()) {
          if (interval !== undefined) {
            window.clearInterval(interval);
          }
        }
      }, 500);
    }

    return () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
      cleanup?.();
    };
  }, []);

  const stats = useMemo<DashboardStats>(() => {
    const timeframeDays = timeWindow === "0" ? null : Number.parseInt(timeWindow, 10);
    return computeDashboardStats(decisions, { timeframeDays, cadenceUnit });
  }, [cadenceUnit, decisions, timeWindow]);

  const dnavSeries = useMemo(() => decisions.map((d) => d.dnav).slice().reverse(), [decisions]);

  const timeWindowLabels: Record<string, string> = {
    "0": "All time",
    "7": "Last 7 days",
    "30": "Last 30 days",
    "90": "Last 90 days",
  };

  const archetype = useMemo(() => getArchetype(metrics), [metrics]);
  const coachLine = useMemo(() => coachHint(variables, metrics), [metrics, variables]);
  const energyInfo = useMemo(
    () => energyTier(variables.urgency, variables.confidence),
    [variables.urgency, variables.confidence],
  );
  const scoreTag = useMemo(() => getScoreTagText(metrics.dnav), [metrics.dnav]);

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
    const sections = getStatsReportSections(current);
    sections.windowLabel = timeWindowLabels[timeWindow] ?? `Last ${timeWindow} days`;
    sections.cadenceLabel = cadenceUnit;
    sections.narrative = buildPortfolioNarrative(current, {
      timeframeLabel: sections.windowLabel,
      cadenceLabel: cadenceUnit,
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

  const hasData = stats.totalDecisions > 0;
  const returnDebtSummary = buildReturnDebtSummary(stats);

  const narrativeText = hasData
    ? buildPortfolioNarrative(stats, {
        timeframeLabel: timeWindowLabels[timeWindow] ?? `Last ${timeWindow} days`,
        cadenceLabel: cadenceUnit,
      })
    : "No decisions logged in this window. Import or record decisions to unlock narrative insights.";

  const showAnalytics = isSignedIn;

  const handleSignInClick = () => {
    if (typeof window === "undefined") return;
    const identity = (window as Window & { netlifyIdentity?: NetlifyIdentity }).netlifyIdentity;
    identity?.open?.("login");
  };

  const handleLogoutClick = () => {
    if (typeof window === "undefined") return;
    const identity = (window as Window & { netlifyIdentity?: NetlifyIdentity }).netlifyIdentity;
    identity?.logout?.();
  };

  const decisionArchHeading = "3. Understand Your Decision Arch";
  const decisionArchDescription =
    "One decision is a snapshot. A series of decisions becomes an arch. Track how return, pressure, and stability stack together so you can see whether you’re building momentum or burning energy.";

  return (
    <TooltipProvider>
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto p-6 space-y-12" ref={statsContainerRef}>
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3 max-w-3xl">
              <h1 className="text-3xl font-bold text-foreground">
                The D-NAV: A Live Readout of Your Judgment
              </h1>
              <p className="text-base text-muted-foreground">
                Every decision you make carries five forces: <strong>Impact</strong>, <strong>Cost</strong>, <strong>Risk</strong>, <strong>Urgency</strong> and <strong>Confidence</strong>.
              </p>
            </div>
            <div className="flex gap-2 self-start items-center">
              {isSignedIn ? (
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

          <section className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                1. Rate Your Decision
              </p>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Pick one real decision on your mind. Move each slider from 1–10 based on what feels true — not what sounds smart.
              </p>
            </div>

            <div className="space-y-4">
              <Input
                type="text"
                placeholder="What's Your Decision?"
                value={decisionName}
                onChange={(e) => setDecisionName(e.target.value)}
                className="h-12 text-base lg:text-lg"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Input
                  type="text"
                  placeholder="Categorize it"
                  value={decisionCategory}
                  onChange={(e) => setDecisionCategory(e.target.value)}
                  className="sm:w-60 lg:w-72"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <Button
                    onClick={handleSaveDecision}
                    className="w-full sm:w-auto"
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
                  <Button variant="outline" className="w-full sm:w-auto" asChild>
                    <Link href="/log#import" className="flex items-center justify-center">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Decisions
                    </Link>
                  </Button>
                  <Button variant="ghost" className="w-full sm:w-auto whitespace-nowrap" asChild>
                    <Link href="/contact">Book a consultation</Link>
                  </Button>
                </div>
              </div>
            </div>

            <DecisionCalculator onDataChange={handleDataChange} />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                2. See the Physics of This Decision
              </p>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Adjust the variables accordingly and see your RPS metrics.
              </p>
            </div>
            {isSignedIn ? (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleLogoutClick}>
                  Sign out
                </Button>
              </div>
            ) : null}
          </section>

          {showAnalytics ? (
            <>
              <section className="space-y-10">
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
                    <Select value={cadenceUnit} onValueChange={setCadenceUnit}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="day">Per day</SelectItem>
                          <SelectItem value="week">Per week</SelectItem>
                          <SelectItem value="month">Per month</SelectItem>
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
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Feedback Loops</h2>
                      <p className="text-sm text-muted-foreground">
                        How quickly your judgment recovers from bad calls — your learning half-life.
                      </p>
                    </div>
                    {FLAGS.showFeedbackLoops !== false && <FeedbackLoops series={dnavSeries} />}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5" />
                          Return Hygiene
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <InfoTooltip term="Loss Streak">
                              <p className="text-sm font-medium text-muted-foreground cursor-help">Loss Streak</p>
                            </InfoTooltip>
                            <InfoTooltip term="Loss Streak" side="bottom">
                              <div className="flex items-baseline gap-2 cursor-help">
                                <span className="text-2xl font-bold">{stats?.lossStreak.current || 0}</span>
                                <span className="text-sm text-muted-foreground">/ {stats?.lossStreak.longest || 0}</span>
                              </div>
                            </InfoTooltip>
                            <p className="text-xs text-muted-foreground">Current / longest streak</p>
                          </div>
                          <div className="space-y-2">
                            <InfoTooltip term="Return Debt">
                              <p className="text-sm font-medium text-muted-foreground cursor-help">Return Debt</p>
                            </InfoTooltip>
                            <InfoTooltip term="Return Debt" side="bottom">
                              <p className="text-2xl font-bold cursor-help">{formatValue(stats?.returnDebt ?? 0)}</p>
                            </InfoTooltip>
                            <p className="text-xs text-muted-foreground">Return debt (D-NAV units)</p>
                          </div>
                          <div className="space-y-2">
                            <InfoTooltip term="Payback Ratio">
                              <p className="text-sm font-medium text-muted-foreground cursor-help">Payback Ratio</p>
                            </InfoTooltip>
                            <InfoTooltip term="Payback Ratio" side="bottom">
                              <p className="text-2xl font-bold cursor-help">{formatValue(stats?.paybackRatio ?? 0)}</p>
                            </InfoTooltip>
                            <p className="text-xs text-muted-foreground">Avg +return per win in streak</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-4 leading-snug">{returnDebtSummary}</p>
                        <Separator className="my-4" />
                        <div className="flex items-start gap-2 p-4 bg-muted/50 rounded-lg">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">
                            <strong>Remember:</strong> Losses aren’t “bad.” Unmanaged streaks are. Track them so “learning” doesn’t become a silent bleed.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Consistency</h2>
                      <p className="text-sm text-muted-foreground">
                        How reliably your decisions line up with your goals, instead of reacting to noise.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                      <DashboardStatCard
                        title="Total Decisions"
                        value={stats?.totalDecisions || 0}
                        subtitle="In selected timeframe"
                        icon={Target}
                      />
                      <DashboardStatCard
                        title="Average D-NAV"
                        value={stats?.avgDnav || 0}
                        subtitle="Composite score"
                        icon={Gauge}
                        trend={stats?.trend}
                        color={
                          stats?.avgDnav && stats.avgDnav > 25
                            ? "positive"
                            : stats?.avgDnav && stats.avgDnav < 0
                            ? "negative"
                            : "default"
                        }
                      />
                      <DashboardStatCard
                        title="Decision Cadence"
                        value={stats?.cadence || 0}
                        subtitle={`Decisions per ${cadenceUnit}`}
                        icon={Activity}
                      />
                      <DashboardStatCard
                        title="Return on Effort"
                        value={stats?.returnOnEffort || 0}
                        subtitle="Return per unit energy"
                        icon={Zap}
                        color={stats?.returnOnEffort && stats.returnOnEffort > 0 ? "positive" : "default"}
                      />
                      <DashboardStatCard
                        title="Recent Trend"
                        value={formatValue(stats?.last5vsPrior5 ?? 0)}
                        subtitle="D-NAV change"
                        icon={LineChart}
                        color={
                          stats?.last5vsPrior5 && stats.last5vsPrior5 > 0
                            ? "positive"
                            : stats?.last5vsPrior5 && stats.last5vsPrior5 < 0
                            ? "negative"
                            : "default"
                        }
                        helper="Last 5 decisions vs. prior 5"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Patterns &amp; Archetypes</h2>
                      <p className="text-sm text-muted-foreground">
                        Your dominant decision patterns and behavioral tendencies — how you show up across decisions.
                      </p>
                    </div>
                    <Card>
                      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <CardTitle>Portfolio Narrative</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{narrativeText}</p>
                      </CardContent>
                    </Card>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <DistributionCard
                        title="Return Distribution"
                        segments={[
                          {
                            label: "Positive",
                            value: stats.returnDistribution.positive,
                            color: "#22c55e",
                            metricKey: "positive",
                          },
                          {
                            label: "Neutral",
                            value: stats.returnDistribution.neutral,
                            color: "#64748b",
                            metricKey: "neutral",
                          },
                          {
                            label: "Negative",
                            value: stats.returnDistribution.negative,
                            color: "#ef4444",
                            metricKey: "negative",
                          },
                        ]}
                      />
                      <DistributionCard
                        title="Stability Distribution"
                        segments={[
                          {
                            label: "Stable",
                            value: stats.stabilityDistribution.stable,
                            color: "#3b82f6",
                            metricKey: "stable",
                          },
                          {
                            label: "Uncertain",
                            value: stats.stabilityDistribution.uncertain,
                            color: "#f59e0b",
                            metricKey: "uncertain",
                          },
                          {
                            label: "Fragile",
                            value: stats.stabilityDistribution.fragile,
                            color: "#f43f5e",
                            metricKey: "fragile",
                          },
                        ]}
                      />
                      <DistributionCard
                        title="Pressure Distribution"
                        segments={[
                          {
                            label: "Pressured",
                            value: stats.pressureDistribution.pressured,
                            color: "#ef4444",
                            metricKey: "pressured",
                          },
                          {
                            label: "Balanced",
                            value: stats.pressureDistribution.balanced,
                            color: "#64748b",
                            metricKey: "balanced",
                          },
                          {
                            label: "Calm",
                            value: stats.pressureDistribution.calm,
                            color: "#14b8a6",
                            metricKey: "calm",
                          },
                        ]}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-2">
                          <InfoTooltip term="Window Archetype">
                            <CardTitle className="text-base cursor-help">Window Archetype</CardTitle>
                          </InfoTooltip>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="text-xl font-semibold">{stats.windowArchetype}</p>
                          <p className="text-sm text-muted-foreground leading-snug">
                            {stats.windowArchetypeDescription}
                          </p>
                          <Separator className="my-2" />
                          <div className="grid grid-cols-1 gap-1 text-sm text-muted-foreground">
                            <span>Return: {stats.windowArchetypeBreakdown.returnType}</span>
                            <span>Stability: {stats.windowArchetypeBreakdown.stabilityType}</span>
                            <span>Pressure: {stats.windowArchetypeBreakdown.pressureType}</span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Archetype Deep Dive</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{archetype.description}</p>
                          </div>
                          <Separator />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Merit</p>
                              <p className="font-mono text-lg text-foreground">{metrics.merit}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Energy</p>
                              <p className="font-mono text-lg text-foreground">{metrics.energy}</p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</p>
                              <p className="text-sm text-muted-foreground">
                                {scoreTag} — {energyInfo.name}
                              </p>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coach</p>
                              <p className="text-sm text-muted-foreground leading-relaxed">{coachLine}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </section>

              <Card className="border border-primary/40 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold text-foreground">
                    Turn One Decision Into a Decision Story
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This live check is just the first layer. In a Decision Audit, we run a small batch of your real decisions through D-NAV, map your judgment patterns, and build a cadence that reduces re-decisions and increases stability under pressure.
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>Score a set of meaningful decisions across Impact, Cost, Risk, Urgency, Confidence</li>
                    <li>See your Return / Stability / Pressure profile across those calls</li>
                    <li>Identify your dominant archetypes and blind spots</li>
                    <li>Design a 30–90 day decision cadence for your team</li>
                  </ul>
                  <div className="space-y-2">
                    <Button size="lg" asChild>
                      <Link href="/contact">Book a consultation</Link>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Client dashboards and full analytics are available only for active teams.
                    </p>
                  </div>
                </CardContent>
              </Card>

            </>
          ) : (
            <section className="py-16">
              <div className="mx-auto max-w-2xl text-center space-y-6">
                <h2 className="text-3xl font-semibold text-foreground">Already a client?</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sign in to view your full analytics — long-term return, stability, pressure, and feedback loops for your
                  decisions.
                </p>
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <Button size="lg" onClick={handleSignInClick}>
                    Sign In to View Analytics
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Client dashboards and full analytics are available only to active teams.
                </p>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              {decisionArchHeading}
            </p>
            <p className="text-sm text-muted-foreground max-w-3xl">{decisionArchDescription}</p>
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
