"use client";
export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import DatasetSelect from "@/components/DatasetSelect";
import SystemComparePanel from "@/components/SystemComparePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  buildCompanyPeriodSnapshot,
  CompanyPeriodSnapshot,
  FullInterpretation,
  generateFullInterpretation,
} from "@/lib/dnavSummaryEngine";
import { loadDecisionsForDataset } from "@/lib/reportSnapshot";
import { useDataset } from "@/components/DatasetProvider";
import { type DatasetId, type DatasetState } from "@/types/dataset";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import {
  TIMEFRAMES,
  timeframeDescriptions,
  type TimeframeValue,
  useReportsData,
  mapTimeframeToDays,
} from "@/hooks/useReportsData";
import { type DecisionEntry } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { buildCohortSummary, runCompare } from "@/lib/compare/engine";
import { validateRange } from "@/lib/compare/stats";
import {
  type CohortSummary,
  type CompareMode,
  type CompareResult,
  type NormalizationBasis,
  type VelocityGoalTarget,
} from "@/lib/compare/types";
import { filterDecisionsByTimeframe } from "@/utils/judgmentDashboard";
import { buildRangeLabel, formatUnitCount, getUnitLabels } from "@/utils/judgmentUnits";
import { FileDown } from "lucide-react";
import * as XLSX from "xlsx";

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

const resolveTimeframeLabel = (value: TimeframeValue) =>
  TIMEFRAMES.find((timeframe) => timeframe.value === value)?.label ?? "All Time";

type DateRange = { start: string | null; end: string | null };

const msInDay = 24 * 60 * 60 * 1000;

const normalizePeriods = (
  periodADays: number | null,
  periodBDays: number | null,
  shouldNormalize: boolean,
): { normalizedDays: number | null; warning: string | null } => {
  if (periodADays === periodBDays) {
    return { normalizedDays: shouldNormalize ? periodADays : null, warning: null };
  }

  if (!shouldNormalize) {
    return {
      normalizedDays: null,
      warning: `Warning: Period lengths differ (A ${periodADays ?? "all"} vs B ${periodBDays ?? "all"}). Enable normalization to clamp to the shorter range.`,
    };
  }

  if (periodADays === null && periodBDays === null) {
    return { normalizedDays: null, warning: null };
  }

  if (periodADays === null) {
    return {
      normalizedDays: periodBDays,
      warning: `Normalized both periods to ${periodBDays} days (Period B length).`,
    };
  }

  if (periodBDays === null) {
    return {
      normalizedDays: periodADays,
      warning: `Normalized both periods to ${periodADays} days (Period A length).`,
    };
  }

  const normalizedDays = Math.min(periodADays, periodBDays);
  return { normalizedDays, warning: `Normalized both periods to ${normalizedDays} days for strict comparison.` };
};

const filterDecisionsByDateRange = (decisions: DecisionEntry[], start: number | null, end: number | null) =>
  decisions.filter((decision) => {
    if (start && decision.ts < start) return false;
    if (end && decision.ts > end) return false;
    return true;
  });

const resolveDateRange = (value: TimeframeValue, range: DateRange) => {
  const startDate = range.start ? new Date(range.start) : null;
  const endDate = range.end ? new Date(range.end) : null;
  if (startDate || endDate) {
    if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return {
        days: null,
        label: "Custom range",
        start: null,
        end: null,
        isCustom: true,
        isValid: false,
        warning: "Provide both start and end dates for a custom range.",
      } as const;
    }

    const validated = validateRange({ start: startDate.getTime(), end: endDate.getTime() });
    const days = Math.max(Math.ceil((validated.end! - validated.start!) / msInDay) + 1, 1);
    return {
      days,
      label: `${new Date(validated.start!).toLocaleDateString()} – ${new Date(validated.end!).toLocaleDateString()}`,
      start: validated.start,
      end: validated.end,
      isCustom: true,
      isValid: true,
      warning: validated.warning,
    } as const;
  }

  return {
    days: mapTimeframeToDays(value),
    label: resolveTimeframeLabel(value),
    start: null,
    end: null,
    isCustom: false,
    isValid: true,
    warning: null,
  } as const;
};

const clampSequenceRange = (range: { start: number; end: number }, total: number) => {
  if (total <= 0) return { start: 1, end: 1 };
  const start = Math.max(1, Math.min(range.start, total));
  const end = Math.max(start, Math.min(range.end, total));
  return { start, end };
};

const buildDefaultSequenceRanges = (total: number) => {
  const midpoint = Math.max(1, Math.floor(total / 2));
  return {
    a: { start: 1, end: midpoint },
    b: { start: midpoint + 1, end: total },
  };
};

const DEFAULT_VELOCITY_THRESHOLDS = {
  returnLift: 1,
  pressureBand: 0.5,
  stabilityFloor: 0,
  stabilityBand: 0.5,
};

function ReportsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTimeframe = useMemo(() => searchParams.get("window"), [searchParams]);
  const debugEnabled = useMemo(
    () => process.env.NEXT_PUBLIC_DNAV_DEBUG === "1" || searchParams.get("debug") === "1",
    [searchParams],
  );
  const resolvedTimeframe = useMemo<TimeframeValue>(
    () =>
      TIMEFRAMES.some(({ value }) => value === queryTimeframe)
        ? (queryTimeframe as TimeframeValue)
        : "all",
    [queryTimeframe],
  );
  const { activeDatasetId: datasetId, datasets, getDatasetById } = useDataset();
  const hasAtLeastTwoDatasets = datasets.length >= 2;
  const defaultDatasetAId = datasets[0]?.id ?? null;
  const defaultDatasetBId = datasets.at(1)?.id ?? null;
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeValue>(resolvedTimeframe);
  const [datasetAId, setDatasetAId] = useState<DatasetId | null>(defaultDatasetAId);
  const [datasetBId, setDatasetBId] = useState<DatasetId | null>(defaultDatasetBId);
  const [temporalDatasetId, setTemporalDatasetId] = useState<DatasetId | null>(defaultDatasetAId);
  const [compareTimeframe, setCompareTimeframe] = useState<TimeframeValue>(resolvedTimeframe);
  const [temporalPeriodA, setTemporalPeriodA] = useState<TimeframeValue>("30");
  const [temporalPeriodB, setTemporalPeriodB] = useState<TimeframeValue>("90");
  const [customTemporalPeriodA, setCustomTemporalPeriodA] = useState<DateRange>({ start: null, end: null });
  const [customTemporalPeriodB, setCustomTemporalPeriodB] = useState<DateRange>({ start: null, end: null });
  const [temporalSequenceMode, setTemporalSequenceMode] = useState(false);
  const [temporalSequenceRangeA, setTemporalSequenceRangeA] = useState<{ start: number; end: number }>({
    start: 1,
    end: 1,
  });
  const [temporalSequenceRangeB, setTemporalSequenceRangeB] = useState<{ start: number; end: number }>({
    start: 1,
    end: 1,
  });
  const [normalizeTemporalRanges, setNormalizeTemporalRanges] = useState(false);
  const [velocityTimeframe, setVelocityTimeframe] = useState<TimeframeValue>(resolvedTimeframe);
  const [velocityWindowSize, setVelocityWindowSize] = useState(5);
  const [velocityConsecutiveWindows, setVelocityConsecutiveWindows] = useState(3);
  const [velocityThresholds, setVelocityThresholds] = useState(DEFAULT_VELOCITY_THRESHOLDS);
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>("entity");
  const [velocityTarget, setVelocityTarget] = useState<VelocityGoalTarget>("PRESSURE_STABILIZE");
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareWarning, setCompareWarning] = useState<string | null>(null);
  const { isLoggedIn, openLogin } = useNetlifyIdentity();

  const datasetOptions = useMemo(
    () =>
      datasets.map((dataset) => ({
        value: dataset.id,
        label: dataset.label,
      })),
    [datasets],
  );
  const datasetLabelMap = useMemo(() => new Map(datasetOptions.map((option) => [option.value, option.label])), [
    datasetOptions,
  ]);

  const resolveDatasetLabel = useCallback(
    (id: DatasetId | null) => {
      if (!id) return "";
      const mapped = datasetLabelMap.get(id);
      if (mapped) return mapped;
      const index = datasets.findIndex((dataset) => dataset.id === id);
      return index >= 0 ? datasets[index]?.label ?? "" : "";
    },
    [datasetLabelMap, datasets],
  );

  const datasetALabel = resolveDatasetLabel(datasetAId);
  const datasetBLabel = resolveDatasetLabel(datasetBId);

  useEffect(() => {
    setSelectedTimeframe(resolvedTimeframe);
  }, [resolvedTimeframe]);

  useEffect(() => {
    setVelocityThresholds(DEFAULT_VELOCITY_THRESHOLDS);
  }, [velocityTarget]);

  useEffect(() => {
    setDatasetAId(datasetId ?? defaultDatasetAId);
    setTemporalDatasetId((current) => current ?? datasetId ?? defaultDatasetAId);
  }, [datasetId, defaultDatasetAId]);

  useEffect(() => {
    if (datasetAId && !datasets.some((dataset) => dataset.id === datasetAId)) {
      setDatasetAId(datasets[0]?.id ?? null);
    }
    if (datasetBId && !datasets.some((dataset) => dataset.id === datasetBId)) {
      setDatasetBId(datasets.at(1)?.id ?? null);
    }
    if (temporalDatasetId && !datasets.some((dataset) => dataset.id === temporalDatasetId)) {
      setTemporalDatasetId(datasets[0]?.id ?? null);
    }
  }, [datasetAId, datasetBId, datasets, temporalDatasetId]);

  const datasetA = useMemo(() => getDatasetById(datasetAId) ?? null, [datasetAId, getDatasetById]);
  const datasetB = useMemo(() => getDatasetById(datasetBId) ?? null, [datasetBId, getDatasetById]);
  const temporalDataset = useMemo(
    () => getDatasetById(temporalDatasetId) ?? null,
    [getDatasetById, temporalDatasetId],
  );
  const temporalUnitLabel = temporalDataset?.meta.judgmentUnitLabel;
  const velocityUnitLabel = datasetA?.meta.judgmentUnitLabel || datasetB?.meta.judgmentUnitLabel;
  const velocityUnitLabels = getUnitLabels(velocityUnitLabel);
  const temporalDecisionCount = temporalDataset?.decisions.length ?? 0;
  const clampedRangeA = useMemo(
    () => clampSequenceRange(temporalSequenceRangeA, temporalDecisionCount),
    [temporalDecisionCount, temporalSequenceRangeA],
  );
  const clampedRangeB = useMemo(
    () => clampSequenceRange(temporalSequenceRangeB, temporalDecisionCount),
    [temporalDecisionCount, temporalSequenceRangeB],
  );

  useEffect(() => {
    const total = temporalDataset?.decisions.length ?? 0;
    if (total <= 0) {
      setTemporalSequenceRangeA({ start: 1, end: 1 });
      setTemporalSequenceRangeB({ start: 1, end: 1 });
      return;
    }

    const defaults = buildDefaultSequenceRanges(total);
    setTemporalSequenceRangeA((current) => {
      if (current.start === 1 && current.end === 1) return defaults.a;
      return clampSequenceRange(current, total);
    });
    setTemporalSequenceRangeB((current) => {
      if (current.start === 1 && current.end === 1) return defaults.b;
      return clampSequenceRange(current, total);
    });
  }, [temporalDataset]);

  useEffect(() => {
    let cancelled = false;
    setCompareResult(null);
    setCompareWarning(null);
    setIsCompareLoading(true);

    const basisForMode: NormalizationBasis = compareMode === "temporal" ? "normalized_windows" : "shared_timeframe";
    const warnings: string[] = [];

    const build = async () => {
      if (compareMode === "entity") {
        if (!datasetA || !datasetB) {
          if (!hasAtLeastTwoDatasets) setCompareWarning("Add at least two datasets to compare.");
          setIsCompareLoading(false);
          return;
        }

        const timeframeDays = mapTimeframeToDays(compareTimeframe);
        const timeframeLabel = resolveTimeframeLabel(compareTimeframe);
        const [summaryA, summaryB] = await Promise.all([
          buildCohortSummaryFromDataset({
            dataset: datasetA,
            label: datasetALabel || "System A",
            timeframeDays,
            timeframeLabel,
            normalizationBasis: basisForMode,
            judgmentUnitLabel: datasetA.meta.judgmentUnitLabel,
          }),
          buildCohortSummaryFromDataset({
            dataset: datasetB,
            label: datasetBLabel || "System B",
            timeframeDays,
            timeframeLabel,
            normalizationBasis: basisForMode,
            judgmentUnitLabel: datasetB.meta.judgmentUnitLabel,
          }),
        ]);

        if (cancelled) return;
        if (!summaryA || !summaryB) {
          setIsCompareLoading(false);
          return;
        }

        const result = runCompare({
          mode: "entity",
          normalizationBasis: basisForMode,
          cohortA: summaryA.summary,
          cohortB: summaryB.summary,
          decisionsA: summaryA.decisions,
          decisionsB: summaryB.decisions,
        });

        setCompareResult(result);
        setIsCompareLoading(false);
        return;
      }

      if (compareMode === "temporal") {
        if (!temporalDataset) {
          setIsCompareLoading(false);
          return;
        }

        if (temporalSequenceMode) {
          const total = temporalDataset.decisions.length;
          const rangeA = clampSequenceRange(temporalSequenceRangeA, total);
          const rangeB = clampSequenceRange(temporalSequenceRangeB, total);
          const timeframeLabelA = buildRangeLabel(rangeA.start, rangeA.end, temporalUnitLabel);
          const timeframeLabelB = buildRangeLabel(rangeB.start, rangeB.end, temporalUnitLabel);
          const normalizationBasis: NormalizationBasis = "shared_timeframe";

          const [periodASummary, periodBSummary] = await Promise.all([
            buildCohortSummaryFromDataset({
              dataset: temporalDataset,
              label: `${resolveDatasetLabel(temporalDatasetId)} · Period A`,
              timeframeDays: null,
              timeframeLabel: timeframeLabelA,
              normalizationBasis,
              judgmentUnitLabel: temporalUnitLabel,
              sequenceMode: true,
              sequenceRange: rangeA,
            }),
            buildCohortSummaryFromDataset({
              dataset: temporalDataset,
              label: `${resolveDatasetLabel(temporalDatasetId)} · Period B`,
              timeframeDays: null,
              timeframeLabel: timeframeLabelB,
              normalizationBasis,
              judgmentUnitLabel: temporalUnitLabel,
              sequenceMode: true,
              sequenceRange: rangeB,
            }),
          ]);

          if (cancelled) return;
          if (!periodASummary || !periodBSummary) {
            setIsCompareLoading(false);
            return;
          }

          const result = runCompare({
            mode: "temporal",
            normalizationBasis,
            cohortA: periodASummary.summary,
            cohortB: periodBSummary.summary,
            decisionsA: periodASummary.decisions,
            decisionsB: periodBSummary.decisions,
          });

          setCompareResult(result);
          setIsCompareLoading(false);
          return;
        }

        const periodAConfig = resolveDateRange(temporalPeriodA, customTemporalPeriodA);
        const periodBConfig = resolveDateRange(temporalPeriodB, customTemporalPeriodB);

        if (!periodAConfig.isValid || !periodBConfig.isValid) {
          const message = periodAConfig.warning || periodBConfig.warning || "Invalid date range.";
          setCompareWarning(message);
          setIsCompareLoading(false);
          return;
        }

        if (periodAConfig.warning) warnings.push(periodAConfig.warning);
        if (periodBConfig.warning) warnings.push(periodBConfig.warning);

        const { normalizedDays, warning } = normalizePeriods(
          periodAConfig.days,
          periodBConfig.days,
          normalizeTemporalRanges,
        );
        if (warning) warnings.push(warning);

        const timeframeLabelA = periodAConfig.label;
        const timeframeLabelB = periodBConfig.label;
        const normalizedBasis: NormalizationBasis = normalizedDays ? "normalized_windows" : "shared_timeframe";

        const [periodASummary, periodBSummary] = await Promise.all([
          buildCohortSummaryFromDataset({
            dataset: temporalDataset,
            label: `${resolveDatasetLabel(temporalDatasetId)} · Period A`,
            timeframeDays: periodAConfig.days,
            timeframeLabel: timeframeLabelA,
            normalizationBasis: normalizedBasis,
            normalizeToDays: normalizedDays,
            customRange: periodAConfig.isCustom
              ? { start: periodAConfig.start, end: periodAConfig.end }
              : undefined,
            judgmentUnitLabel: temporalUnitLabel,
          }),
          buildCohortSummaryFromDataset({
            dataset: temporalDataset,
            label: `${resolveDatasetLabel(temporalDatasetId)} · Period B`,
            timeframeDays: periodBConfig.days,
            timeframeLabel: timeframeLabelB,
            normalizationBasis: normalizedBasis,
            normalizeToDays: normalizedDays,
            customRange: periodBConfig.isCustom
              ? { start: periodBConfig.start, end: periodBConfig.end }
              : undefined,
            judgmentUnitLabel: temporalUnitLabel,
          }),
        ]);

        if (cancelled) return;
        if (!periodASummary || !periodBSummary) {
          setIsCompareLoading(false);
          return;
        }

        const result = runCompare({
          mode: "temporal",
          normalizationBasis: normalizedBasis,
          cohortA: periodASummary.summary,
          cohortB: periodBSummary.summary,
          decisionsA: periodASummary.decisions,
          decisionsB: periodBSummary.decisions,
          warnings: warnings.length ? warnings : undefined,
        });

        setCompareResult(result);
        setCompareWarning(warnings.length ? warnings.join(" ") : null);
        setIsCompareLoading(false);
        return;
      }

      if (compareMode === "velocity") {
        if (!datasetA || !datasetB) {
          setIsCompareLoading(false);
          return;
        }

        const timeframeDays = mapTimeframeToDays(velocityTimeframe);
        const timeframeLabel = resolveTimeframeLabel(velocityTimeframe);
        const [summaryA, summaryB] = await Promise.all([
          buildCohortSummaryFromDataset({
            dataset: datasetA,
            label: datasetALabel || "System A",
            timeframeDays,
            timeframeLabel,
            normalizationBasis: basisForMode,
            judgmentUnitLabel: datasetA.meta.judgmentUnitLabel,
          }),
          buildCohortSummaryFromDataset({
            dataset: datasetB,
            label: datasetBLabel || "System B",
            timeframeDays,
            timeframeLabel,
            normalizationBasis: basisForMode,
            judgmentUnitLabel: datasetB.meta.judgmentUnitLabel,
          }),
        ]);

        if (cancelled) return;
        if (!summaryA || !summaryB) {
          setIsCompareLoading(false);
          return;
        }

        const result = runCompare({
          mode: "velocity",
          normalizationBasis: basisForMode,
          velocityTarget,
          cohortA: summaryA.summary,
          cohortB: summaryB.summary,
          decisionsA: summaryA.decisions,
          decisionsB: summaryB.decisions,
          windowSize: velocityWindowSize,
          consecutiveWindows: velocityConsecutiveWindows,
          thresholds: velocityThresholds,
        });

        setCompareResult(result);
        setIsCompareLoading(false);
      }
    };

    build();

    return () => {
      cancelled = true;
    };
  }, [
    compareMode,
    compareTimeframe,
    datasetA,
    datasetALabel,
    datasetB,
    datasetBLabel,
    hasAtLeastTwoDatasets,
    temporalDataset,
    temporalDatasetId,
    temporalPeriodA,
    temporalPeriodB,
    customTemporalPeriodA,
    customTemporalPeriodB,
    temporalSequenceMode,
    temporalSequenceRangeA,
    temporalSequenceRangeB,
    normalizeTemporalRanges,
    temporalUnitLabel,
    resolveDatasetLabel,
    velocityTarget,
    velocityTimeframe,
    velocityWindowSize,
    velocityConsecutiveWindows,
    velocityThresholds,
  ]);

  const {
    company,
    baseline,
    categories,
    archetypes,
    learning,
    stats,
    allDecisions,
  } = useReportsData({ timeframe: selectedTimeframe, datasetId });

  const timeframeConfig = useMemo(
    () => TIMEFRAMES.find((timeframe) => timeframe.value === selectedTimeframe) ?? TIMEFRAMES[0],
    [selectedTimeframe],
  );

  const hasData = stats.totalDecisions > 0;

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
      categories.map((category) => ({
        name: category.category,
        decisionCount: category.decisionCount,
        share: category.percent ?? 0,
        avgDnav: category.avgDnav,
        avgR: category.avgR,
        avgP: category.avgP,
        avgS: category.avgS,
        dominantFactor: category.dominantVariable,
      })),
    [categories],
  );

  const archetypeProfile = useMemo(() => archetypes, [archetypes]);

  const learningStats = useMemo(
    () => ({
      lci: learning.lci ?? 0,
      decisionsToRecover: learning.decisionsToRecover ?? 0,
      winRate: learning.winRate ?? 0,
      decisionDebt: learning.decisionDebt ?? 0,
    }),
    [learning.decisionDebt, learning.decisionsToRecover, learning.lci, learning.winRate],
  );

  const snapshot = useMemo<CompanyPeriodSnapshot>(() => {
    return buildCompanyPeriodSnapshot({
      company,
      baseline,
      categories,
      archetypes,
      learning,
      timeframeKey: selectedTimeframe,
      timeframeLabel: timeframeConfig.label,
    });
  }, [archetypes, baseline, categories, company, learning, selectedTimeframe, timeframeConfig.label]);

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

  const handleUpdateTimeframe = (value: TimeframeValue) => {
    setSelectedTimeframe(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("window", value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleSignInClick = () => {
    openLogin();
  };

  const handleBookAuditClick = () => {
    if (typeof window === "undefined") return;
    window.location.href = "/contact";
  };

  const handleExportCsv = () => {
    if (!isLoggedIn || allDecisions.length === 0) return;
    const csvContent = createCsvContent(allDecisions);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const filename = `dnav-decision-log-${slugify(timeframeConfig.label)}.csv`;
    downloadBlob(blob, filename);
  };

  const handleExportExcel = () => {
    if (!isLoggedIn || allDecisions.length === 0) return;
    const rows = buildDecisionRows(allDecisions);
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

  const handleExportCompare = (result: unknown) => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const filename = `dnav-compare-${slugify(timeframeConfig.label)}.json`;
    downloadBlob(blob, filename);
  };

  // Use the browser print dialog to export the report view.
  const handlePrint = () => {
    if (typeof window === "undefined") return;

    const filename = `${snapshot.companyName} - Decision Orbit ${snapshot.periodLabel}.pdf`;

    document.title = filename;
    window.print();
  };

  return (
    <TooltipProvider>
      <div className="dn-reports-root flex flex-col gap-8">
        <section className="no-print rounded-2xl border bg-card/80 p-6 shadow-sm print:hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-3">
              <Badge variant="secondary" className="w-fit uppercase tracking-wide">
                Reports Hub
              </Badge>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold">Share decision intelligence</h1>
                <p className="text-sm text-muted-foreground">Download structured decision data without leaving D-NAV.</p>
              </div>
            </div>
            <DatasetSelect label="Base dataset" />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={!isLoggedIn || allDecisions.length === 0}
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={!isLoggedIn || allDecisions.length === 0}
              >
                Export Excel
              </Button>
              <Button
                size="sm"
                className="bg-orange-500 text-white hover:bg-orange-600"
                onClick={handlePrint}
                disabled={!isLoggedIn || !hasData}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download report
              </Button>
            </div>
            <div className="print:hidden text-xs text-muted-foreground">
              For best results, enable “Background Graphics” in the print dialog.
            </div>
          </div>
        </section>

        <section className="no-print flex flex-col gap-2 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-muted/60 pb-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeframe</p>
              <p className="text-sm text-muted-foreground">{timeframeDescriptions[selectedTimeframe]}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={selectedTimeframe === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleUpdateTimeframe(value)}
                  className={cn(
                    "rounded-full px-3 text-xs",
                    selectedTimeframe === value ? "shadow-sm" : "bg-muted/60 text-foreground",
                  )}
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
                  Export-ready datasets are reserved for D-NAV clients. Sign in to access your reports or book a Decision Audit to get started.
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
          <div
            className={cn("space-y-6", !isLoggedIn && "pointer-events-none filter blur-sm opacity-50")}
          >
            <OnePageReport
              snapshot={snapshot}
              interpretation={interpretation}
              baselineDistributions={baselineDistributions}
              topCategories={topCategories}
              sortedArchetypes={sortedArchetypes}
              learningStats={learningStats}
            />

            {/* System-level compare */}
            <section className="no-print mt-10 space-y-4 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Compare</p>
                  <p className="text-xs text-muted-foreground">
                    {compareResult?.modeSummary ?? "Choose a mode to compare systems."}
                  </p>
                </div>
                {compareResult && (compareWarning || debugEnabled) && (
                  <div className="flex items-center gap-2">
                    {compareWarning && <Badge variant="outline">Notice</Badge>}
                    {debugEnabled && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportCompare(compareResult)}
                        disabled={!compareResult}
                      >
                        Export Compare JSON
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border bg-card/70 p-4 shadow-sm space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mode</p>
                  <Select value={compareMode} onValueChange={(value) => setCompareMode(value as CompareMode)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entity">Entity</SelectItem>
                      <SelectItem value="temporal">Temporal</SelectItem>
                      <SelectItem value="velocity">Recovery Index</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {compareMode === "entity"
                      ? "Compare two systems over the same timeframe."
                      : compareMode === "temporal"
                        ? "Compare the same system across equal windows."
                        : "Compare how quickly the system re-enters stability after deviation."}
                  </p>
                </div>

                {compareMode !== "temporal" && (
                  <div className="rounded-2xl border bg-card/70 p-4 shadow-sm space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">System A</p>
                    <p className="text-xs text-muted-foreground">{datasetALabel || "Select a dataset"}</p>
                    <Select value={datasetAId ?? undefined} onValueChange={(value) => setDatasetAId(value as DatasetId)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select dataset" />
                      </SelectTrigger>
                      <SelectContent>
                        {datasetOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {compareMode !== "temporal" && (
                  <div className="rounded-2xl border bg-card/70 p-4 shadow-sm space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">System B</p>
                    <p className="text-xs text-muted-foreground">
                      {hasAtLeastTwoDatasets ? datasetBLabel || "Select a dataset" : "Add another dataset to compare"}
                    </p>
                    <Select
                      value={datasetBId ?? undefined}
                      onValueChange={(value) => setDatasetBId(value as DatasetId)}
                      disabled={!hasAtLeastTwoDatasets}
                    >
                      <SelectTrigger className="w-full" disabled={!hasAtLeastTwoDatasets}>
                        <SelectValue placeholder={hasAtLeastTwoDatasets ? "Select dataset" : "Need at least two datasets"} />
                      </SelectTrigger>
                      <SelectContent>
                        {datasetOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {compareMode === "velocity" && (
                  <div className="rounded-2xl border bg-card/70 p-4 shadow-sm space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Metric target</p>
                    <Select value={velocityTarget} onValueChange={(value) => setVelocityTarget(value as VelocityGoalTarget)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RETURN_RISE">Return rises</SelectItem>
                        <SelectItem value="PRESSURE_STABILIZE">Pressure stabilizes</SelectItem>
                        <SelectItem value="STABILITY_STABILIZE">Stability stabilizes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">See when each system reaches the goal.</p>
                  </div>
                )}

                {compareMode === "temporal" && (
                  <div className="rounded-2xl border bg-card/70 p-4 shadow-sm space-y-2 md:col-span-2 lg:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dataset</p>
                        <p className="text-xs text-muted-foreground">
                          {resolveDatasetLabel(temporalDatasetId) || "Select a dataset"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Sequence mode
                          </p>
                          <p className="text-[11px] text-muted-foreground">Use index ranges when timestamps are missing.</p>
                        </div>
                        <Switch checked={temporalSequenceMode} onCheckedChange={setTemporalSequenceMode} />
                      </div>
                    </div>
                    <Select
                      value={temporalDatasetId ?? undefined}
                      onValueChange={(value) => setTemporalDatasetId(value as DatasetId)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select dataset" />
                      </SelectTrigger>
                      <SelectContent>
                        {datasetOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {compareMode === "entity" && (
                <div className="flex flex-wrap items-center gap-2">
                  {TIMEFRAMES.map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={compareTimeframe === value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCompareTimeframe(value)}
                      className={cn(
                        "rounded-full px-3 text-xs",
                        compareTimeframe === value ? "shadow-sm" : "bg-muted/60 text-foreground",
                      )}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}

              {compareMode === "velocity" && (
                <div className="flex flex-wrap items-center gap-2">
                  {TIMEFRAMES.map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={velocityTimeframe === value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVelocityTimeframe(value)}
                      className={cn(
                        "rounded-full px-3 text-xs",
                        velocityTimeframe === value ? "shadow-sm" : "bg-muted/60 text-foreground",
                      )}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}

              {compareMode === "velocity" && (
                <div className="grid gap-3 rounded-2xl border bg-card/60 p-4 shadow-sm md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Compare settings</p>
                    <p className="text-xs text-muted-foreground">Tune the rolling window and how strict the target rule is.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase text-muted-foreground">Window size ({velocityUnitLabels.plural})</p>
                        <Select
                          value={velocityWindowSize.toString()}
                          onValueChange={(value) => setVelocityWindowSize(Number.parseInt(value, 10))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select window" />
                          </SelectTrigger>
                          <SelectContent>
                            {[3, 5, 10].map((size) => (
                              <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase text-muted-foreground">Consecutive windows (k)</p>
                        <Select
                          value={velocityConsecutiveWindows.toString()}
                          onValueChange={(value) => setVelocityConsecutiveWindows(Number.parseInt(value, 10))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select k" />
                          </SelectTrigger>
                          <SelectContent>
                            {[2, 3, 5].map((count) => (
                              <SelectItem key={count} value={count.toString()}>
                                {count}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Target thresholds</p>
                    {velocityTarget === "RETURN_RISE" && (
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase text-muted-foreground">Return lift (ΔR)</p>
                        <Input
                          type="number"
                          step="0.1"
                          value={velocityThresholds.returnLift}
                          onChange={(event) =>
                            setVelocityThresholds((prev) => ({
                              ...prev,
                              returnLift: Number.parseFloat(event.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                    )}

                    {velocityTarget === "PRESSURE_STABILIZE" && (
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase text-muted-foreground">Pressure band (±)</p>
                        <Input
                          type="number"
                          step="0.1"
                          value={velocityThresholds.pressureBand}
                          onChange={(event) =>
                            setVelocityThresholds((prev) => ({
                              ...prev,
                              pressureBand: Number.parseFloat(event.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                    )}

                    {velocityTarget === "STABILITY_STABILIZE" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase text-muted-foreground">Stability floor</p>
                          <Input
                            type="number"
                            step="0.1"
                            value={velocityThresholds.stabilityFloor}
                            onChange={(event) =>
                              setVelocityThresholds((prev) => ({
                                ...prev,
                                stabilityFloor: Number.parseFloat(event.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase text-muted-foreground">Stability band (±)</p>
                          <Input
                            type="number"
                            step="0.1"
                            value={velocityThresholds.stabilityBand}
                            onChange={(event) =>
                              setVelocityThresholds((prev) => ({
                                ...prev,
                                stabilityBand: Number.parseFloat(event.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {compareMode === "temporal" && (
              <div className="grid gap-3 rounded-2xl border bg-card/60 p-4 shadow-sm md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Period A</p>
                  {temporalSequenceMode ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          type="number"
                          min={1}
                          value={clampedRangeA.start}
                          onChange={(event) =>
                            setTemporalSequenceRangeA((current) =>
                              clampSequenceRange(
                                { ...current, start: Number.parseInt(event.target.value || "1", 10) },
                                temporalDecisionCount,
                              ),
                            )
                          }
                        />
                        <Input
                          type="number"
                          min={1}
                          value={clampedRangeA.end}
                          onChange={(event) =>
                            setTemporalSequenceRangeA((current) =>
                              clampSequenceRange(
                                { ...current, end: Number.parseInt(event.target.value || "1", 10) },
                                temporalDecisionCount,
                              ),
                            )
                          }
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {buildRangeLabel(clampedRangeA.start, clampedRangeA.end, temporalUnitLabel)} · {formatUnitCount(temporalDecisionCount, temporalUnitLabel)} total
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {TIMEFRAMES.map(({ value, label }) => (
                          <Button
                            key={value}
                            variant={temporalPeriodA === value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTemporalPeriodA(value)}
                            className={cn(
                              "rounded-full px-3 text-xs",
                              temporalPeriodA === value ? "shadow-sm" : "bg-muted/60 text-foreground",
                            )}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          type="date"
                          value={customTemporalPeriodA.start ?? ""}
                          onChange={(event) =>
                            setCustomTemporalPeriodA((current) => ({ ...current, start: event.target.value || null }))
                          }
                        />
                        <Input
                          type="date"
                          value={customTemporalPeriodA.end ?? ""}
                          onChange={(event) =>
                            setCustomTemporalPeriodA((current) => ({ ...current, end: event.target.value || null }))
                          }
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">Custom dates override quick picks for this period.</p>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Period B</p>
                  {temporalSequenceMode ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          type="number"
                          min={1}
                          value={clampedRangeB.start}
                          onChange={(event) =>
                            setTemporalSequenceRangeB((current) =>
                              clampSequenceRange(
                                { ...current, start: Number.parseInt(event.target.value || "1", 10) },
                                temporalDecisionCount,
                              ),
                            )
                          }
                        />
                        <Input
                          type="number"
                          min={1}
                          value={clampedRangeB.end}
                          onChange={(event) =>
                            setTemporalSequenceRangeB((current) =>
                              clampSequenceRange(
                                { ...current, end: Number.parseInt(event.target.value || "1", 10) },
                                temporalDecisionCount,
                              ),
                            )
                          }
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {buildRangeLabel(clampedRangeB.start, clampedRangeB.end, temporalUnitLabel)} · {formatUnitCount(temporalDecisionCount, temporalUnitLabel)} total
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {TIMEFRAMES.map(({ value, label }) => (
                          <Button
                            key={value}
                            variant={temporalPeriodB === value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTemporalPeriodB(value)}
                            className={cn(
                              "rounded-full px-3 text-xs",
                              temporalPeriodB === value ? "shadow-sm" : "bg-muted/60 text-foreground",
                            )}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          type="date"
                          value={customTemporalPeriodB.start ?? ""}
                          onChange={(event) =>
                            setCustomTemporalPeriodB((current) => ({ ...current, start: event.target.value || null }))
                          }
                        />
                        <Input
                          type="date"
                          value={customTemporalPeriodB.end ?? ""}
                          onChange={(event) =>
                            setCustomTemporalPeriodB((current) => ({ ...current, end: event.target.value || null }))
                          }
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">Use matching date ranges for apples-to-apples comparisons.</p>
                    </>
                  )}
                </div>
              </div>
            )}

              {compareMode === "temporal" && !temporalSequenceMode && (
                <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Normalize to shorter range</p>
                    <p className="text-[11px] text-muted-foreground">
                      When on, both periods are clamped to the shorter duration to enforce equal windows.
                    </p>
                  </div>
                  <Switch checked={normalizeTemporalRanges} onCheckedChange={setNormalizeTemporalRanges} />
                </div>
              )}

              {compareWarning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {compareWarning}
                </div>
              )}

              <div className="rounded-2xl border bg-muted/30 p-4">
                {isCompareLoading ? (
                  <div className="text-sm text-muted-foreground">Loading compare…</div>
                ) : compareResult ? (
                  <SystemComparePanel
                    result={compareResult}
                    warning={compareWarning ?? undefined}
                    showDebug={debugEnabled}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {compareMode === "temporal"
                      ? "Select a dataset and two windows of equal length."
                      : "Select datasets and a timeframe to run a comparison."}
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}

type BaselineDistribution = {
  positive: number;
  neutral: number;
  negative: number;
};

type BaselineDistributions = {
  returnDistribution: BaselineDistribution;
  pressureDistribution: BaselineDistribution;
  stabilityDistribution: BaselineDistribution;
};

type TopCategory = {
  name: string;
  decisionCount: number;
  share: number;
  avgDnav: number;
  avgR: number;
  avgP: number;
  avgS: number;
  dominantFactor: string | null;
};

type ArchetypeSummary = {
  archetype: string;
  avgR: number;
  avgP: number;
  avgS: number;
  count: number;
};

async function buildCohortSummaryFromDataset({
  dataset,
  label,
  timeframeDays,
  timeframeLabel,
  normalizationBasis,
  normalizeToDays,
  customRange,
  judgmentUnitLabel,
  sequenceMode,
  sequenceRange,
}: {
  dataset: DatasetState | null;
  label: string;
  timeframeDays: number | null;
  timeframeLabel: string;
  normalizationBasis: NormalizationBasis;
  normalizeToDays?: number | null;
  customRange?: { start: number | null; end: number | null };
  judgmentUnitLabel?: string | null;
  sequenceMode?: boolean;
  sequenceRange?: { start: number; end: number } | null;
}): Promise<{ summary: CohortSummary; decisions: DecisionEntry[] } | null> {
  if (!dataset) return null;
  const decisions = await loadDecisionsForDataset(dataset);
  const sorted = sequenceMode ? [...decisions].sort((a, b) => a.ts - b.ts) : [...decisions].sort((a, b) => b.ts - a.ts);
  const effectiveDays = normalizeToDays ?? timeframeDays;
  const filteredByRange = sequenceMode
    ? sorted.slice(
        clampSequenceRange(sequenceRange ?? { start: 1, end: sorted.length }, sorted.length).start - 1,
        clampSequenceRange(sequenceRange ?? { start: 1, end: sorted.length }, sorted.length).end,
      )
    : customRange
      ? filterDecisionsByDateRange(sorted, customRange.start, customRange.end)
      : sorted;
  const filtered = sequenceMode ? filteredByRange : filterDecisionsByTimeframe(filteredByRange, effectiveDays);
  if (filtered.length === 0) return null;

  const effectiveRange = sequenceMode
    ? clampSequenceRange(sequenceRange ?? { start: 1, end: sorted.length }, sorted.length)
    : null;
  const resolvedTimeframeLabel = sequenceMode && effectiveRange
    ? buildRangeLabel(effectiveRange.start, effectiveRange.end, judgmentUnitLabel)
    : timeframeLabel;

  const summary = buildCohortSummary({
    decisions: filtered,
    request: {
      label,
      timeframeLabel: resolvedTimeframeLabel,
      normalizationBasis,
      judgmentUnitLabel: judgmentUnitLabel ?? undefined,
      datasetLabel: dataset.label,
      timeframeMode: sequenceMode ? "sequence" : "time",
      sequenceRange: effectiveRange,
      totalAvailableDecisions: decisions.length,
    },
  });

  return { summary, decisions: filtered };
}

type LearningStats = {
  lci: number;
  decisionsToRecover: number;
  winRate: number;
  decisionDebt: number;
};

type OnePageReportProps = {
  snapshot: CompanyPeriodSnapshot;
  interpretation: FullInterpretation;
  baselineDistributions: BaselineDistributions;
  topCategories: TopCategory[];
  sortedArchetypes: ArchetypeSummary[];
  learningStats: LearningStats;
};

const formatPct = (value: number) => `${value.toFixed(1)}%`;

function OnePageReport({
  snapshot,
  interpretation,
  baselineDistributions,
  topCategories,
  sortedArchetypes,
  learningStats,
}: OnePageReportProps) {
  const { companyName, periodLabel, rpsBaseline } = snapshot;
  const { returnDistribution, pressureDistribution, stabilityDistribution } = baselineDistributions;

  const primaryArchetype = sortedArchetypes[0];
  const secondaryArchetype = sortedArchetypes[1];
  const archetypeRows = sortedArchetypes.slice(0, 4);

  const getArchetypeShare = (count: number) =>
    rpsBaseline.totalDecisions > 0 ? ((count / rpsBaseline.totalDecisions) * 100).toFixed(1) : "0.0";

  return (
    <div className="report-page space-y-6">
      <div className="report-print-page mx-auto max-w-6xl space-y-5 rounded-3xl border bg-background p-7 text-foreground shadow-sm print:max-w-none print:border-none print:bg-white print:shadow-none">
        <header className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">D-NAV Executive Readout</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {companyName} · Decision Orbit {periodLabel}
            </h1>
            <p className="text-sm text-muted-foreground">
              System-level RPS profile across {rpsBaseline.totalDecisions} logged decisions
            </p>
          </div>
          <div className="text-sm text-muted-foreground sm:text-right">
            <p className="font-medium text-foreground">R · P · S baseline · Learning · Terrain · Archetypes</p>
            <p>Executive decision intelligence view</p>
          </div>
        </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] print:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <div className="report-card rounded-2xl border bg-card/70 p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Executive Overview</p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {companyName} · Decision Orbit {periodLabel}
            </h2>
            <p className="text-sm text-muted-foreground">
              System-level RPS profile across {rpsBaseline.totalDecisions} logged decisions
            </p>
          </div>

          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">RPS Baseline — Calm, repeatable execution</h3>
              <p>{interpretation.rpsSummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Category Profile — Where judgment actually lives</h3>
              <p>{interpretation.categorySummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Archetype Profile — Behavioral fingerprint</h3>
              <p>{interpretation.archetypeSummary}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Learning &amp; Recovery — Decision debt &amp; correction</h3>
              <p>{interpretation.learningSummary}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="report-card rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Key Metrics Snapshot</p>
                <p className="text-xs text-muted-foreground">Period: {periodLabel}</p>
              </div>
              <span className="text-xs text-muted-foreground">R · P · S averages</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Average D-NAV</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgDnav.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Average judgment quality in this window after cost.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Avg Return (R)</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgReturn.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Net value creation per decision.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Avg Pressure (P)</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgPressure.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Execution stress posture.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Avg Stability (S)</p>
                <p className="text-lg font-semibold text-foreground">{rpsBaseline.avgStability.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">How safe decisions leave the system.</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Learning Curve Index</p>
                <p className="text-lg font-semibold text-foreground">{learningStats.lci.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Recovery efficiency after dips.</p>
              </div>
            </div>
          </div>

          <div className="report-card rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Distributions (Return / Pressure / Stability)
            </p>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Return</span>
                  <span>
                    Positive {formatPct(returnDistribution.positive)} · Neutral {formatPct(returnDistribution.neutral)} · Negative {formatPct(returnDistribution.negative)}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted/60">
                  <div className="bg-emerald-500" style={{ width: `${returnDistribution.positive}%` }} />
                  <div className="bg-muted" style={{ width: `${returnDistribution.neutral}%` }} />
                  <div className="bg-rose-500" style={{ width: `${returnDistribution.negative}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Pressure</span>
                  <span>
                    Pressured {formatPct(pressureDistribution.positive)} · Neutral {formatPct(pressureDistribution.neutral)} · Calm {formatPct(pressureDistribution.negative)}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted/60">
                  <div className="bg-amber-500" style={{ width: `${pressureDistribution.positive}%` }} />
                  <div className="bg-muted" style={{ width: `${pressureDistribution.neutral}%` }} />
                  <div className="bg-sky-500" style={{ width: `${pressureDistribution.negative}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Stability</span>
                  <span>
                    Stable {formatPct(stabilityDistribution.positive)} · Neutral {formatPct(stabilityDistribution.neutral)} · Fragile {formatPct(stabilityDistribution.negative)}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted/60">
                  <div className="bg-emerald-600" style={{ width: `${stabilityDistribution.positive}%` }} />
                  <div className="bg-muted" style={{ width: `${stabilityDistribution.neutral}%` }} />
                  <div className="bg-rose-500" style={{ width: `${stabilityDistribution.negative}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="report-card rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Decision Terrain — Top Judgment Arenas
            </p>
            <h3 className="text-lg font-semibold text-foreground">Where judgment volume concentrates</h3>
          </div>
          <span className="text-xs text-muted-foreground">Top 3 categories</span>
        </div>
        <div className="mt-4 space-y-4">
          {topCategories.map((category) => (
            <div key={category.name} className="rounded-xl border border-muted/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{category.name}</span>
                <span className="text-xs text-muted-foreground">{category.decisionCount} decisions</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Share of volume</p>
                  <p className="text-sm font-semibold text-foreground">{formatPct(category.share)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Avg D-NAV</p>
                  <p className="text-sm font-semibold text-foreground">{category.avgDnav.toFixed(1)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">R / P / S</p>
                  <p className="text-sm font-semibold text-foreground">
                    {category.avgR.toFixed(1)} / {category.avgP.toFixed(1)} / {category.avgS.toFixed(1)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase">Dominant factor</p>
                  <p className="text-sm font-semibold text-foreground">{category.dominantFactor ?? "Balanced"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="report-card rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Archetype Fingerprint — {periodLabel}
          </p>
          <p className="text-sm text-muted-foreground">
            Primary: {primaryArchetype?.archetype ?? "N/A"} · Secondary: {secondaryArchetype?.archetype ?? "N/A"}
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Archetype</th>
                <th className="px-3 py-2 text-right font-semibold">Decisions</th>
                <th className="px-3 py-2 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/60 bg-card">
              {archetypeRows.map((entry) => (
                <tr key={entry.archetype}>
                  <td className="px-3 py-2 font-medium text-foreground">{entry.archetype}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{entry.count}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{getArchetypeShare(entry.count)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div>Loading reports…</div>}>
      <ReportsPageContent />
    </Suspense>
  );
}
