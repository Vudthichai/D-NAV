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
import { DecisionEntry, DecisionMetrics, DecisionVariables, corr, ema, getArchetype, stdev } from "@/lib/calculations";
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
  calibration: number;
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
  policyHint: string;
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
  "Calibration": {
    description: "Correlation between confidence inputs and realized returns.",
    example: "A calibration of 0.4 signals confidence generally tracks results.",
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
  "Policy Hint": {
    description: "Contextual coaching cue derived from the stats mix.",
    example: "High variability may trigger a hint to tighten guardrails.",
  },
};

const RETURN_SEGMENTS: Array<{
  key: keyof DashboardStats["returnDistribution"];
  label: string;
  rgb: [number, number, number];
}> = [
  { key: "positive", label: "Positive", rgb: [21, 128, 61] },
  { key: "neutral", label: "Neutral", rgb: [245, 158, 11] },
  { key: "negative", label: "Negative", rgb: [239, 68, 68] },
];

const STABILITY_SEGMENTS: Array<{
  key: keyof DashboardStats["stabilityDistribution"];
  label: string;
  rgb: [number, number, number];
}> = [
  { key: "stable", label: "Stable", rgb: [21, 128, 61] },
  { key: "uncertain", label: "Uncertain", rgb: [245, 158, 11] },
  { key: "fragile", label: "Fragile", rgb: [239, 68, 68] },
];

const PRESSURE_SEGMENTS: Array<{
  key: keyof DashboardStats["pressureDistribution"];
  label: string;
  rgb: [number, number, number];
}> = [
  { key: "pressured", label: "Pressured", rgb: [239, 68, 68] },
  { key: "balanced", label: "Balanced", rgb: [245, 158, 11] },
  { key: "calm", label: "Calm", rgb: [21, 128, 61] },
];

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

interface DistributionChartProps {
  title: string;
  data: Record<string, number>;
  colors: Record<string, string>;
}

const DistributionChart = ({ title, data, colors }: DistributionChartProps) => {
  const total = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader>
        <InfoTooltip term={title}>
          <CardTitle className="text-lg cursor-help">{title}</CardTitle>
        </InfoTooltip>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-4 bg-muted rounded-full overflow-hidden">
            {Object.entries(data).map(([key, value]) => (
              <div
                key={key}
                className="h-full inline-block"
                style={{
                  width: `${total > 0 ? (value / total) * 100 : 0}%`,
                  backgroundColor: colors[key],
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-sm flex-wrap gap-2">
            {Object.entries(data).map(([key, value]) => (
              <InfoTooltip key={key} term={`${title}|${key}`} side="top">
                <div className="flex items-center gap-2 cursor-help">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[key] }} />
                  <span className="capitalize">
                    {key}: {Math.round(value)}%
                  </span>
                </div>
              </InfoTooltip>
            ))}
          </div>
        </div>
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
    `Calibration: ${current.calibration}`,
    `Recent trend: ${current.last5vsPrior5}`,
    `Return on effort: ${current.returnOnEffort}`,
  ],
  distribution: [
    `Return — Positive: ${Math.round(current.returnDistribution.positive)}%`,
    `Return — Neutral: ${Math.round(current.returnDistribution.neutral)}%`,
    `Return — Negative: ${Math.round(current.returnDistribution.negative)}%`,
    `Stability — Stable: ${Math.round(current.stabilityDistribution.stable)}%`,
    `Stability — Uncertain: ${Math.round(current.stabilityDistribution.uncertain)}%`,
    `Stability — Fragile: ${Math.round(current.stabilityDistribution.fragile)}%`,
    `Pressure — Pressured: ${Math.round(current.pressureDistribution.pressured)}%`,
    `Pressure — Balanced: ${Math.round(current.pressureDistribution.balanced)}%`,
    `Pressure — Calm: ${Math.round(current.pressureDistribution.calm)}%`,
  ],
  risk: [
    `Loss streak: ${current.lossStreak.current} current / ${current.lossStreak.longest} longest`,
    `Return debt: ${current.returnDebt}`,
    `Payback ratio: ${current.paybackRatio}`,
    `Window archetype: ${current.windowArchetype} (Return: ${current.windowArchetypeBreakdown.returnType}, Stability: ${current.windowArchetypeBreakdown.stabilityType}, Pressure: ${current.windowArchetypeBreakdown.pressureType})`,
    `Policy hint: ${current.policyHint}`,
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
        calibration: 0,
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
        policyHint: "No data available",
      };
    }

    const dnavScores = filteredDecisions.map((d) => d.dnav);
    const returnScores = filteredDecisions.map((d) => d.return);
    const stabilityScores = filteredDecisions.map((d) => d.stability);
    const pressureScores = filteredDecisions.map((d) => d.pressure);
    const confidenceScores = filteredDecisions.map((d) => d.confidence);
    const energyScores = filteredDecisions.map((d) => d.energy);

    const avgDnav = dnavScores.reduce((a, b) => a + b, 0) / dnavScores.length;
    const consistency = stdev(dnavScores);
    const calibration = corr(confidenceScores, returnScores) || 0;

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

    let policyHint = "No specific recommendations";
    if (currentStreak > 3) {
      policyHint = "High loss streak - consider pausing to reassess";
    } else if (calibration < -0.3) {
      policyHint = "Low confidence calibration - work on evidence gathering";
    } else if (consistency > 20) {
      policyHint = "High variability - focus on decision consistency";
    } else if (avgDnav > 50) {
      policyHint = "Strong performance - maintain current approach";
    }

    return {
      totalDecisions: filteredDecisions.length,
      avgDnav: Math.round(avgDnav * 10) / 10,
      trend: Math.round(trend * 10) / 10,
      consistency: Math.round(consistency * 10) / 10,
      cadence: Math.round(cadence * 10) / 10,
      calibration: Math.round(calibration * 100) / 100,
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
      policyHint,
    };
  }, [cadenceUnit, timeWindow]);

  const timeWindowLabels: Record<string, string> = {
    "0": "All time",
    "7": "Last 7 days",
    "30": "Last 30 days",
    "90": "Last 90 days",
  };

  const formatNumber = (value: number, digits = 1) =>
    Number.isFinite(value) ? Number(value).toFixed(digits) : "0";

  const percent = (value: number) => `${Math.round(value)}%`;

  const describeCalibration = (value: number) => {
    if (value > 0.3) return "Confidence is tracking outcomes well.";
    if (value < -0.3) return "Confidence is inverted versus results — pressure-test assumptions.";
    return "Confidence and outcomes are roughly aligned.";
  };

  const buildNarrative = (current: DashboardStats): string => {
    const windowLabel = timeWindowLabels[timeWindow] ?? `Last ${timeWindow} days`;
    const cadencePhrase =
      current.cadence > 0
        ? `${formatNumber(current.cadence)} decisions per ${cadenceUnit}`
        : "no meaningful cadence";
    const trendDescription =
      current.last5vsPrior5 > 0
        ? `up by ${formatNumber(current.last5vsPrior5)}`
        : current.last5vsPrior5 < 0
        ? `down ${formatNumber(Math.abs(current.last5vsPrior5))}`
        : "flat";

    const returnMix = `${percent(current.returnDistribution.positive)} positive / ${percent(
      current.returnDistribution.neutral,
    )} neutral / ${percent(current.returnDistribution.negative)} negative`;
    const stabilityMix = `${percent(current.stabilityDistribution.stable)} stable / ${percent(
      current.stabilityDistribution.uncertain,
    )} uncertain / ${percent(current.stabilityDistribution.fragile)} fragile`;
    const pressureMix = `${percent(current.pressureDistribution.pressured)} pressured / ${percent(
      current.pressureDistribution.balanced,
    )} balanced / ${percent(current.pressureDistribution.calm)} calm`;

    const hygieneLines: string[] = [];
    if (current.lossStreak.current > 0) {
      hygieneLines.push(
        `Currently on a ${current.lossStreak.current} loss streak (longest ${current.lossStreak.longest}).`,
      );
    }
    if (current.returnDebt > 0) {
      hygieneLines.push(`Return debt sits at ${formatNumber(current.returnDebt)} units.`);
    }
    if (current.paybackRatio > 0) {
      hygieneLines.push(`Need average wins of ${formatNumber(current.paybackRatio)} to clear debt.`);
    }
    if (hygieneLines.length === 0) {
      hygieneLines.push("No active loss streaks detected.");
    }

    return [
      `Over ${windowLabel}, you logged ${current.totalDecisions} decisions with an average D-NAV of ${formatNumber(
        current.avgDnav,
      )}.`,
      `Cadence is ${cadencePhrase}, with recent performance ${trendDescription}.`,
      `Calibration (${formatNumber(current.calibration, 2)}) suggests ${describeCalibration(current.calibration)}`,
      `Return mix: ${returnMix}. Stability mix: ${stabilityMix}. Pressure mix: ${pressureMix}.`,
      `Window archetype: ${current.windowArchetype} — ${current.windowArchetypeDescription}.`,
      `Risk hygiene: ${hygieneLines.join(" ")}`,
      `Policy hint: ${current.policyHint}.`,
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

    const addDistributionVisual = (
      title: string,
      segments: Array<{ key: string; label: string; rgb: [number, number, number] }>,
      values: Record<string, number>,
    ) => {
      const barHeight = 16;
      const barWidth = pageWidth - margin * 2;
      const legendSquare = 12;
      const estimatedHeight = barHeight + 20 + segments.length * (legendSquare + 6) + 20;
      ensureSpace(estimatedHeight);

      const total = segments.reduce((acc, segment) => acc + (values[segment.key] ?? 0), 0);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(title, margin, y);
      y += 20;

      doc.setFillColor(229, 231, 235);
      doc.rect(margin, y, barWidth, barHeight, "F");

      let currentX = margin;
      segments.forEach((segment) => {
        const segmentValue = values[segment.key] ?? 0;
        const width = total > 0 ? (segmentValue / total) * barWidth : 0;
        const [r, g, b] = segment.rgb;
        doc.setFillColor(r, g, b);
        doc.rect(currentX, y, width, barHeight, "F");
        currentX += width;
      });

      y += barHeight + 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);

      segments.forEach((segment) => {
        ensureSpace(legendSquare + 8);
        const [r, g, b] = segment.rgb;
        doc.setFillColor(r, g, b);
        doc.rect(margin, y, legendSquare, legendSquare, "F");
        doc.text(`${segment.label}: ${percent(values[segment.key] ?? 0)}`, margin + legendSquare + 8, y + legendSquare - 2);
        y += legendSquare + 6;
      });
      y += 8;
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
    addDistributionVisual("Return Distribution", RETURN_SEGMENTS, current.returnDistribution);
    addDistributionVisual("Stability Distribution", STABILITY_SEGMENTS, current.stabilityDistribution);
    addDistributionVisual("Pressure Distribution", PRESSURE_SEGMENTS, current.pressureDistribution);
    addSection("Key Metrics", sections.keyMetrics);
    addSection("Distribution Snapshot", sections.distribution);
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DistributionChart
              title="Return Distribution"
              data={stats?.returnDistribution || { positive: 0, neutral: 0, negative: 0 }}
              colors={{
                positive: "hsl(142, 76%, 36%)",
                neutral: "hsl(45, 93%, 47%)",
                negative: "hsl(0, 84%, 60%)",
              }}
            />
            <DistributionChart
              title="Stability Distribution"
              data={stats?.stabilityDistribution || { stable: 0, uncertain: 0, fragile: 0 }}
              colors={{
                stable: "hsl(142, 76%, 36%)",
                uncertain: "hsl(45, 93%, 47%)",
                fragile: "hsl(0, 84%, 60%)",
              }}
            />
            <DistributionChart
              title="Pressure Distribution"
              data={stats?.pressureDistribution || { pressured: 0, balanced: 0, calm: 0 }}
              colors={{
                pressured: "hsl(0, 84%, 60%)",
                balanced: "hsl(45, 93%, 47%)",
                calm: "hsl(142, 76%, 36%)",
              }}
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
              title="Calibration"
              value={formatNumber(stats?.calibration ?? 0, 2)}
              subtitle="Confidence ↔ Return correlation"
              icon={Target}
              color={
                stats?.calibration && stats.calibration > 0.3
                  ? "positive"
                  : stats?.calibration && stats.calibration < -0.3
                  ? "negative"
                  : "default"
              }
              helper={describeCalibration(stats?.calibration ?? 0)}
            />
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <p className="text-2xl font-bold cursor-help">{stats?.returnDebt || 0}</p>
                  </InfoTooltip>
                  <p className="text-xs text-muted-foreground">Sum of losses in streak</p>
                </div>
                <div className="space-y-2">
                  <InfoTooltip term="Payback Ratio">
                    <p className="text-sm font-medium text-muted-foreground cursor-help">Payback Ratio</p>
                  </InfoTooltip>
                  <InfoTooltip term="Payback Ratio" side="bottom">
                    <p className="text-2xl font-bold cursor-help">{stats?.paybackRatio || 0}</p>
                  </InfoTooltip>
                  <p className="text-xs text-muted-foreground">Avg wins to clear debt</p>
                </div>
                <div className="space-y-2">
                  <InfoTooltip term="Policy Hint">
                    <p className="text-sm font-medium text-muted-foreground cursor-help">Policy Hint</p>
                  </InfoTooltip>
                  <InfoTooltip term="Policy Hint" side="bottom">
                    <p className="text-sm font-medium cursor-help">{stats?.policyHint || "No recommendations"}</p>
                  </InfoTooltip>
                  <p className="text-xs text-muted-foreground">Guardrails, not handcuffs</p>
                </div>
              </div>
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
