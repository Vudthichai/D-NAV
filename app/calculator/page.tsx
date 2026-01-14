"use client";

import { InfoTooltip } from "@/components/InfoTooltip";
import { useDataset } from "@/components/DatasetProvider";
import DatasetPickerRow from "@/components/datasets/DatasetPickerRow";
import StressTestCalculator from "@/components/stress-test/StressTestCalculator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { getArchetype } from "@/lib/calculations";
import { CompanyPeriodSnapshot, generateFullInterpretation } from "@/lib/dnavSummaryEngine";
import { buildCategoryActionInsight, type CategoryActionInsight } from "@/lib/insights";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import {
  Download,
  FileText,
  ArrowUpDown,
  ArrowDownRight,
  ArrowUpRight,
  Info,
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useEffect, useMemo, useRef, useState } from "react";
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
  computeRpsBaseline,
  filterDecisionsByTimeframe,
  filterPreviousDecisionsByTimeframe,
  normalizeDecision,
  type ArchetypePatternRow,
  type CategoryHeatmapRow,
  type JudgmentDecision,
} from "@/utils/judgmentDashboard";
import { cn } from "@/lib/utils";
import { type CompanyContext } from "@/types/company";
import { datasetMetaToCompanyContext } from "@/types/dataset";
import { mean, stdev } from "@/utils/stats";


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

type CategorySelection = {
  kind: "category" | "misc";
  row: CategoryHeatmapRow;
  decisions: JudgmentDecision[];
  includedCategories?: CategoryHeatmapRow[];
};


const TOOLTIP_COPY: Record<string, string> = {
  "Learning Curve Index":
    "LCI measures how quickly your performance improves after negative-return decisions. Higher values (closer to 1.0) indicate faster recovery.",
  "Decisions to recover":
    "Average number of decisions it takes to recover to your previous performance level after a loss.",
  "Win rate": "Percentage of decisions with a positive Return.",
  "Decision debt": "Percentage of decisions in this window with negative Return.",
  "Total decisions": "Number of logged decisions in the selected time window.",
  "Avg D-NAV": "Average D-NAV across all decisions in this time window.",
  "Avg Return (R)": "Average outcome of your decisions. Positive = beneficial, Negative = costly.",
  "Avg Pressure (P)": "Average pressure or burden created by your decisions (time, effort, stress).",
  "Avg Stability (S)": "Average stability of your decision outcomes over time. Higher is more stable.",
  "Return distribution": "Share of decisions with positive, neutral, or negative Return.",
  "Pressure distribution": "Share of decisions with positive, neutral, or negative Pressure.",
  "Stability distribution": "Share of decisions with positive, neutral, or negative Stability.",
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

const TIME_WINDOW_LABELS: Record<string, string> = {
  "0": "All time",
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
};

type ColumnDefinition = {
  key: string;
  label: string;
  align: "left" | "right";
  width: string;
  tooltip?: string;
  sortable?: boolean;
};

const categoryColumns: ColumnDefinition[] = [
  { key: "category", label: "Category", align: "left", width: "minmax(160px, 2fr)" },
  { key: "decisionCount", label: "#", align: "right", width: "minmax(64px, 0.8fr)", tooltip: TOOLTIP_COPY["Heatmap#"] },
  { key: "percent", label: "%", align: "right", width: "minmax(80px, 1fr)", tooltip: TOOLTIP_COPY["Heatmap%"] },
  {
    key: "avgDnav",
    label: "Avg D-NAV",
    align: "right",
    width: "minmax(96px, 1fr)",
    tooltip: TOOLTIP_COPY["Heatmap Avg D-NAV"],
  },
  { key: "avgR", label: "Avg R", align: "right", width: "minmax(72px, 1fr)", tooltip: TOOLTIP_COPY["Heatmap Avg R"] },
  { key: "avgP", label: "Avg P", align: "right", width: "minmax(72px, 1fr)", tooltip: TOOLTIP_COPY["Heatmap Avg P"] },
  { key: "avgS", label: "Avg S", align: "right", width: "minmax(72px, 1fr)", tooltip: TOOLTIP_COPY["Heatmap Avg S"] },
  {
    key: "dominantVariable",
    label: "Dominant",
    align: "left",
    width: "minmax(120px, 1.4fr)",
    tooltip: TOOLTIP_COPY["Heatmap Dominant"],
  },
];

const categoryGridTemplate = categoryColumns.map((column) => column.width).join(" ");

const archetypeColumns: ColumnDefinition[] = [
  { key: "archetype", label: "Archetype", align: "left", width: "minmax(160px, 2fr)" },
  { key: "count", label: "#", align: "right", width: "minmax(64px, 0.8fr)", tooltip: TOOLTIP_COPY["Archetype#"] },
  { key: "avgR", label: "Avg R", align: "right", width: "minmax(72px, 1fr)", tooltip: TOOLTIP_COPY["Archetype Avg R"] },
  { key: "avgP", label: "Avg P", align: "right", width: "minmax(72px, 1fr)", tooltip: TOOLTIP_COPY["Archetype Avg P"] },
  { key: "avgS", label: "Avg S", align: "right", width: "minmax(72px, 1fr)", tooltip: TOOLTIP_COPY["Archetype Avg S"] },
  {
    key: "avgDnav",
    label: "Avg D-NAV",
    align: "right",
    width: "minmax(96px, 1fr)",
    tooltip: TOOLTIP_COPY["Archetype Avg D-NAV"],
  },
  {
    key: "topCategories",
    label: "Top categories",
    align: "left",
    width: "minmax(180px, 2fr)",
    tooltip: TOOLTIP_COPY["Archetype Top categories"],
    sortable: false,
  },
];

const archetypeGridTemplate = archetypeColumns.map((column) => column.width).join(" ");

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
  const displaySegments = safeSegments.map((segment) => ({
    ...segment,
    width: hasData ? segment.value : 1,
  }));

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          <TooltipLabel label={title} tooltip={tooltip} className="whitespace-nowrap" />
        </h3>
        <>
          <div className="h-3 rounded-full bg-muted overflow-hidden flex">
            {displaySegments.map((segment) => (
              <InfoTooltip
                key={`${title}-${segment.metricKey}-bar`}
                term={`${title}|${segment.metricKey}`}
                side="bottom"
              >
                <div
                  className="h-full cursor-help"
                  style={{
                    flexGrow: segment.width,
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

          {!hasData && <p className="text-xs text-muted-foreground">No logged decisions yet—showing placeholder segments.</p>}
        </>
      </CardContent>
    </Card>
  );
};

const CompactMetric = ({
  label,
  value,
  tooltip,
  delta,
}: {
  label: string;
  value: string | number;
  tooltip?: string;
  delta?: number | null;
}) => (
  <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
    <TooltipLabel
      label={label}
      tooltip={tooltip}
      className="text-xs text-muted-foreground whitespace-nowrap"
    />
    <div className="flex items-baseline gap-2">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      {delta !== undefined && (
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            delta === null ? "text-muted-foreground" : delta > 0 ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {delta === null ? (
            "(N/A vs previous period)"
          ) : (
            <>
              {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {`${delta > 0 ? "+" : "-"}${formatValue(Math.abs(delta))} vs previous period`}
            </>
          )}
        </span>
      )}
    </div>
  </div>
);

const buildDistributionSegments = (
  values: number[],
  palette: { positive: string; neutral: string; negative: string },
): DistributionSegment[] => {
  const counts = values.reduce(
    (acc, value) => {
      if (value > 0) acc.positive += 1;
      else if (value < 0) acc.negative += 1;
      else acc.neutral += 1;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 },
  );

  const total = Math.max(values.length, 1);

  return [
    { label: "Positive", value: (counts.positive / total) * 100, color: palette.positive, metricKey: "positive" },
    { label: "Neutral", value: (counts.neutral / total) * 100, color: palette.neutral, metricKey: "neutral" },
    { label: "Negative", value: (counts.negative / total) * 100, color: palette.negative, metricKey: "negative" },
  ];
};

const buildCategoryRollupRow = (
  label: string,
  decisions: JudgmentDecision[],
  totalDecisions: number,
): CategoryHeatmapRow => {
  const avg = (selector: (decision: JudgmentDecision) => number) => mean(decisions.map(selector));
  const std = (selector: (decision: JudgmentDecision) => number) => stdev(decisions.map(selector));
  const impactAvg = avg((decision) => decision.impact0);
  const costAvg = avg((decision) => decision.cost0);
  const riskAvg = avg((decision) => decision.risk0);
  const urgencyAvg = avg((decision) => decision.urgency0);
  const confidenceAvg = avg((decision) => decision.confidence0);
  const returnDrifts = decisions
    .map((decision) => (decision.return1 !== undefined ? decision.return1 - decision.return0 : null))
    .filter((value): value is number => value !== null);

  const dominantPairs: [string, number][] = [
    ["Impact", Math.abs(impactAvg)],
    ["Cost", Math.abs(costAvg)],
    ["Risk", Math.abs(riskAvg)],
    ["Urgency", Math.abs(urgencyAvg)],
    ["Confidence", Math.abs(confidenceAvg)],
  ];
  const dominantVariable = dominantPairs.sort((a, b) => b[1] - a[1])[0][0];

  return {
    category: label,
    decisionCount: decisions.length,
    percent: totalDecisions > 0 ? (decisions.length / totalDecisions) * 100 : 0,
    avgDnav: avg((decision) => decision.dnavScore),
    avgR: avg((decision) => decision.return0),
    avgP: avg((decision) => decision.pressure0),
    avgS: avg((decision) => decision.stability0),
    avgImpact: impactAvg,
    avgCost: costAvg,
    avgRisk: riskAvg,
    avgUrgency: urgencyAvg,
    avgConfidence: confidenceAvg,
    dominantVariable,
    stdDnav: std((decision) => decision.dnavScore),
    stdReturn: std((decision) => decision.return0),
    avgReturnDrift: returnDrifts.length ? mean(returnDrifts) : 0,
  };
};

const signalBadgeStyles: Record<CategoryActionInsight["signal"], string> = {
  Strong: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  Mixed: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  Weak: "bg-muted text-muted-foreground border-border",
};

const segmentsToDistribution = (segments: { metricKey: string; value: number; label: string }[]) => ({
  positivePct: segments.find((segment) => segment.metricKey === "positive")?.value ?? 0,
  neutralPct: segments.find((segment) => segment.metricKey === "neutral")?.value ?? 0,
  negativePct: segments.find((segment) => segment.metricKey === "negative")?.value ?? 0,
});

const fallbackCompanyName = (context?: CompanyContext | null) =>
  context?.companyName?.trim() || "This company";

const fallbackPeriodLabel = (
  context: CompanyContext | null,
  timeWindow: string,
  labels: Record<string, string>,
) => context?.timeframeLabel?.trim() || labels[timeWindow] || "Selected window";

const ArchetypeSummaryCard = ({
  title,
  row,
  tooltip,
}: {
  title: string;
  row?: ArchetypePatternRow;
  tooltip?: string;
}) => {
  const summary = row ? (
    <p className="text-sm text-muted-foreground">
      <span className="font-semibold">R</span> {formatValue(row.avgR)} | <span className="font-semibold">P</span> {formatValue(row.avgP)} | <span className="font-semibold">S</span> {formatValue(row.avgS)}
    </p>
  ) : (
    <p className="text-sm text-muted-foreground">No data in this window</p>
  );
  const description = row
    ? getArchetype({ return: row.avgR, pressure: row.avgP, stability: row.avgS, merit: 0, energy: 0, dnav: row.avgDnav })
        .description
    : "Log more decisions to surface this archetype.";

  return (
    <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <TooltipLabel label={title} tooltip={tooltip} className="text-xs text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{row ? `${row.count} decisions` : "—"}</span>
      </div>
      <p className="text-lg font-semibold text-foreground">{row?.archetype ?? "—"}</p>
      {summary}
      <p className="text-xs text-muted-foreground leading-snug">{description}</p>
    </div>
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
  const [timeWindow, setTimeWindow] = useState("0");
  const [isGeneratingStatsPdf, setIsGeneratingStatsPdf] = useState(false);
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const { isLoggedIn, openLogin } = useNetlifyIdentity();
  const {
    activeDatasetId: datasetId,
    meta,
    decisions,
    isDatasetLoading,
    loadError,
  } = useDataset();
  const [categorySort, setCategorySort] = useState<{ key: CategorySortKey; direction: "asc" | "desc" }>(
    { key: "decisionCount", direction: "desc" },
  );
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypePatternRow | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategorySelection | null>(null);
  const [archetypeTableSort, setArchetypeTableSort] = useState<{
    key: ArchetypeTableSortKey;
    direction: "asc" | "desc";
  }>({ key: "count", direction: "desc" });
  const [categoryDecisionSort, setCategoryDecisionSort] = useState<{
    key: ArchetypeDecisionSortKey;
    direction: "asc" | "desc";
  }>({ key: "title", direction: "asc" });
  const [archetypeDecisionSort, setArchetypeDecisionSort] = useState<{
    key: ArchetypeDecisionSortKey;
    direction: "asc" | "desc";
  }>({ key: "title", direction: "asc" });

  const [companyContext, setCompanyContext] = useState<CompanyContext | null>(null);

  useEffect(() => {
    setCompanyContext(datasetMetaToCompanyContext(meta));
  }, [datasetId, meta]);

  const timeframeDays = useMemo<number | null>(() => {
    if (timeWindow === "0") return null;
    const parsed = Number.parseInt(timeWindow, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [timeWindow]);

  const filteredDecisions = useMemo(
    () => filterDecisionsByTimeframe(decisions, timeframeDays),
    [decisions, timeframeDays],
  );

  const previousWindowDecisions = useMemo(
    () => filterPreviousDecisionsByTimeframe(decisions, timeframeDays),
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

  const judgment = useMemo(
    () => buildJudgmentDashboard(filteredDecisions, companyContext ?? undefined),
    [companyContext, filteredDecisions],
  );

  const previousNormalized = useMemo(
    () => previousWindowDecisions.map((decision) => normalizeDecision(decision)),
    [previousWindowDecisions],
  );

  const { learning, hygiene, categories, archetypes, normalized } = {
    ...judgment,
  };

  const baseline = useMemo(
    () => computeRpsBaseline(normalized, previousNormalized),
    [normalized, previousNormalized],
  );

  const companySnapshot = useMemo<CompanyPeriodSnapshot>(() => {
    const periodLabel = fallbackPeriodLabel(companyContext, timeWindow, TIME_WINDOW_LABELS);
    const name = fallbackCompanyName(companyContext);
    const totalArchetypeDecisions = archetypes.rows.reduce((sum, row) => sum + row.count, 0);

    return {
      companyName: name,
      periodLabel,
      rpsBaseline: {
        totalDecisions: baseline.total,
        avgDnav: baseline.avgDnav,
        avgReturn: baseline.avgReturn,
        avgPressure: baseline.avgPressure,
        avgStability: baseline.avgStability,
        returnDist: segmentsToDistribution(baseline.returnSegments),
        pressureDist: segmentsToDistribution(baseline.pressureSegments),
        stabilityDist: segmentsToDistribution(baseline.stabilitySegments),
      },
      categories: categories.map((category) => ({
        name: category.category,
        decisionCount: category.decisionCount,
        avgReturn: category.avgR,
        avgPressure: category.avgP,
        avgStability: category.avgS,
        totalDnav: category.avgDnav * category.decisionCount,
      })),
      archetypes: archetypes.rows.map((row) => ({
        name: row.archetype,
        percentage: totalArchetypeDecisions ? (row.count / totalArchetypeDecisions) * 100 : 0,
      })),
      learningRecovery: learning
        ? {
            averageRecoveryDecisions: learning.decisionsToRecover ?? 0,
            winRate: learning.winRate ?? 0,
            decisionDebtIndex: Number.isFinite(hygiene?.decisionDebt)
              ? Math.max(0, Math.min(1, (hygiene?.decisionDebt ?? 0) / 100))
              : undefined,
          }
        : undefined,
    };
  }, [archetypes.rows, baseline, categories, companyContext, hygiene?.decisionDebt, learning, timeWindow]);

  const interpretation = useMemo(() => generateFullInterpretation(companySnapshot), [companySnapshot]);
  const decisionsByCategory = useMemo(() => {
    const map: Record<string, JudgmentDecision[]> = {};
    normalized.forEach((decision) => {
      map[decision.category] = map[decision.category] || [];
      map[decision.category].push(decision);
    });
    return map;
  }, [normalized]);

  const smallCategories = useMemo(
    () => categories.filter((category) => category.decisionCount < 3),
    [categories],
  );

  const smallCategoryDecisions = useMemo(
    () => smallCategories.flatMap((category) => decisionsByCategory[category.category] ?? []),
    [decisionsByCategory, smallCategories],
  );

  const miscCategoryRow = useMemo(
    () =>
      smallCategories.length
        ? buildCategoryRollupRow(
            "Miscellaneous (Small Categories)",
            smallCategoryDecisions,
            normalized.length,
          )
        : null,
    [normalized.length, smallCategories.length, smallCategoryDecisions],
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
  const visibleCategories = useMemo(
    () => sortedCategories.filter((category) => category.decisionCount >= 3),
    [sortedCategories],
  );
  const categoryNavigationRows = useMemo(
    () => [
      ...visibleCategories.map((row) => ({ kind: "category" as const, row })),
      ...(miscCategoryRow ? [{ kind: "misc" as const, row: miscCategoryRow }] : []),
    ],
    [miscCategoryRow, visibleCategories],
  );
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

  const selectedArchetypeIndex = useMemo(
    () => sortedArchetypeRows.findIndex((row) => row.archetype === selectedArchetype?.archetype),
    [selectedArchetype, sortedArchetypeRows],
  );
  const selectedCategoryIndex = useMemo(
    () =>
      selectedCategory
        ? categoryNavigationRows.findIndex((item) => item.row.category === selectedCategory.row.category)
        : -1,
    [categoryNavigationRows, selectedCategory],
  );

  const hasPreviousArchetype = selectedArchetypeIndex > 0;
  const hasNextArchetype = selectedArchetypeIndex >= 0 && selectedArchetypeIndex < sortedArchetypeRows.length - 1;
  const hasPreviousCategory = selectedCategoryIndex > 0;
  const hasNextCategory =
    selectedCategoryIndex >= 0 && selectedCategoryIndex < categoryNavigationRows.length - 1;

  const handleArchetypeChange = (value: string) => {
    const nextSelection = sortedArchetypeRows.find((row) => row.archetype === value) ?? null;
    setSelectedArchetype(nextSelection);
  };
  const handleCategoryChange = (value: string) => {
    const nextSelection = categoryNavigationRows.find((item) => item.row.category === value) ?? null;
    if (nextSelection) {
      handleCategorySelect(nextSelection.row, nextSelection.kind);
    }
  };

  const handleNavigateArchetype = (direction: "prev" | "next") => {
    if (selectedArchetypeIndex === -1) return;

    const offset = direction === "next" ? 1 : -1;
    const target = sortedArchetypeRows[selectedArchetypeIndex + offset];

    if (target) {
      setSelectedArchetype(target);
    }
  };
  const handleNavigateCategory = (direction: "prev" | "next") => {
    if (selectedCategoryIndex === -1) return;

    const offset = direction === "next" ? 1 : -1;
    const target = categoryNavigationRows[selectedCategoryIndex + offset];

    if (target) {
      handleCategorySelect(target.row, target.kind);
    }
  };

  const handleCategorySelect = (row: CategoryHeatmapRow, kind: CategorySelection["kind"] = "category") => {
    const decisions =
      kind === "category"
        ? decisionsByCategory[row.category] ?? []
        : kind === "misc"
          ? smallCategoryDecisions
          : [];
    setSelectedCategory({
      kind,
      row,
      decisions,
      includedCategories: kind === "misc" ? smallCategories : undefined,
    });
  };

  const archetypeDecisions = useMemo(
    () =>
      selectedArchetype
        ? normalized.filter((decision) => decision.archetype === selectedArchetype.archetype)
        : [],
    [normalized, selectedArchetype],
  );

  const categoryDecisions = useMemo(
    () =>
      selectedCategory?.kind === "category"
        ? decisionsByCategory[selectedCategory.row.category] ?? []
        : selectedCategory?.kind === "misc"
          ? smallCategoryDecisions
          : [],
    [decisionsByCategory, selectedCategory, smallCategoryDecisions],
  );

  const primaryArchetypeRow = useMemo(
    () => archetypes.rows.find((row) => row.archetype === archetypes.primary),
    [archetypes.primary, archetypes.rows],
  );
  const secondaryArchetypeRow = useMemo(
    () => archetypes.rows.find((row) => row.archetype === archetypes.secondary),
    [archetypes.rows, archetypes.secondary],
  );

  const renderCategoryCell = (row: CategoryHeatmapRow, key: string) => {
    switch (key) {
      case "category":
        return row.category;
      case "decisionCount":
        return row.decisionCount;
      case "percent":
        return `${formatValue(row.percent)}%`;
      case "avgDnav":
        return formatValue(row.avgDnav);
      case "avgR":
        return formatValue(row.avgR);
      case "avgP":
        return formatValue(row.avgP);
      case "avgS":
        return formatValue(row.avgS);
      case "dominantVariable":
        return row.dominantVariable;
      default:
        return String(row[key as keyof CategoryHeatmapRow] ?? "");
    }
  };

  const renderArchetypeCell = (row: ArchetypePatternRow, key: string) => {
    switch (key) {
      case "archetype":
        return row.archetype;
      case "count":
        return row.count;
      case "avgR":
        return formatValue(row.avgR);
      case "avgP":
        return formatValue(row.avgP);
      case "avgS":
        return formatValue(row.avgS);
      case "avgDnav":
        return formatValue(row.avgDnav);
      case "topCategories":
        return row.topCategories.join(", ") || "—";
      default:
        return String(row[key as keyof ArchetypePatternRow] ?? "");
    }
  };

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

  const sortedCategoryDecisions = useMemo(() => {
    const sorted = [...categoryDecisions];
    sorted.sort((a, b) => {
      const { key, direction } = categoryDecisionSort;
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
  }, [categoryDecisions, categoryDecisionSort]);

  const archetypeDistributions = useMemo(
    () => {
      if (!selectedArchetype) return null;

      const returns = archetypeDecisions.map((decision) => decision.return0 ?? 0);
      const pressures = archetypeDecisions.map((decision) => decision.pressure0 ?? 0);
      const stabilities = archetypeDecisions.map((decision) => decision.stability0 ?? 0);

      return {
        returnSegments: buildDistributionSegments(returns, {
          positive: "#22c55e",
          neutral: "#eab308",
          negative: "#ef4444",
        }),
        pressureSegments: buildDistributionSegments(pressures, {
          positive: "#ef4444",
          neutral: "#eab308",
          negative: "#22c55e",
        }),
        stabilitySegments: buildDistributionSegments(stabilities, {
          positive: "#22c55e",
          neutral: "#eab308",
          negative: "#ef4444",
        }),
      };
    },
    [archetypeDecisions, selectedArchetype],
  );

  const categoryDistributions = useMemo(() => {
    if (!selectedCategory) return null;

    const returns = categoryDecisions.map((decision) => decision.return0 ?? 0);
    const pressures = categoryDecisions.map((decision) => decision.pressure0 ?? 0);
    const stabilities = categoryDecisions.map((decision) => decision.stability0 ?? 0);

    return {
      returnSegments: buildDistributionSegments(returns, {
        positive: "#22c55e",
        neutral: "#eab308",
        negative: "#ef4444",
      }),
      pressureSegments: buildDistributionSegments(pressures, {
        positive: "#ef4444",
        neutral: "#eab308",
        negative: "#22c55e",
      }),
      stabilitySegments: buildDistributionSegments(stabilities, {
        positive: "#22c55e",
        neutral: "#eab308",
        negative: "#ef4444",
      }),
    };
  }, [categoryDecisions, selectedCategory]);

  const categoryInsights = useMemo(() => {
    const baselineMetrics = {
      avgDnav: baseline.avgDnav,
      avgR: baseline.avgReturn,
      avgP: baseline.avgPressure,
      avgS: baseline.avgStability,
    };
    const rows = [...categories, ...(miscCategoryRow ? [miscCategoryRow] : [])];
    return new Map(
      rows.map((row) => [
        row.category,
        buildCategoryActionInsight(
          {
            shareOfVolume: row.percent,
            avgDnav: row.avgDnav,
            avgR: row.avgR,
            avgP: row.avgP,
            avgS: row.avgS,
            dominantFactor: row.dominantVariable,
          },
          baselineMetrics,
        ),
      ]),
    );
  }, [
    baseline.avgDnav,
    baseline.avgPressure,
    baseline.avgReturn,
    baseline.avgStability,
    categories,
    miscCategoryRow,
  ]);
  const selectedCategoryInsight = useMemo(
    () => (selectedCategory ? categoryInsights.get(selectedCategory.row.category) ?? null : null),
    [categoryInsights, selectedCategory],
  );
  const categoryDecisionCount = categoryDecisions.length;

  const handleCategorySort = (key: CategorySortKey) => {
    setCategorySort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" },
    );
  };

  const handleCategoryDecisionSort = (key: ArchetypeDecisionSortKey) => {
    setCategoryDecisionSort((prev) =>
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
    sections.windowLabel = TIME_WINDOW_LABELS[timeWindow] ?? `Last ${timeWindow} days`;
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

  const handleSignInClick = () => {
    openLogin();
  };

  const handleBookAuditClick = () => {
    if (typeof window === "undefined") return;
    window.location.href = "/contact";
  };

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
            <DatasetPickerRow />
          </div>

          {loadError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          ) : isDatasetLoading ? (
            <div className="rounded-lg border border-muted/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Loading dataset…
            </div>
          ) : null}

          <section className="space-y-6">

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
                      <StressTestCalculator />
                      <Card>
                        <CardHeader className="pb-3 space-y-2">
                          <CardTitle className="text-xl font-semibold">RPS Baseline</CardTitle>
                          <p className="text-sm text-muted-foreground">{interpretation.rpsSummary}</p>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <CompactMetric
                              label="Total decisions"
                              value={baseline.total}
                              tooltip={TOOLTIP_COPY["Total decisions"]}
                            />
                            <CompactMetric
                              label="Avg D-NAV"
                              value={formatValue(baseline.avgDnav)}
                              tooltip={TOOLTIP_COPY["Avg D-NAV"]}
                              delta={baseline.deltas.hasComparison ? baseline.deltas.avgDnav : null}
                            />
                            <CompactMetric
                              label="Avg Return (R)"
                              value={formatValue(baseline.avgReturn)}
                              tooltip={TOOLTIP_COPY["Avg Return (R)"]}
                              delta={baseline.deltas.hasComparison ? baseline.deltas.avgReturn : null}
                            />
                            <CompactMetric
                              label="Avg Pressure (P)"
                              value={formatValue(baseline.avgPressure)}
                              tooltip={TOOLTIP_COPY["Avg Pressure (P)"]}
                              delta={baseline.deltas.hasComparison ? baseline.deltas.avgPressure : null}
                            />
                            <CompactMetric
                              label="Avg Stability (S)"
                              value={formatValue(baseline.avgStability)}
                              tooltip={TOOLTIP_COPY["Avg Stability (S)"]}
                              delta={baseline.deltas.hasComparison ? baseline.deltas.avgStability : null}
                            />
                          </div>

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
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3 space-y-2">
                          <CardTitle className="text-xl font-semibold">Learning &amp; Recovery</CardTitle>
                          <p className="text-sm text-muted-foreground">{interpretation.learningSummary}</p>
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
                        <CardTitle className="text-xl font-semibold">Decision Category Profile</CardTitle>
                        <p className="text-sm text-muted-foreground">{interpretation.categorySummary}</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {visibleCategories.length === 0 && !miscCategoryRow ? (
                          <p className="text-sm text-muted-foreground">No categories in view.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow
                                  style={{ display: "grid", gridTemplateColumns: categoryGridTemplate }}
                                  className="bg-muted/30"
                                >
                                  {categoryColumns.map((column) => {
                                    const isSortable = column.sortable ?? true;
                                    return (
                                      <TableHead
                                        key={column.key}
                                        className={cn(column.align === "right" ? "text-right" : "text-left")}
                                      >
                                        {isSortable ? (
                                          <button
                                            type="button"
                                            className={cn(
                                              "flex w-full items-center gap-1",
                                              column.align === "right" ? "justify-end text-right" : "justify-start",
                                            )}
                                            onClick={() => handleCategorySort(column.key as CategorySortKey)}
                                          >
                                            <TooltipLabel
                                              label={column.label}
                                              tooltip={column.tooltip}
                                              className="inline-flex items-center gap-1"
                                            />
                                            <ArrowUpDown className="h-4 w-4" />
                                          </button>
                                        ) : (
                                          <TooltipLabel
                                            label={column.label}
                                            tooltip={column.tooltip}
                                            className="inline-flex items-center gap-1"
                                          />
                                        )}
                                      </TableHead>
                                    );
                                  })}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {visibleCategories.map((row: CategoryHeatmapRow) => (
                                  <TableRow
                                    key={row.category}
                                    className="hover:bg-muted/50 cursor-pointer"
                                    style={{ display: "grid", gridTemplateColumns: categoryGridTemplate }}
                                    onClick={() => handleCategorySelect(row)}
                                    tabIndex={0}
                                    role="button"
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        handleCategorySelect(row);
                                      }
                                    }}
                                  >
                                    {categoryColumns.map((column) => (
                                      <TableCell
                                        key={column.key}
                                        className={cn(
                                          column.align === "right" ? "text-right" : "text-left",
                                          column.key === "category" && "font-medium",
                                        )}
                                      >
                                        {renderCategoryCell(row, column.key)}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                                {miscCategoryRow && (
                                  <TableRow
                                    key="misc-category-rollup"
                                    className="hover:bg-muted/50 cursor-pointer bg-muted/30"
                                    style={{ display: "grid", gridTemplateColumns: categoryGridTemplate }}
                                    onClick={() => handleCategorySelect(miscCategoryRow, "misc")}
                                    tabIndex={0}
                                    role="button"
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        handleCategorySelect(miscCategoryRow, "misc");
                                      }
                                    }}
                                  >
                                    {categoryColumns.map((column) => (
                                      <TableCell
                                        key={column.key}
                                        className={cn(
                                          column.align === "right" ? "text-right" : "text-left",
                                          column.key === "category" && "font-medium",
                                        )}
                                      >
                                        {renderCategoryCell(miscCategoryRow, column.key)}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl font-semibold">Archetypes &amp; Patterns</CardTitle>
                          <a
                            href="/definitions#archetypes"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            See definitions →
                          </a>
                        </div>
                        <p className="text-sm text-muted-foreground">{interpretation.archetypeSummary}</p>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <ArchetypeSummaryCard
                            title="Primary Archetype"
                            row={primaryArchetypeRow}
                            tooltip={TOOLTIP_COPY["Primary Archetype"]}
                          />
                          <ArchetypeSummaryCard
                            title="Secondary Archetype"
                            row={secondaryArchetypeRow}
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
                                <TableRow
                                  style={{ display: "grid", gridTemplateColumns: archetypeGridTemplate }}
                                  className="bg-muted/30"
                                >
                                  {archetypeColumns.map((column) => {
                                    const isSortable = column.sortable ?? true;
                                    return (
                                      <TableHead
                                        key={column.key}
                                        className={cn(column.align === "right" ? "text-right" : "text-left")}
                                      >
                                        {isSortable ? (
                                          <button
                                            type="button"
                                            className={cn(
                                              "flex w-full items-center gap-1",
                                              column.align === "right" ? "justify-end text-right" : "justify-start",
                                            )}
                                            onClick={() => handleArchetypeTableSort(column.key as ArchetypeTableSortKey)}
                                          >
                                            <TooltipLabel
                                              label={column.label}
                                              tooltip={column.tooltip}
                                              className="inline-flex items-center gap-1"
                                            />
                                            <ArrowUpDown className="h-4 w-4" />
                                          </button>
                                        ) : (
                                          <TooltipLabel
                                            label={column.label}
                                            tooltip={column.tooltip}
                                            className="inline-flex items-center gap-1"
                                          />
                                        )}
                                      </TableHead>
                                    );
                                  })}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedArchetypeRows.map((row: ArchetypePatternRow) => (
                                  <TableRow
                                    key={row.archetype}
                                    className="hover:bg-muted/50 cursor-pointer"
                                    style={{ display: "grid", gridTemplateColumns: archetypeGridTemplate }}
                                    onClick={() => setSelectedArchetype(row)}
                                  >
                                    {archetypeColumns.map((column) => (
                                      <TableCell
                                        key={column.key}
                                        className={cn(
                                          column.align === "right" ? "text-right" : "text-left",
                                          column.key === "archetype" && "font-medium",
                                        )}
                                      >
                                        {renderArchetypeCell(row, column.key)}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                      </CardContent>
                    </Card>
                  </div>

                  <section className="space-y-6">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Interpretation</h2>
                        <p className="text-sm text-muted-foreground">
                          Snapshot for {companySnapshot.companyName} · {companySnapshot.periodLabel}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>RPS Baseline</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground leading-snug">
                            {interpretation.rpsSummary}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Decision Category Profile</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground leading-snug">
                            {interpretation.categorySummary}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Archetype Profile</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground leading-snug">
                            {interpretation.archetypeSummary}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Learning &amp; Recovery</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground leading-snug">
                            {interpretation.learningSummary}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                  <Dialog
                    open={!!selectedCategory}
                    onOpenChange={(open) => setSelectedCategory(open ? selectedCategory : null)}
                  >
                    <DialogContent className="w-[90vw] max-w-[90vw] h-[85vh] p-0 overflow-x-auto overflow-y-auto">
                      <div className="flex h-full flex-col bg-background">
                        <div className="flex items-start justify-between border-b px-6 py-4">
                          <DialogTitle className="text-lg font-semibold flex flex-wrap items-center gap-2">
                            <span>
                              {selectedCategory ? `${selectedCategory.row.category} decisions` : "Category decisions"}
                            </span>
                            {selectedCategory && (
                              <span className="text-sm font-medium text-muted-foreground">
                                · {categoryDecisionCount} decisions
                              </span>
                            )}
                          </DialogTitle>
                          <DialogClose className="rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                          </DialogClose>
                        </div>

                        {selectedCategory && selectedCategoryInsight && (
                          <>
                            <div className="space-y-4 border-b bg-card/60 px-6 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-3 max-w-2xl">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-foreground">Category Action Insight</p>
                                    <Badge
                                      variant="outline"
                                      className={cn("text-xs", signalBadgeStyles[selectedCategoryInsight.signal])}
                                    >
                                      {selectedCategoryInsight.signal} signal
                                    </Badge>
                                  </div>
                                  <div
                                    className={cn(
                                      "space-y-2 text-sm",
                                      selectedCategory.row.decisionCount < 5 && "text-muted-foreground",
                                    )}
                                  >
                                    <p>{selectedCategoryInsight.posture}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Primary lever:{" "}
                                      <span className="font-semibold text-foreground">
                                        {selectedCategoryInsight.leverage.primary}
                                      </span>{" "}
                                      · {selectedCategoryInsight.leverage.reason}
                                    </p>
                                  </div>
                                  {selectedCategoryInsight.risks.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {selectedCategoryInsight.risks.map((risk) => (
                                        <Badge key={risk} variant="secondary" className="text-xs font-medium">
                                          {risk}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {selectedCategoryInsight.guidance.length > 0 && (
                                    <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                                      {selectedCategoryInsight.guidance.map((line) => (
                                        <li key={line}>{line}</li>
                                      ))}
                                    </ul>
                                  )}
                                  {selectedCategory.row.decisionCount < 5 && (
                                    <p className="text-xs text-muted-foreground">
                                      Signal is weak at N={selectedCategory.row.decisionCount}. Log more decisions to
                                      stabilize the pattern.
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-start gap-3 md:items-end">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Select
                                      value={selectedCategory?.row.category ?? ""}
                                      onValueChange={handleCategoryChange}
                                    >
                                      <SelectTrigger className="w-64 truncate">
                                        <SelectValue placeholder="Select category" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectGroup>
                                          {categoryNavigationRows.map((item) => (
                                            <SelectItem
                                              key={`${item.kind}-${item.row.category}`}
                                              value={item.row.category}
                                              className="truncate"
                                            >
                                              {item.row.category}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={!hasPreviousCategory}
                                        onClick={() => handleNavigateCategory("prev")}
                                      >
                                        <ArrowLeft className="h-4 w-4" />
                                        <span className="sr-only">Previous category</span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={!hasNextCategory}
                                        onClick={() => handleNavigateCategory("next")}
                                      >
                                        <ArrowRight className="h-4 w-4" />
                                        <span className="sr-only">Next category</span>
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {selectedCategory.kind === "misc" && selectedCategory.includedCategories?.length ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                                    Included categories
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    {selectedCategory.includedCategories.map((category) => (
                                      <Badge key={category.category} variant="secondary">
                                        {category.category} · {category.decisionCount}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Avg R</p>
                                  <p className="font-semibold text-foreground">
                                    {formatValue(selectedCategory.row.avgR)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Avg P</p>
                                  <p className="font-semibold text-foreground">
                                    {formatValue(selectedCategory.row.avgP)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Avg S</p>
                                  <p className="font-semibold text-foreground">
                                    {formatValue(selectedCategory.row.avgS)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Avg D-NAV</p>
                                  <p className="font-semibold text-foreground">
                                    {formatValue(selectedCategory.row.avgDnav)}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <DistributionCard
                                  title="Return distribution"
                                  segments={categoryDistributions?.returnSegments ?? []}
                                  tooltip={TOOLTIP_COPY["Return distribution"]}
                                />
                                <DistributionCard
                                  title="Pressure distribution"
                                  segments={categoryDistributions?.pressureSegments ?? []}
                                  tooltip={TOOLTIP_COPY["Pressure distribution"]}
                                />
                                <DistributionCard
                                  title="Stability distribution"
                                  segments={categoryDistributions?.stabilitySegments ?? []}
                                  tooltip={TOOLTIP_COPY["Stability distribution"]}
                                />
                              </div>
                            </div>

                            <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
                              <div className="overflow-x-auto">
                                <Table className="text-sm min-w-[1100px]">
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
                                              handleCategoryDecisionSort(column.key as ArchetypeDecisionSortKey)
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
                                    {sortedCategoryDecisions.map((decision) => (
                                      <TableRow key={decision.id}>
                                        <TableCell className="font-medium max-w-[380px] truncate align-top">
                                          {decision.title}
                                        </TableCell>
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
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog
                    open={!!selectedArchetype}
                    onOpenChange={(open) => setSelectedArchetype(open ? selectedArchetype : null)}
                  >
                    <DialogContent className="w-[90vw] max-w-[90vw] h-[85vh] p-0 overflow-x-auto overflow-y-auto">
                      <div className="flex h-full flex-col bg-background">
                        <div className="flex items-start justify-between border-b px-6 py-4">
                          <DialogTitle className="text-lg font-semibold">
                            {selectedArchetype ? `${selectedArchetype.archetype} decisions` : "Archetype decisions"}
                          </DialogTitle>
                          <DialogClose className="rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                          </DialogClose>
                        </div>

                        {selectedArchetype && (
                          <>
                            <div className="space-y-4 border-b bg-card/60 px-6 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1 max-w-2xl break-words">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-base font-semibold text-foreground">
                                  {selectedArchetype.archetype}
                                </p>
                                <a
                                  href="/definitions#archetypes"
                                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  See definitions →
                                </a>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {
                                  getArchetype({
                                    return: selectedArchetype.avgR,
                                        pressure: selectedArchetype.avgP,
                                        stability: selectedArchetype.avgS,
                                        merit: 0,
                                        energy: 0,
                                        dnav: selectedArchetype.avgDnav,
                                      }).description
                                    }
                                  </p>
                                </div>
                                <div className="flex flex-col items-start gap-3 md:items-end">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Select
                                      value={selectedArchetype?.archetype ?? ""}
                                      onValueChange={handleArchetypeChange}
                                    >
                                      <SelectTrigger className="w-56 truncate">
                                        <SelectValue placeholder="Select archetype" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectGroup>
                                          {sortedArchetypeRows.map((row) => (
                                            <SelectItem key={row.archetype} value={row.archetype} className="truncate">
                                              {row.archetype}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={!hasPreviousArchetype}
                                        onClick={() => handleNavigateArchetype("prev")}
                                      >
                                        <ArrowLeft className="h-4 w-4" />
                                        <span className="sr-only">Previous archetype</span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={!hasNextArchetype}
                                        onClick={() => handleNavigateArchetype("next")}
                                      >
                                        <ArrowRight className="h-4 w-4" />
                                        <span className="sr-only">Next archetype</span>
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm w-full">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Avg R</p>
                                      <p className="font-semibold text-foreground">{formatValue(selectedArchetype.avgR)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Avg P</p>
                                      <p className="font-semibold text-foreground">{formatValue(selectedArchetype.avgP)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Avg S</p>
                                      <p className="font-semibold text-foreground">{formatValue(selectedArchetype.avgS)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Avg D-NAV</p>
                                      <p className="font-semibold text-foreground">{formatValue(selectedArchetype.avgDnav)}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">Top categories:</span>
                                {selectedArchetype.topCategories?.length ? (
                                  selectedArchetype.topCategories.map((category) => (
                                    <Badge key={category} variant="secondary">
                                      {category}
                                    </Badge>
                                  ))
                                ) : (
                                  <span>—</span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <DistributionCard
                                  title="Return distribution"
                                  segments={archetypeDistributions?.returnSegments ?? []}
                                  tooltip={TOOLTIP_COPY["Return distribution"]}
                                />
                                <DistributionCard
                                  title="Pressure distribution"
                                  segments={archetypeDistributions?.pressureSegments ?? []}
                                  tooltip={TOOLTIP_COPY["Pressure distribution"]}
                                />
                                <DistributionCard
                                  title="Stability distribution"
                                  segments={archetypeDistributions?.stabilitySegments ?? []}
                                  tooltip={TOOLTIP_COPY["Stability distribution"]}
                                />
                              </div>
                            </div>

                            <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
                              <div className="overflow-x-auto">
                                <Table className="text-sm min-w-[1100px]">
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
                                        <TableCell className="font-medium max-w-[380px] truncate align-top">
                                          {decision.title}
                                        </TableCell>
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
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

            </div>

          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}
