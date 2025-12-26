"use client";

import { useMemo } from "react";

import { useDataset } from "@/components/DatasetProvider";
import { computeMetrics } from "@/src/lib/dnav/compute";
import { compareDecisions } from "@/src/lib/dnav/compare";
import {
  type CompareResult,
  type Decision,
  type DecisionVars,
} from "@/src/lib/dnav/types";
import type { Selection } from "./useCompareParams";
import type { DecisionEntry } from "@/lib/calculations";

type UseCompareDecisionsResult = {
  decisionA: Decision | null;
  decisionB: Decision | null;
  result: CompareResult | null;
  loading: boolean;
  errors: string[];
};

const logDecisionLabel = (entry: DecisionEntry, fallback?: string): string =>
  fallback || entry.name || entry.title || "Logged decision";

const toDecision = (entry: DecisionEntry, label?: string): Decision => {
  const vars: DecisionVars = {
    impact: entry.impact,
    cost: entry.cost,
    risk: entry.risk,
    urgency: entry.urgency,
    confidence: entry.confidence,
  };

  return {
    id: entry.id ?? entry.ts?.toString(),
    label: logDecisionLabel(entry, label),
    source: "log",
    vars,
    metrics: computeMetrics(vars),
  };
};

const toManualDecision = (selection: Extract<Selection, { kind: "manual" }>): Decision => {
  const metrics = computeMetrics(selection.vars);
  return {
    label: selection.label ?? "Manual decision",
    source: "manual",
    vars: selection.vars,
    metrics,
  };
};

const resolveDecisionKey = (entry: DecisionEntry): string | null => entry.id ?? entry.ts?.toString() ?? null;

export function useCompareDecisions(params: { a: Selection; b: Selection }): UseCompareDecisionsResult {
  const { decisions, isDatasetLoading } = useDataset();

  const { decisionA, decisionB, errors, loading } = useMemo(() => {
    const lookup = new Map<string, DecisionEntry>();
    decisions.forEach((entry) => {
      const key = resolveDecisionKey(entry);
      if (key) lookup.set(key, entry);
    });

    const errs: string[] = [];

    const resolveLog = (selection: Extract<Selection, { kind: "log" }>): Decision | null => {
      const entry = lookup.get(selection.id);
      if (entry) return toDecision(entry, selection.label);
      if (!isDatasetLoading) errs.push(`Log entry ${selection.id} is not available yet.`);
      return null;
    };

    const resolve = (selection: Selection): Decision | null => {
      if (selection.kind === "manual") return toManualDecision(selection);
      return resolveLog(selection);
    };

    const resolvedA = resolve(params.a);
    const resolvedB = resolve(params.b);

    const requiresLog = params.a.kind === "log" || params.b.kind === "log";
    const isLoading = requiresLog && isDatasetLoading && (!resolvedA || !resolvedB);

    return { decisionA: resolvedA, decisionB: resolvedB, errors: errs, loading: isLoading };
  }, [decisions, isDatasetLoading, params.a, params.b]);

  const result = useMemo(() => {
    if (!decisionA || !decisionB) return null;
    return compareDecisions(decisionA, decisionB);
  }, [decisionA, decisionB]);

  return {
    decisionA,
    decisionB,
    result,
    loading,
    errors,
  };
}
