"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { corr, ema, getArchetype, stdev } from "@/lib/calculations";
import { loadLog } from "@/lib/storage";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle,
  Download,
  FileText,
  Gauge,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface DashboardStats {
  totalDecisions: number;
  avgDnav: number;
  trend: number;
  consistency: number;
  cadence: number;
  calibration: number;
  last5vsPrior5: number;
  windowArchetype: string;
  returnOnEffort: number;
  returnDistribution: { positive: number; neutral: number; negative: number };
  stabilityDistribution: { stable: number; uncertain: number; fragile: number };
  pressureDistribution: { pressured: number; balanced: number; calm: number };
  lossStreak: { current: number; longest: number };
  returnDebt: number;
  paybackRatio: number;
  policyHint: string;
}

export default function StatsPage() {
  const [timeWindow, setTimeWindow] = useState("30");
  const [cadenceUnit, setCadenceUnit] = useState("week");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateStats = useCallback(() => {
    setLoading(true);
    const decisions = loadLog();

    // Filter by time window
    const now = Date.now();
    const windowMs = parseInt(timeWindow) * 24 * 60 * 60 * 1000;
    const filteredDecisions =
      timeWindow === "0" ? decisions : decisions.filter((d) => now - d.ts <= windowMs);

    if (filteredDecisions.length === 0) {
      setStats({
        totalDecisions: 0,
        avgDnav: 0,
        trend: 0,
        consistency: 0,
        cadence: 0,
        calibration: 0,
        last5vsPrior5: 0,
        windowArchetype: "No Data",
        returnOnEffort: 0,
        returnDistribution: { positive: 0, neutral: 0, negative: 0 },
        stabilityDistribution: { stable: 0, uncertain: 0, fragile: 0 },
        pressureDistribution: { pressured: 0, balanced: 0, calm: 0 },
        lossStreak: { current: 0, longest: 0 },
        returnDebt: 0,
        paybackRatio: 0,
        policyHint: "No data available",
      });
      setLoading(false);
      return;
    }

    // Calculate basic metrics
    const dnavScores = filteredDecisions.map((d) => d.dnav);
    const returnScores = filteredDecisions.map((d) => d.return);
    const stabilityScores = filteredDecisions.map((d) => d.stability);
    const pressureScores = filteredDecisions.map((d) => d.pressure);
    const confidenceScores = filteredDecisions.map((d) => d.confidence);
    const energyScores = filteredDecisions.map((d) => d.energy);

    const avgDnav = dnavScores.reduce((a, b) => a + b, 0) / dnavScores.length;
    const consistency = stdev(dnavScores);
    const calibration = corr(confidenceScores, returnScores) || 0;

    // Calculate trend (EMA7 - EMA30 for last 30 decisions)
    const recentDecisions = decisions.slice(0, 30);
    const recentDnavs = recentDecisions.map((d) => d.dnav);
    const trend = recentDnavs.length >= 7 ? ema(recentDnavs, 7) - ema(recentDnavs, 30) : 0;

    // Calculate cadence
    const timeSpanDays =
      timeWindow === "0"
        ? (now - Math.min(...decisions.map((d) => d.ts))) / (24 * 60 * 60 * 1000)
        : parseInt(timeWindow);
    const cadence =
      timeSpanDays > 0
        ? (filteredDecisions.length / timeSpanDays) *
          (cadenceUnit === "day" ? 1 : cadenceUnit === "week" ? 7 : 30)
        : 0;

    // Calculate distributions
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

    // Calculate window archetype
    const avgReturn = returnScores.reduce((a, b) => a + b, 0) / returnScores.length;
    const avgStability = stabilityScores.reduce((a, b) => a + b, 0) / stabilityScores.length;
    const avgPressure = pressureScores.reduce((a, b) => a + b, 0) / pressureScores.length;
    const windowArchetype = getArchetype({
      return: avgReturn,
      stability: avgStability,
      pressure: avgPressure,
      merit: 0,
      energy: 0,
      dnav: 0,
    }).name;

    // Calculate return on effort
    const totalEnergy = energyScores.reduce((a, b) => a + b, 0);
    const totalReturn = returnScores.reduce((a, b) => a + b, 0);
    const returnOnEffort = totalEnergy > 0 ? totalReturn / totalEnergy : 0;

    // Calculate last 5 vs prior 5
    const last5 = decisions.slice(0, 5).map((d) => d.dnav);
    const prior5 = decisions.slice(5, 10).map((d) => d.dnav);
    const last5vsPrior5 =
      last5.length > 0 && prior5.length > 0
        ? last5.reduce((a, b) => a + b, 0) / last5.length -
          prior5.reduce((a, b) => a + b, 0) / prior5.length
        : 0;

    // Calculate loss streak and return debt
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let returnDebt = 0;

    for (const decision of decisions) {
      if (decision.return < 0) {
        tempStreak++;
        returnDebt += Math.abs(decision.return);
        if (tempStreak === 1) currentStreak = tempStreak;
      } else {
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        tempStreak = 0;
      }
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;

    const paybackRatio = longestStreak > 0 ? returnDebt / longestStreak : 0;

    // Generate policy hint
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

    setStats({
      totalDecisions: filteredDecisions.length,
      avgDnav: Math.round(avgDnav * 10) / 10,
      trend: Math.round(trend * 10) / 10,
      consistency: Math.round(consistency * 10) / 10,
      cadence: Math.round(cadence * 10) / 10,
      calibration: Math.round(calibration * 100) / 100,
      last5vsPrior5: Math.round(last5vsPrior5 * 10) / 10,
      windowArchetype,
      returnOnEffort: Math.round(returnOnEffort * 100) / 100,
      returnDistribution,
      stabilityDistribution,
      pressureDistribution,
      lossStreak: { current: currentStreak, longest: longestStreak },
      returnDebt: Math.round(returnDebt * 10) / 10,
      paybackRatio: Math.round(paybackRatio * 10) / 10,
      policyHint,
    });

    setLoading(false);
  }, [cadenceUnit, timeWindow]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const timeWindowLabels: Record<string, string> = {
    "0": "All time",
    "7": "Last 7 days",
    "30": "Last 30 days",
    "90": "Last 90 days",
  };

  const formatNumber = (value: number, digits = 1) =>
    Number.isFinite(value) ? Number(value).toFixed(digits) : "0";

  const percent = (value: number) => `${Math.round(value)}%`;

  const downloadTextFile = (content: string, filename: string, mime = "text/markdown") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const buildStatsReport = (current: DashboardStats): string => {
    const generated = new Date().toLocaleString();
    const windowLabel = timeWindowLabels[timeWindow] ?? `Last ${timeWindow} days`;
    const cadenceLabel = cadenceUnit;

    return [
      "# D-NAV Analytics Report",
      `Generated: ${generated}`,
      `Window: ${windowLabel}`,
      `Cadence basis: per ${cadenceLabel}`,
      "",
      "## Key Metrics",
      `- Total Decisions: ${current.totalDecisions}`,
      `- Average D-NAV: ${formatNumber(current.avgDnav)}`,
      `- Recent Trend (Δ last 5 vs prior 5): ${formatNumber(current.last5vsPrior5)}`,
      `- Cadence: ${formatNumber(current.cadence)} decisions/${cadenceLabel}`,
      `- Consistency (σ): ${formatNumber(current.consistency)}`,
      `- Calibration (ρ): ${formatNumber(current.calibration, 2)}`,
      `- Return on Effort: ${formatNumber(current.returnOnEffort, 2)}`,
      "",
      "## Distribution Snapshot",
      `- Return split: ${percent(current.returnDistribution.positive)} positive / ${percent(current.returnDistribution.neutral)} neutral / ${percent(current.returnDistribution.negative)} negative`,
      `- Stability split: ${percent(current.stabilityDistribution.stable)} stable / ${percent(current.stabilityDistribution.uncertain)} uncertain / ${percent(current.stabilityDistribution.fragile)} fragile`,
      `- Pressure split: ${percent(current.pressureDistribution.pressured)} pressured / ${percent(current.pressureDistribution.balanced)} balanced / ${percent(current.pressureDistribution.calm)} calm`,
      "",
      "## Risk & Hygiene",
      `- Loss streak: ${current.lossStreak.current} current / ${current.lossStreak.longest} longest`,
      `- Return debt: ${formatNumber(current.returnDebt)}`,
      `- Payback ratio: ${formatNumber(current.paybackRatio)}`,
      `- Window archetype: ${current.windowArchetype}`,
      `- Policy hint: ${current.policyHint}`,
      "",
      "Generated by D-NAV.",
    ].join("\n");
  };

  const describeCalibration = (value: number) => {
    if (value > 0.3) return "Confidence is tracking outcomes well.";
    if (value < -0.3) return "Confidence is inverted versus results — pressure-test assumptions.";
    return "Confidence and outcomes are roughly aligned.";
  };

  const buildNarrative = (current: DashboardStats): string => {
    const windowLabel = timeWindowLabels[timeWindow] ?? `Last ${timeWindow} days`;
    const cadencePhrase = current.cadence > 0
      ? `${formatNumber(current.cadence)} decisions per ${cadenceUnit}`
      : "no meaningful cadence";
    const trendDescription =
      current.last5vsPrior5 > 0
        ? "momentum is improving versus the prior period"
        : current.last5vsPrior5 < 0
        ? "results have cooled versus the prior period"
        : "results are steady compared to the prior period";
    const returnSkew = current.returnDistribution.positive - current.returnDistribution.negative;
    const returnDescriptor = returnSkew >= 0 ? "tilting positive" : "facing more downside";
    const stabilityDescriptor =
      current.stabilityDistribution.stable >= current.stabilityDistribution.fragile
        ? "footing is mostly stable"
        : "fragility is outweighing stability";
    const pressureDescriptor =
      current.pressureDistribution.pressured > 40
        ? "pressure is a dominant theme"
        : current.pressureDistribution.calm > 40
        ? "execution feels calm and controlled"
        : "pressure is balanced";
    const streakDescriptor =
      current.lossStreak.current > 0
        ? `A loss streak of ${current.lossStreak.current} (${current.lossStreak.longest} max) is accruing ${formatNumber(current.returnDebt)} return debt.`
        : "No active loss streak is present.";

    return [
      `Across ${windowLabel.toLowerCase()}, you logged ${current.totalDecisions} decisions at ${cadencePhrase}. Average D-NAV sits at ${formatNumber(current.avgDnav)} with the portfolio presenting as a ${current.windowArchetype} pattern; ${trendDescription}.`,
      `Returns are ${returnDescriptor} (${percent(current.returnDistribution.positive)} positive vs ${percent(current.returnDistribution.negative)} negative) while ${stabilityDescriptor} (${percent(current.stabilityDistribution.stable)} stable vs ${percent(current.stabilityDistribution.fragile)} fragile). ${pressureDescriptor}, and return on effort is ${formatNumber(current.returnOnEffort, 2)}. ${describeCalibration(current.calibration)}`,
      `${streakDescriptor} Payback ratio is ${formatNumber(current.paybackRatio)}.`,
      `Policy hint: ${current.policyHint}`,
    ].join("\n\n");
  };

  const handleDownloadStatsReport = () => {
    if (!stats || stats.totalDecisions === 0) return;
    const report = buildStatsReport(stats);
    const filename = `dnav-stats-report-${new Date().toISOString().split("T")[0]}.md`;
    downloadTextFile(report, filename);
  };

  const handleDownloadNarrative = () => {
    if (!stats || stats.totalDecisions === 0) return;
    const narrative = buildNarrative(stats);
    const filename = `dnav-narrative-${new Date().toISOString().split("T")[0]}.md`;
    downloadTextFile(narrative, filename);
  };

  const hasData = Boolean(stats && stats.totalDecisions > 0);

  const narrativeText =
    hasData && stats
      ? buildNarrative(stats)
      : "No decisions logged in this window. Import or record decisions to unlock narrative insights.";

  const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    color = "default",
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    trend?: number;
    color?: "default" | "positive" | "negative" | "warning";
  }) => {
    const colorClasses = {
      default: "text-muted-foreground",
      positive: "text-green-600",
      negative: "text-red-600",
      warning: "text-amber-600",
    };

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className="flex items-center gap-2 mt-1">
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
              <p className={`text-xs mt-1 ${colorClasses[color]}`}>{subtitle}</p>
            </div>
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  };

  const DistributionChart = ({
    title,
    data,
    colors,
  }: {
    title: string;
    data: Record<string, number>;
    colors: Record<string, string>;
  }) => {
    const total = Object.values(data).reduce((a, b) => a + b, 0);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              {Object.entries(data).map(([key, value], index) => (
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
            <div className="flex justify-between text-sm">
              {Object.entries(data).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[key] }} />
                  <span className="capitalize">
                    {key}: {Math.round(value)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Decision Analytics</h1>
          <p className="text-muted-foreground">
            Track your decision-making patterns and performance
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Select value={timeWindow} onValueChange={setTimeWindow}>
            <SelectTrigger className="w-32">
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
          <Button
            variant="outline"
            onClick={handleDownloadStatsReport}
            disabled={!hasData}
          >
            <Download className="h-4 w-4 mr-2" />
            Stats Report
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Decisions"
          value={stats?.totalDecisions || 0}
          subtitle="In selected timeframe"
          icon={Target}
        />
        <StatCard
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
        <StatCard
          title="Decision Cadence"
          value={stats?.cadence || 0}
          subtitle={`Decisions per ${cadenceUnit}`}
          icon={Activity}
        />
        <StatCard
          title="Consistency"
          value={stats?.consistency || 0}
          subtitle="Lower = more steady"
          icon={Brain}
          color={stats?.consistency && stats.consistency > 20 ? "warning" : "positive"}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Calibration"
          value={stats?.calibration || 0}
          subtitle="Confidence ↔ Return correlation"
          icon={Target}
          color={
            stats?.calibration && stats.calibration > 0.3
              ? "positive"
              : stats?.calibration && stats.calibration < -0.3
              ? "negative"
              : "default"
          }
        />
        <StatCard
          title="Recent Trend"
          value={stats?.last5vsPrior5 || 0}
          subtitle="Last 5 vs Prior 5"
          icon={stats?.last5vsPrior5 && stats.last5vsPrior5 > 0 ? TrendingUp : TrendingDown}
          trend={stats?.last5vsPrior5}
        />
        <StatCard
          title="Return on Effort"
          value={stats?.returnOnEffort || 0}
          subtitle="Return per unit energy"
          icon={Zap}
          color={stats?.returnOnEffort && stats.returnOnEffort > 0 ? "positive" : "default"}
        />
        <StatCard
          title="Window Archetype"
          value={stats?.windowArchetype || "—"}
          subtitle="Average decision pattern"
          icon={Brain}
        />
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      {/* Risk Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Risk Management & Hygiene
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Loss Streak</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{stats?.lossStreak.current || 0}</span>
                <span className="text-sm text-muted-foreground">
                  / {stats?.lossStreak.longest || 0}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Current / longest streak</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Return Debt</p>
              <p className="text-2xl font-bold">{stats?.returnDebt || 0}</p>
              <p className="text-xs text-muted-foreground">Sum of losses in streak</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Payback Ratio</p>
              <p className="text-2xl font-bold">{stats?.paybackRatio || 0}</p>
              <p className="text-xs text-muted-foreground">Avg wins to clear debt</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Policy Hint</p>
              <p className="text-sm font-medium">{stats?.policyHint || "No recommendations"}</p>
              <p className="text-xs text-muted-foreground">Guardrails, not handcuffs</p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex items-start gap-2 p-4 bg-muted/50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong>Remember:</strong> Losses aren't "bad." Unmanaged streaks are. Track them so
              "learning" doesn't become a silent bleed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Narrative Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Portfolio Narrative</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadNarrative}
            disabled={!hasData}
          >
            <FileText className="h-4 w-4 mr-2" />
            Download Narrative
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{narrativeText}</p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadStatsReport}
              disabled={!hasData}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadNarrative}
              disabled={!hasData}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Narrative Report
            </Button>
            <Button variant="outline" size="sm">
              <Target className="h-4 w-4 mr-2" />
              Set Goals
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
