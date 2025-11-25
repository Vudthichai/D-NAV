"use client";

import CompareSheet from "@/components/CompareSheet";
import SliderRow from "@/components/SliderRow";
import StatCard from "@/components/StatCard";
import SummaryCard from "@/components/SummaryCard";
import { InfoTooltip } from "@/components/InfoTooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  ArrowUpDown,
  Info,
  RotateCcw,
  Save,
  Upload,
  X,
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
  type JudgmentDecision,
} from "@/utils/judgmentDashboard";
import {
  generateArchetypeSummary,
  generateCategorySummary,
  generateLearningRecoverySummary,
  generateRPSSummary,
} from "@/utils/sectionSummaries";

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
  tooltip?: string;
}

type CategorySortKey =
  | "category"
  | "decisionCount"
  | "percent"
  | "avgDnav"
  | "avgR"
  | "avgP"
  | "avgS"
  | "dominantVariable";

type ArchetypeDecisionSortKey =
  | "title"
  | "category"
  | "impact0"
  | "cost0"
  | "risk0"
  | "urgency0"
  | "confidence0"
  | "return0"
  | "pressure0"
  | "stability0"
  | "dnavScore";

type ArchetypeTableSortKey = "archetype" | "count" | "avgR" | "avgP" | "avgS" | "avgDnav";

const TOOLTIP_COPY: Record<string, string> = {
  "Learning Curve Index":
    "LCI measures how quickly your performance improves after negative-return decisions. Higher values (closer to 1.0) indicate faster recovery.",
  "Decisions to recover":
    "Average number of decisions it takes to recover to your previous performance level after a loss.",
  "Win rate": "Percentage of decisions with a positive Return.",
  "Decision debt": "Percentage of decisions in this window with negative Return.",
  "Total decisions": "Number of logged decisions in the selected time window.",
  "Avg Return (R)": "Average outcome of your decisions. Positive = beneficial, Negative = costly.",
  "Avg Pressure (P)": "Average pressure or burden created by your decisions (time, effort, stress).",
  "Avg Stability (S)": "Average stability of your decision outcomes over time. Higher is more stable.",
  "Return distribution": "Share of decisions with positive, neutral, or negative Return.",
  "Pressure distribution": "Share of decisions with positive, neutral, or negative Pressure.",
  "Stability distribution": "Share of decisions with positive, neutral, or negative Stability.",
  "Best Return": "Decision with the highest/lowest Return in the selected window.",
  "Worst Return": "Decision with the highest/lowest Return in the selected window.",
  "Best Pressure": "Decision with the highest/lowest Pressure in the selected window.",
  "Worst Pressure": "Decision with the highest/lowest Pressure in the selected window.",
  "Best Stability": "Decision with the highest/lowest Stability in the selected window.",
  "Worst Stability": "Decision with the highest/lowest Stability in the selected window.",
  "Heatmap#": "Number of decisions logged in this category.",
  "Heatmap%": "Share of your total decisions that fall in this category.",
  "Heatmap Avg D-NAV": "Average D-NAV score for decisions in this category.",
  "Heatmap Avg R": "Average Return for decisions in this category.",
  "Heatmap Avg P": "Average Pressure for decisions in this category.",
  "Heatmap Avg S": "Average Stability for decisions in this category.",
  "Heatmap Dominant":
    "The variable (Impact, Cost, Risk, Urgency, or Confidence) with the highest average weight in this category.",
  "Primary Archetype": "The most common decision archetype in the selected window.",
  "Secondary Archetype": "The second most frequent decision archetype in the selected window.",
  "Archetype#": "Number of decisions in this archetype.",
  "Archetype Avg R": "Average Return for decisions in this archetype.",
  "Archetype Avg P": "Average Pressure for decisions in this archetype.",
  "Archetype Avg S": "Average Stability for decisions in this archetype.",
  "Archetype Avg D-NAV": "Average D-NAV score for this archetype.",
  "Archetype Top categories": "The categories where this archetype appears most often.",
};

const TooltipLabel = ({
  label,
  tooltip,
  className = "",
}: {
  label: React.ReactNode;
  tooltip?: string;
  className?: string;
}) => {
  if (!tooltip) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
          <span>{label}</span>
          <Info className="h-3 w-3 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm leading-snug">{tooltip}</TooltipContent>
    </Tooltip>
  );
};

const DistributionCard = ({ title, segments, tooltip }: DistributionCardProps) => {
  const safeSegments = segments.map((segment) => ({
    ...segment,
    value: Number.isFinite(segment.value) ? Math.max(segment.value, 0) : 0,
  }));
  const hasData = safeSegments.some((segment) => segment.value > 0);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          <TooltipLabel label={title} tooltip={tooltip} />
        </h3>
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

const CompactMetric = ({ label, value, tooltip }: { label: string; value: string | number; tooltip?: string }) => (
  <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
    <TooltipLabel label={label} tooltip={tooltip} className="text-xs text-muted-foreground" />
    <p className="text-lg font-semibold text-foreground">{value}</p>
  </div>
);

const DecisionHighlightRow = ({ label, decision }: { label: string; decision: JudgmentDecision }) => (
  <div className="overflow-x-auto">
    <div className="flex min-w-[1050px] items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="w-32 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <Badge variant="secondary" className="shrink-0">
        {decision.category || "Uncategorized"}
      </Badge>
      <p className="flex-1 min-w-[220px] truncate text-sm font-semibold text-foreground">{decision.title}</p>

      <div className="flex items-center gap-4">
        {[{ label: "R", value: decision.return0 }, { label: "P", value: decision.pressure0 }, { label: "S", value: decision.stability0 }].map(
          (metric) => (
            <div key={`${label}-${metric.label}`} className="min-w-[70px]">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">{metric.label}</p>
              <p className="text-sm font-semibold text-foreground">{formatValue(metric.value)}</p>
            </div>
          ),
        )}
      </div>

      <div className="min-w-[90px] pl-2">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">D-NAV</p>
        <p className="text-sm font-semibold text-foreground">{formatValue(decision.dnavScore)}</p>
      </div>

      <div className="flex items-center gap-3 pl-2">
        {[
          { label: "Impact", value: decision.impact0 },
          { label: "Cost", value: decision.cost0 },
          { label: "Risk", value: decision.risk0 },
          { label: "Urgency", value: decision.urgency0 },
          { label: "Confidence", value: decision.confidence0 },
        ].map((metric) => (
          <div key={`${label}-${metric.label}`} className="min-w-[80px] text-right">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground text-left">{metric.label}</p>
            <p className="text-sm font-medium text-foreground">{formatValue(metric.value)}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

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
  const [categorySort, setCategorySort] = useState<{ key: CategorySortKey; direction: "asc" | "desc" }>(
    { key: "decisionCount", direction: "desc" },
  );
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypePatternRow | null>(null);
  const [archetypeTableSort, setArchetypeTableSort] = useState<{
    key: ArchetypeTableSortKey;
    direction: "asc" | "desc";
  }>({ key: "count", direction: "desc" });
  const [archetypeDecisionSort, setArchetypeDecisionSort] = useState<{
    key: ArchetypeDecisionSortKey;
    direction: "asc" | "desc";
  }>({ key: "title", direction: "asc" });

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

  const { baseline, learning, hygiene, categories, archetypes, normalized } = {
    ...judgment,
  };

  const rpsSummary = useMemo(() => generateRPSSummary(baseline), [baseline]);
  const learningSummary = useMemo(
    () => generateLearningRecoverySummary(learning, hygiene),
    [learning, hygiene],
  );
  const sortedCategories = useMemo(() => {
    const sorted = [...categories];
    sorted.sort((a, b) => {
      const { key, direction } = categorySort;
      const first = a[key];
      const second = b[key];

      if (typeof first === "number" && typeof second === "number") {
        return direction === "asc" ? first - second : second - first;
      }

      return direction === "asc"
        ? String(first).localeCompare(String(second))
        : String(second).localeCompare(String(first));
    });
    return sorted;
  }, [categories, categorySort]);
  const categorySummary = useMemo(() => generateCategorySummary(sortedCategories), [sortedCategories]);
  const sortedArchetypeRows = useMemo(() => {
    const sorted = [...archetypes.rows];
    sorted.sort((a, b) => {
      const { key, direction } = archetypeTableSort;
      const first = a[key];
      const second = b[key];

      if (typeof first === "number" && typeof second === "number") {
        return direction === "asc" ? first - second : second - first;
      }

      return direction === "asc"
        ? String(first).localeCompare(String(second))
        : String(second).localeCompare(String(first));
    });
    return sorted;
  }, [archetypes.rows, archetypeTableSort]);
  const archetypeSummary = useMemo(() => generateArchetypeSummary(archetypes), [archetypes]);

  const archetypeDecisions = useMemo(
    () =>
      selectedArchetype
        ? normalized.filter((decision) => decision.archetype === selectedArchetype.archetype)
        : [],
    [normalized, selectedArchetype],
  );

  const sortedArchetypeDecisions = useMemo(() => {
    const sorted = [...archetypeDecisions];
    sorted.sort((a, b) => {
      const { key, direction } = archetypeDecisionSort;
      const first = a[key];
      const second = b[key];

      if (typeof first === "number" && typeof second === "number") {
        return direction === "asc" ? first - second : second - first;
      }

      return direction === "asc"
        ? String(first).localeCompare(String(second))
        : String(second).localeCompare(String(first));
    });
    return sorted;
  }, [archetypeDecisions, archetypeDecisionSort]);

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

  const handleCategorySort = (key: CategorySortKey) => {
    setCategorySort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" },
    );
  };

  const handleArchetypeTableSort = (key: ArchetypeTableSortKey) => {
    setArchetypeTableSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" },
    );
  };

  const handleArchetypeDecisionSort = (key: ArchetypeDecisionSortKey) => {
    setArchetypeDecisionSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" },
    );
  };

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
                        <CardHeader className="pb-3 space-y-2">
                          <CardTitle className="text-xl font-semibold">RPS Baseline</CardTitle>
                          <p className="text-sm text-muted-foreground">{rpsSummary}</p>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <CompactMetric
                              label="Total decisions"
                              value={baseline.total}
                              tooltip={TOOLTIP_COPY["Total decisions"]}
                            />
                            <CompactMetric
                              label="Avg Return (R)"
                              value={formatValue(baseline.avgReturn)}
                              tooltip={TOOLTIP_COPY["Avg Return (R)"]}
                            />
                            <CompactMetric
                              label="Avg Pressure (P)"
                              value={formatValue(baseline.avgPressure)}
                              tooltip={TOOLTIP_COPY["Avg Pressure (P)"]}
                            />
                            <CompactMetric
                              label="Avg Stability (S)"
                              value={formatValue(baseline.avgStability)}
                              tooltip={TOOLTIP_COPY["Avg Stability (S)"]}
                            />
                          </div>

                          <p className="text-sm text-muted-foreground">
                            Avg RPS represent the average observed outcome of your logged decisions.
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <DistributionCard
                              title="Return distribution"
                              tooltip={TOOLTIP_COPY["Return distribution"]}
                              segments={baseline.returnSegments}
                            />
                            <DistributionCard
                              title="Pressure distribution"
                              tooltip={TOOLTIP_COPY["Pressure distribution"]}
                              segments={baseline.pressureSegments}
                            />
                            <DistributionCard
                              title="Stability distribution"
                              tooltip={TOOLTIP_COPY["Stability distribution"]}
                              segments={baseline.stabilitySegments}
                            />
                          </div>

                          <div className="space-y-3">
                            {baseline.total > 0 ? (
                              baseline.bestWorst.map((item) =>
                                item.decision ? (
                                  <DecisionHighlightRow key={item.label} label={item.label} decision={item.decision} />
                                ) : null,
                              )
                            ) : (
                              <p className="text-sm text-muted-foreground">No logged decisions to display yet.</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3 space-y-2">
                          <CardTitle className="text-xl font-semibold">Learning &amp; Recovery</CardTitle>
                          <p className="text-sm text-muted-foreground">{learningSummary}</p>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <CompactMetric
                              label="Learning Curve Index"
                              value={learning.lci ? formatValue(learning.lci, 2) : "—"}
                              tooltip={TOOLTIP_COPY["Learning Curve Index"]}
                            />
                            <CompactMetric
                              label="Decisions to recover"
                              value={formatValue(learning.decisionsToRecover, 1)}
                              tooltip={TOOLTIP_COPY["Decisions to recover"]}
                            />
                            <CompactMetric
                              label="Win rate"
                              value={`${formatValue(learning.winRate)}%`}
                              tooltip={TOOLTIP_COPY["Win rate"]}
                            />
                            <CompactMetric
                              label="Decision debt"
                              value={`${formatValue(hygiene.decisionDebt)}%`}
                              tooltip={TOOLTIP_COPY["Decision debt"]}
                            />
                          </div>
                        </CardContent>
                      </Card>

                    <Card>
                      <CardHeader className="pb-3 space-y-2">
                        <CardTitle className="text-xl font-semibold">Decision Category Heatmap</CardTitle>
                        <p className="text-sm text-muted-foreground">{categorySummary}</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {sortedCategories.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No categories in view.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {[ 
                                    { key: "category", label: "Category" },
                                    { key: "decisionCount", label: "#", tooltip: TOOLTIP_COPY["Heatmap#"] },
                                    { key: "percent", label: "%", tooltip: TOOLTIP_COPY["Heatmap%"] },
                                    { key: "avgDnav", label: "Avg D-NAV", tooltip: TOOLTIP_COPY["Heatmap Avg D-NAV"] },
                                    { key: "avgR", label: "Avg R", tooltip: TOOLTIP_COPY["Heatmap Avg R"] },
                                    { key: "avgP", label: "Avg P", tooltip: TOOLTIP_COPY["Heatmap Avg P"] },
                                    { key: "avgS", label: "Avg S", tooltip: TOOLTIP_COPY["Heatmap Avg S"] },
                                    { key: "dominantVariable", label: "Dominant", tooltip: TOOLTIP_COPY["Heatmap Dominant"] },
                                  ].map((column) => (
                                    <TableHead key={column.key} className="text-right first:text-left">
                                      <button
                                        type="button"
                                        className="flex items-center gap-1 w-full justify-between text-left"
                                        onClick={() => handleCategorySort(column.key as CategorySortKey)}
                                      >
                                        <TooltipLabel
                                          label={column.label}
                                          tooltip={column.tooltip}
                                          className="inline-flex items-center gap-1"
                                        />
                                        <ArrowUpDown className="h-4 w-4" />
                                      </button>
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedCategories.map((row: CategoryHeatmapRow) => (
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
                      <CardHeader className="pb-3 space-y-2">
                        <CardTitle className="text-xl font-semibold">Archetypes &amp; Patterns</CardTitle>
                        <p className="text-sm text-muted-foreground">{archetypeSummary}</p>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <CompactMetric
                            label="Primary Archetype"
                            value={archetypes.primary}
                            tooltip={TOOLTIP_COPY["Primary Archetype"]}
                          />
                          <CompactMetric
                            label="Secondary Archetype"
                            value={archetypes.secondary}
                            tooltip={TOOLTIP_COPY["Secondary Archetype"]}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <DistributionCard
                            title="Return Distribution"
                            segments={archetypes.distributions.returnSegments}
                          />
                          <DistributionCard
                            title="Pressure Distribution"
                            segments={archetypes.distributions.pressureSegments}
                          />
                          <DistributionCard
                            title="Stability Distribution"
                            segments={archetypes.distributions.stabilitySegments}
                          />
                        </div>

                        {archetypes.rows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No archetype data yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {[
                                    { key: "archetype", label: "Archetype" },
                                    { key: "count", label: "#", tooltip: TOOLTIP_COPY["Archetype#"] },
                                    { key: "avgR", label: "Avg R", tooltip: TOOLTIP_COPY["Archetype Avg R"] },
                                    { key: "avgP", label: "Avg P", tooltip: TOOLTIP_COPY["Archetype Avg P"] },
                                    { key: "avgS", label: "Avg S", tooltip: TOOLTIP_COPY["Archetype Avg S"] },
                                    { key: "avgDnav", label: "Avg D-NAV", tooltip: TOOLTIP_COPY["Archetype Avg D-NAV"] },
                                  ].map((column) => (
                                    <TableHead key={column.key} className="text-right first:text-left">
                                      <button
                                        type="button"
                                        className="flex items-center gap-1 w-full justify-between text-left"
                                        onClick={() => handleArchetypeTableSort(column.key as ArchetypeTableSortKey)}
                                      >
                                        <TooltipLabel
                                          label={column.label}
                                          tooltip={column.tooltip}
                                          className="inline-flex items-center gap-1"
                                        />
                                        <ArrowUpDown className="h-4 w-4" />
                                      </button>
                                    </TableHead>
                                  ))}
                                  <TableHead className="text-right">
                                    <TooltipLabel label="Top categories" tooltip={TOOLTIP_COPY["Archetype Top categories"]} />
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedArchetypeRows.map((row: ArchetypePatternRow) => (
                                  <TableRow
                                    key={row.archetype}
                                    className="hover:bg-muted/50 cursor-pointer"
                                    onClick={() => setSelectedArchetype(row)}
                                  >
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
                  </div>
                  <Dialog
                    open={!!selectedArchetype}
                    onOpenChange={(open) => setSelectedArchetype(open ? selectedArchetype : null)}
                  >
                    <DialogContent className="sm:max-w-5xl">
                      <DialogHeader className="pr-10">
                        <DialogTitle>
                          {selectedArchetype ? `${selectedArchetype.archetype} decisions` : "Archetype decisions"}
                        </DialogTitle>
                      </DialogHeader>
                      <DialogClose className="absolute right-4 top-4 rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                      </DialogClose>
                      {selectedArchetype && (
                        <div className="space-y-3">
                          <div className="overflow-x-auto">
                            <Table className="text-sm min-w-[1000px]">
                              <TableHeader>
                                <TableRow>
                                  {[
                                    { key: "title", label: "Title" },
                                    { key: "category", label: "Category" },
                                    { key: "impact0", label: "Impact" },
                                    { key: "cost0", label: "Cost" },
                                    { key: "risk0", label: "Risk" },
                                    { key: "urgency0", label: "Urgency" },
                                    { key: "confidence0", label: "Confidence" },
                                    { key: "return0", label: "Return" },
                                    { key: "pressure0", label: "Pressure" },
                                    { key: "stability0", label: "Stability" },
                                    { key: "dnavScore", label: "D-NAV" },
                                  ].map((column) => (
                                    <TableHead key={column.key} className="text-right first:text-left">
                                      <button
                                        type="button"
                                        className="flex items-center gap-1 w-full justify-between text-left"
                                        onClick={() =>
                                          handleArchetypeDecisionSort(column.key as ArchetypeDecisionSortKey)
                                        }
                                      >
                                        <span>{column.label}</span>
                                        <ArrowUpDown className="h-4 w-4" />
                                      </button>
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedArchetypeDecisions.map((decision) => (
                                  <TableRow key={decision.id}>
                                    <TableCell className="font-medium">{decision.title}</TableCell>
                                    <TableCell className="text-right">{decision.category}</TableCell>
                                    <TableCell className="text-right">{formatValue(decision.impact0)}</TableCell>
                                    <TableCell className="text-right">{formatValue(decision.cost0)}</TableCell>
                                    <TableCell className="text-right">{formatValue(decision.risk0)}</TableCell>
                                    <TableCell className="text-right">{formatValue(decision.urgency0)}</TableCell>
                                    <TableCell className="text-right">{formatValue(decision.confidence0)}</TableCell>
                                    <TableCell className="text-right">{formatValue(decision.return0)}</TableCell>
                                    <TableCell className="text-right">{formatValue(decision.pressure0)}</TableCell>
                                    <TableCell className="text-right">{formatValue(decision.stability0)}</TableCell>
                                    <TableCell className="text-right">{formatValue(decision.dnavScore)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
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
