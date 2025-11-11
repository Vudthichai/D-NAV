"use client";

import CompareSheet from "@/components/CompareSheet";
import DecisionCalculator from "@/components/DecisionCalculator";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DecisionEntry, DecisionMetrics, DecisionVariables, ema, getArchetype, stdev } from "@/lib/calculations";
import { addDecision, loadLog } from "@/lib/storage";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Check,
  CheckCircle,
  Download,
  FileText,
  Gauge,
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
import { useCallback, useMemo, useRef, useState } from "react";

interface DashboardStats {
  totalDecisions: number;
  avgDnav: number;
  trend: number;
  consistency: number;
  cadence: number;
  last5vsPrior5: number;
  windowArchetype: string;
  windowArchetypeDescription: string;
  windowArchetypeBreakdown: {
    returnType: string;
    stabilityType: string;
    pressureType: string;
  };
  returnOnEffort: number;
  returnDistribution: { positive: number; neutral: number; negative: number };
  stabilityDistribution: { stable: number; uncertain: number; fragile: number };
  pressureDistribution: { pressured: number; balanced: number; calm: number };
  lossStreak: { current: number; longest: number };
  returnDebt: number;
  paybackRatio: number;
}

const metricExplainers: Record<string, { description: string; example: string }> = {
  "Total Decisions": {
    description: "Count of decisions recorded in the selected window.",
    example: "Logging 12 choices this month results in 12 total decisions.",
  },
  "Average D-NAV": {
    description: "Average D-NAV score across the filtered decisions.",
    example: "Scores of 40 and 60 yield an average D-NAV of 50.",
  },
  "Decision Cadence": {
    description: "How frequently decisions are made, normalized to the selected cadence unit.",
    example: "6 decisions across two weeks shows a cadence of 3 per week.",
  },
  "Consistency": {
    description: "Standard deviation of D-NAV scores; lower values indicate steadier outcomes.",
    example: "A consistency score of 8 means results are tightly clustered.",
  },
  "Recent Trend": {
    description: "Difference between the average of the last five decisions and the prior five.",
    example: "Last five averaging 60 vs. prior five at 50 produces a +10 trend.",
  },
  "Return on Effort": {
    description: "Total return divided by the total energy invested.",
    example: "Generating 15 return from 5 energy equates to a 3.0 ratio.",
  },
  "Window Archetype": {
    description: "Prevailing decision archetype across the selected window.",
    example: "A Maverick window archetype highlights aggressive upside seeking.",
  },
  "Return Distribution": {
    description: "Share of decisions landing as positive, neutral, or negative return.",
    example: "60% positive / 20% neutral / 20% negative indicates upside skew.",
  },
  "Return Distribution|positive": {
    description: "Portion of decisions that generated a net-positive return.",
    example: "If 12 of 20 entries won, the positive slice is 60%.",
  },
  "Return Distribution|neutral": {
    description: "Portion of decisions that broke even.",
    example: "Two zero-return outcomes in ten decisions produce 20% neutral.",
  },
  "Return Distribution|negative": {
    description: "Portion of decisions that finished in the red.",
    example: "Three losses in a 15-decision sample equal 20% negative.",
  },
  "Stability Distribution": {
    description: "Balance of decisions that landed stable, uncertain, or fragile.",
    example: "Half of choices landing stable implies a resilient footing.",
  },
  "Stability Distribution|stable": {
    description: "Percentage of decisions showing positive stability.",
    example: "8 of 16 choices scoring above zero stability equals 50% stable.",
  },
  "Stability Distribution|uncertain": {
    description: "Percentage of decisions with neutral stability.",
    example: "Three neutral reads in a dozen decisions equals 25% uncertain.",
  },
  "Stability Distribution|fragile": {
    description: "Percentage of decisions showing negative stability.",
    example: "If four outcomes were fragile, the slice is 33%.",
  },
  "Pressure Distribution": {
    description: "Mix of pressured, balanced, or calm operating conditions.",
    example: "A 40% calm read means most executions feel controlled.",
  },
  "Pressure Distribution|pressured": {
    description: "Percentage of decisions experiencing net pressure.",
    example: "Five pressured calls out of ten equals 50% pressured.",
  },
  "Pressure Distribution|balanced": {
    description: "Percentage of decisions landing at neutral pressure.",
    example: "Three balanced reads in twelve decisions equals 25% balanced.",
  },
  "Pressure Distribution|calm": {
    description: "Percentage of decisions where calm outweighed pressure.",
    example: "If six entries were calm, the calm portion is 60%.",
  },
  "Loss Streak": {
    description: "Active and longest chain of consecutive negative returns.",
    example: "A 2 / 4 streak means two current losses and four at peak.",
  },
  "Return Debt": {
    description: "Sum of returns needed to offset the active loss streak.",
    example: "Three -2 losses accrue 6 units of return debt.",
  },
  "Payback Ratio": {
    description: "Average positive return required to clear each loss in the streak.",
    example: "Needing 9 upside to repay three losses implies a 3.0 ratio.",
  },
};

const InfoTooltip = ({
  term,
  children,
  side = "top",
}: {
  term: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) => {
  const info = metricExplainers[term];
  if (!info) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs space-y-2">
        <p className="text-sm font-semibold leading-snug">{info.description}</p>
        <p className="text-xs text-muted-foreground leading-snug">Example: {info.example}</p>
      </TooltipContent>
    </Tooltip>
  );
};

interface DistributionInsight {
  label: string;
  message: string;
}

const formatValue = (value: number, digits = 1) =>
  Number.isFinite(value) ? Number(value).toFixed(digits) : "0";

const describeReturnDistribution = (
  distribution: DashboardStats["returnDistribution"],
): DistributionInsight => {
  const total = distribution.positive + distribution.neutral + distribution.negative;
  if (total <= 0) {
    return { label: "Return", message: "No meaningful read — log a few more decisions." };
  }

  if (distribution.positive >= 50) {
    return { label: "Return", message: "Mostly positive — decisions are paying off." };
  }

  if (distribution.negative >= 50) {
    return { label: "Return", message: "Skewed negative — tighten risk filters before committing." };
  }

  if (distribution.neutral >= 50) {
    return { label: "Return", message: "Largely neutral — upside is stalling." };
  }

  return { label: "Return", message: "Mixed picture — monitor the next set of calls for clarity." };
};

const describeStabilityDistribution = (
  distribution: DashboardStats["stabilityDistribution"],
): DistributionInsight => {
  const total = distribution.stable + distribution.uncertain + distribution.fragile;
  if (total <= 0) {
    return { label: "Stability", message: "No meaningful read — log a few more decisions." };
  }

  if (distribution.stable >= 50) {
    return {
      label: "Stability",
      message: "Confidence outweighs doubt — execution remains steady.",
    };
  }

  if (distribution.fragile >= 50) {
    return {
      label: "Stability",
      message: "Fragility showing — shore up conviction before scaling.",
    };
  }

  if (distribution.uncertain >= 50) {
    return {
      label: "Stability",
      message: "Uneven footing — clarify signals before the next swing.",
    };
  }

  return { label: "Stability", message: "Mixed footing — stability signal is split." };
};

const describePressureDistribution = (
  distribution: DashboardStats["pressureDistribution"],
): DistributionInsight => {
  const total = distribution.pressured + distribution.balanced + distribution.calm;
  if (total <= 0) {
    return { label: "Pressure", message: "No meaningful read — log a few more decisions." };
  }

  if (distribution.calm >= 50) {
    return { label: "Pressure", message: "Majority calm — low reactivity during action." };
  }

  if (distribution.pressured >= 50) {
    return {
      label: "Pressure",
      message: "Elevated tension — pace decisions to avoid overtrading.",
    };
  }

  if (distribution.balanced >= 50) {
    return {
      label: "Pressure",
      message: "Evenly balanced — stay alert for momentum shifts.",
    };
  }

  return { label: "Pressure", message: "Mixed tempo — pressure signal is split." };
};

const buildDistributionInsights = (current: DashboardStats): DistributionInsight[] => [
  describeReturnDistribution(current.returnDistribution),
  describeStabilityDistribution(current.stabilityDistribution),
  describePressureDistribution(current.pressureDistribution),
];

const buildReturnDebtSummary = (current: DashboardStats): string => {
  if (current.returnDebt <= 0) {
    return "No active return debt — keep compounding disciplined entries.";
  }

  if (current.paybackRatio > 0) {
    const winsNeeded = current.returnDebt / current.paybackRatio;
    return `${formatValue(current.returnDebt)} D-NAV of return debt requires about ${formatValue(
      winsNeeded,
      1,
    )} positive decisions averaging +${formatValue(current.paybackRatio)} D-NAV each to reset.`;
  }

  return `Return debt sits at ${formatValue(
    current.returnDebt,
  )} D-NAV. Stack quality wins to offset the streak.`;
};

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
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <InfoTooltip term={title}>
              <p className="text-sm font-medium text-muted-foreground cursor-help">{title}</p>
            </InfoTooltip>
            <InfoTooltip term={title} side="bottom">
              <div className="flex items-center gap-2 mt-1 cursor-help">
                <p className="text-2xl font-bold">{value}</p>
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
          <Icon className="h-8 w-8 text-muted-foreground" />
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

const DistributionCard = ({ title, segments }: DistributionCardProps) => {
  const safeSegments = segments.map((segment) => ({
    ...segment,
    value: Number.isFinite(segment.value) ? Math.max(segment.value, 0) : 0,
  }));
  const hasData = safeSegments.some((segment) => segment.value > 0);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <InfoTooltip term={title}>
            <p className="text-sm font-medium text-muted-foreground cursor-help">{title}</p>
          </InfoTooltip>
          {hasData && (
            <p className="text-xs text-muted-foreground">
              {safeSegments
                .map((segment) => `${segment.label} ${formatValue(segment.value)}%`)
                .join(" / ")}
            </p>
          )}
        </div>

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
    `Consistency: ${current.consistency}`,
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

  const stats = useMemo<DashboardStats>(() => {
    const decisions = loadLog();
    const now = decisions.length > 0 ? decisions[0].ts : 0;
    const windowMs = parseInt(timeWindow) * 24 * 60 * 60 * 1000;
    const filteredDecisions =
      timeWindow === "0" ? decisions : decisions.filter((d) => now - d.ts <= windowMs);

    if (filteredDecisions.length === 0) {
      return {
        totalDecisions: 0,
        avgDnav: 0,
        trend: 0,
        consistency: 0,
        cadence: 0,
        last5vsPrior5: 0,
        windowArchetype: "No Data",
        windowArchetypeDescription: "No archetype available",
        windowArchetypeBreakdown: {
          returnType: "—",
          stabilityType: "—",
          pressureType: "—",
        },
        returnOnEffort: 0,
        returnDistribution: { positive: 0, neutral: 0, negative: 0 },
        stabilityDistribution: { stable: 0, uncertain: 0, fragile: 0 },
        pressureDistribution: { pressured: 0, balanced: 0, calm: 0 },
        lossStreak: { current: 0, longest: 0 },
        returnDebt: 0,
        paybackRatio: 0,
      };
    }

    const dnavScores = filteredDecisions.map((d) => d.dnav);
    const returnScores = filteredDecisions.map((d) => d.return);
    const stabilityScores = filteredDecisions.map((d) => d.stability);
    const pressureScores = filteredDecisions.map((d) => d.pressure);
    const energyScores = filteredDecisions.map((d) => d.energy);

    const avgDnav = dnavScores.reduce((a, b) => a + b, 0) / dnavScores.length;
    const consistency = stdev(dnavScores);

    const recentDecisions = decisions.slice(0, 30);
    const recentDnavs = recentDecisions.map((d) => d.dnav);
    const trend = recentDnavs.length >= 7 ? ema(recentDnavs, 7) - ema(recentDnavs, 30) : 0;

    const timeSpanDays =
      timeWindow === "0"
        ? (now - Math.min(...decisions.map((d) => d.ts))) / (24 * 60 * 60 * 1000)
        : parseInt(timeWindow);
    const cadence =
      timeSpanDays > 0
        ? (filteredDecisions.length / timeSpanDays) *
          (cadenceUnit === "day" ? 1 : cadenceUnit === "week" ? 7 : 30)
        : 0;

    const returnDistribution = {
      positive: (returnScores.filter((r) => r > 0).length / returnScores.length) * 100,
      neutral: (returnScores.filter((r) => r === 0).length / returnScores.length) * 100,
      negative: (returnScores.filter((r) => r < 0).length / returnScores.length) * 100,
    };

    const stabilityDistribution = {
      stable: (stabilityScores.filter((s) => s > 0).length / stabilityScores.length) * 100,
      uncertain: (stabilityScores.filter((s) => s === 0).length / stabilityScores.length) * 100,
      fragile: (stabilityScores.filter((s) => s < 0).length / stabilityScores.length) * 100,
    };

    const pressureDistribution = {
      pressured: (pressureScores.filter((p) => p > 0).length / pressureScores.length) * 100,
      balanced: (pressureScores.filter((p) => p === 0).length / pressureScores.length) * 100,
      calm: (pressureScores.filter((p) => p < 0).length / pressureScores.length) * 100,
    };

    const avgReturn = returnScores.reduce((a, b) => a + b, 0) / returnScores.length;
    const avgStability = stabilityScores.reduce((a, b) => a + b, 0) / stabilityScores.length;
    const avgPressure = pressureScores.reduce((a, b) => a + b, 0) / pressureScores.length;
    const archetypeInfo = getArchetype({
      return: avgReturn,
      stability: avgStability,
      pressure: avgPressure,
      merit: 0,
      energy: 0,
      dnav: 0,
    });

    const totalEnergy = energyScores.reduce((a, b) => a + b, 0);
    const totalReturn = returnScores.reduce((a, b) => a + b, 0);
    const returnOnEffort = totalEnergy > 0 ? totalReturn / totalEnergy : 0;

    const last5 = decisions.slice(0, 5).map((d) => d.dnav);
    const prior5 = decisions.slice(5, 10).map((d) => d.dnav);
    const last5vsPrior5 =
      last5.length > 0 && prior5.length > 0
        ? last5.reduce((a, b) => a + b, 0) / last5.length -
          prior5.reduce((a, b) => a + b, 0) / prior5.length
        : 0;

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let returnDebt = 0;

    for (const decision of decisions) {
      if (decision.return < 0) {
        tempStreak += 1;
        returnDebt += Math.abs(decision.return);
        if (tempStreak === 1) currentStreak = tempStreak;
      } else {
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        tempStreak = 0;
      }
    }

    if (tempStreak > longestStreak) longestStreak = tempStreak;

    const paybackRatio = longestStreak > 0 ? returnDebt / longestStreak : 0;

    return {
      totalDecisions: filteredDecisions.length,
      avgDnav: Math.round(avgDnav * 10) / 10,
      trend: Math.round(trend * 10) / 10,
      consistency: Math.round(consistency * 10) / 10,
      cadence: Math.round(cadence * 10) / 10,
      last5vsPrior5: Math.round(last5vsPrior5 * 10) / 10,
      windowArchetype: archetypeInfo.name,
      windowArchetypeDescription: archetypeInfo.description,
      windowArchetypeBreakdown: {
        returnType: archetypeInfo.returnType,
        stabilityType: archetypeInfo.stabilityType,
        pressureType: archetypeInfo.pressureType,
      },
      returnOnEffort: Math.round(returnOnEffort * 100) / 100,
      returnDistribution,
      stabilityDistribution,
      pressureDistribution,
      lossStreak: { current: currentStreak, longest: longestStreak },
      returnDebt: Math.round(returnDebt * 10) / 10,
      paybackRatio: Math.round(paybackRatio * 10) / 10,
    };
  }, [cadenceUnit, timeWindow]);

  const timeWindowLabels: Record<string, string> = {
    "0": "All time",
    "7": "Last 7 days",
    "30": "Last 30 days",
    "90": "Last 90 days",
  };

  const buildNarrative = (current: DashboardStats): string => {
    const windowLabel = timeWindowLabels[timeWindow] ?? `Last ${timeWindow} days`;
    const cadencePhrase =
      current.cadence > 0
        ? `${formatValue(current.cadence)} decisions per ${cadenceUnit}`
        : "no meaningful cadence";
    const performanceStatement =
      current.last5vsPrior5 > 0
        ? `Performance is up by ${formatValue(current.last5vsPrior5)} D-NAV versus the prior window.`
        : current.last5vsPrior5 < 0
        ? `Performance is down ${formatValue(Math.abs(current.last5vsPrior5))} D-NAV versus the prior window.`
        : "Performance is flat versus the prior window.";

    const hygieneLines: string[] = [];
    if (current.lossStreak.current > 0) {
      hygieneLines.push(
        `Currently on a ${current.lossStreak.current} loss streak (longest ${current.lossStreak.longest}).`,
      );
    } else {
      hygieneLines.push("No active loss streaks detected.");
    }

    hygieneLines.push(buildReturnDebtSummary(current));

    const distributionInsights = buildDistributionInsights(current)
      .map(({ label, message }) => `${label}: ${message}`)
      .join("\n");

    return [
      `Over ${windowLabel}, you logged ${current.totalDecisions} decisions with an average D-NAV of ${formatValue(
        current.avgDnav,
      )}. Cadence is ${cadencePhrase}. ${performanceStatement}`,
      (() => {
        const description = current.windowArchetypeDescription.trim();
        const endsWithPeriod = description.endsWith('.');
        return `Archetype: ${current.windowArchetype} — ${description}${endsWithPeriod ? '' : '.'}`;
      })(),
      `Distribution signals:\n${distributionInsights}`,
      `Return hygiene: ${hygieneLines.join(" ")}`,
    ].join("\n\n");
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
    const sections = getStatsReportSections(current);
    sections.windowLabel = timeWindowLabels[timeWindow] ?? `Last ${timeWindow} days`;
    sections.cadenceLabel = cadenceUnit;
    sections.narrative = buildNarrative(current).split("\n\n");

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
  const distributionInsights = useMemo(() => buildDistributionInsights(stats), [stats]);
  const returnDebtSummary = buildReturnDebtSummary(stats);

  const narrativeText = hasData
    ? buildNarrative(stats)
    : "No decisions logged in this window. Import or record decisions to unlock narrative insights.";

  return (
    <TooltipProvider>
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto p-6 space-y-8" ref={statsContainerRef}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">The D-NAV</h1>
              <p className="text-muted-foreground mt-1">
                Tune your decision inputs, monitor performance, and export insights in one view.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          <DecisionCalculator
            onOpenCompare={handleOpenCompare}
            onDataChange={handleDataChange}
          />

          <Card className="mt-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Quick Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Input
                  type="text"
                  placeholder="Decision name (e.g., 'Investor meetup solo')"
                  value={decisionName}
                  onChange={(e) => setDecisionName(e.target.value)}
                />
                <Input
                  type="text"
                  placeholder="Category (e.g., Career, Health, Relationships)"
                  value={decisionCategory}
                  onChange={(e) => setDecisionCategory(e.target.value)}
                />
                <Button onClick={handleSaveDecision} className="w-full" disabled={!decisionName || !decisionCategory}>
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
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/log#import" className="flex items-center justify-center">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Decisions
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle>Portfolio Narrative</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{narrativeText}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Distribution Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {distributionInsights.map(({ label, message }) => (
                  <li key={label} className="leading-snug">
                    <span className="font-medium text-foreground">{label}:</span> {message}
                  </li>
                ))}
              </ul>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              title="Consistency"
              value={stats?.consistency || 0}
              subtitle="Lower = more steady"
              icon={Brain}
              color={stats?.consistency && stats.consistency > 20 ? "warning" : "positive"}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardStatCard
              title="Recent Trend"
              value={stats?.last5vsPrior5 || 0}
              subtitle="Last 5 vs Prior 5"
              icon={stats?.last5vsPrior5 && stats.last5vsPrior5 > 0 ? TrendingUp : TrendingDown}
              trend={stats?.last5vsPrior5}
            />
            <DashboardStatCard
              title="Return on Effort"
              value={stats?.returnOnEffort || 0}
              subtitle="Return per unit energy"
              icon={Zap}
              color={stats?.returnOnEffort && stats.returnOnEffort > 0 ? "positive" : "default"}
            />
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
          </div>

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
                  <strong>Remember:</strong> Losses aren&rsquo;t &ldquo;bad.&rdquo; Unmanaged streaks are. Track them so
                  &ldquo;learning&rdquo; doesn&rsquo;t become a silent bleed.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 flex justify-center gap-4 pdf-ignore">
            <Button size="lg" onClick={handleOpenCompare}>
              Compare Decisions
            </Button>
            <Button variant="outline" size="lg" onClick={handleSaveDecision} disabled={!decisionName || !decisionCategory}>
              Save &amp; Continue
            </Button>
          </div>
        </div>

        <Button
          className="fixed right-6 bottom-6 bg-primary shadow-lg z-50 rounded-full w-14 h-14"
          onClick={handleOpenCompare}
        >
          <BarChart3 className="w-5 h-5" />
        </Button>

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
