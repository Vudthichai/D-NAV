"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import SliderRow from "@/components/SliderRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { computeMetrics as legacyComputeMetrics, type DecisionEntry, type DecisionVariables } from "@/lib/calculations";
import { buildDecision, clampVariable } from "@/src/lib/dnav/compute";
import { compareDecisions, cloneDecision } from "@/src/lib/dnav/compare";
import { type CompareResult, type Decision, type DecisionVars } from "@/src/lib/dnav/types";

const STORAGE_KEY = "dnav_compare_state_v2";
const VAR_KEYS: (keyof DecisionVars)[] = ["impact", "cost", "risk", "urgency", "confidence"];

interface DecisionCompareSectionProps {
  currentLabel: string;
  currentCategory?: string;
  currentVariables: DecisionVariables;
  decisions: DecisionEntry[];
  onClose?: () => void;
}

type BaselineSelection =
  | { mode: "current" }
  | { mode: "log"; id: string }
  | { mode: "manual"; id: string; label: string; vars: DecisionVars };

type StoredCandidate = {
  id: string;
  label: string;
  vars: DecisionVars;
  source: Decision["source"];
  originId?: string;
};

type CandidateState = {
  decision: Decision;
  originId?: string;
};

function decisionFromEntry(entry: DecisionEntry, label?: string, idPrefix?: string): CandidateState {
  const baseId = entry.id ? String(entry.id) : String(entry.ts);
  const decision = buildDecision({
    id: idPrefix ? `${idPrefix}-${baseId}` : baseId,
    label: label || entry.name || "Logged decision",
    vars: {
      impact: clampVariable(entry.impact),
      cost: clampVariable(entry.cost),
      risk: clampVariable(entry.risk),
      urgency: clampVariable(entry.urgency),
      confidence: clampVariable(entry.confidence),
    },
    category: entry.category,
    timestamp: entry.ts,
    source: "log",
  });

  return { decision, originId: baseId };
}

function serializeVars(vars: DecisionVars): string {
  return VAR_KEYS.map((key) => vars[key]).join(",");
}

function deserializeVars(value: string | null): DecisionVars | null {
  if (!value) return null;
  const parts = value.split(",").map((part) => clampVariable(Number(part)));
  if (parts.length !== VAR_KEYS.length || parts.some((part) => Number.isNaN(part))) return null;
  return {
    impact: parts[0],
    cost: parts[1],
    risk: parts[2],
    urgency: parts[3],
    confidence: parts[4],
  } satisfies DecisionVars;
}

function formatDecisionOption(entry: DecisionEntry): string {
  const date = new Date(entry.ts);
  return `${entry.name || "Logged decision"} • D-NAV ${entry.dnav ?? legacyComputeMetrics(entry).dnav} • ${date.toLocaleDateString()}`;
}

function buildMetricsRow(label: string, baseline: number, candidate: number) {
  const delta = candidate - baseline;
  const sign = delta === 0 ? "" : delta > 0 ? "+" : "";
  return { label, baseline, candidate, deltaLabel: `${sign}${Number.isInteger(delta) ? delta : delta.toFixed(2)}` };
}

export default function DecisionCompareSection({
  currentLabel,
  currentCategory,
  currentVariables,
  decisions,
  onClose,
}: DecisionCompareSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const initialized = useRef(false);
  const idCounter = useRef(1);

  const [baselineSelection, setBaselineSelection] = useState<BaselineSelection>({ mode: "current" });
  const [candidates, setCandidates] = useState<CandidateState[]>([]);

  const sortedDecisions = useMemo(
    () => [...decisions].sort((a, b) => (b.ts || 0) - (a.ts || 0)),
    [decisions],
  );

  const currentDecision = useMemo(
    () =>
      buildDecision({
        id: "current",
        label: currentLabel || "Current decision",
        vars: currentVariables,
        category: currentCategory,
        source: "baseline",
      }),
    [currentCategory, currentLabel, currentVariables],
  );

  const baselineDecision = useMemo(() => {
    if (baselineSelection.mode === "log") {
      const entry = sortedDecisions.find((decision) => String(decision.id ?? decision.ts) === baselineSelection.id);
      if (entry) return decisionFromEntry(entry, entry.name || "Baseline", "baseline").decision;
    }

    if (baselineSelection.mode === "manual") {
      return buildDecision({
        id: baselineSelection.id,
        label: baselineSelection.label,
        vars: baselineSelection.vars,
        source: "baseline",
      });
    }

    return currentDecision;
  }, [baselineSelection, currentDecision, sortedDecisions]);

  const bumpCounterFromCandidates = (list: CandidateState[]) => {
    const highest = list.reduce((max, candidate) => {
      const match = candidate.decision.id.match(/candidate-(\d+)/);
      if (match) return Math.max(max, Number.parseInt(match[1], 10) + 1);
      return max;
    }, idCounter.current);
    idCounter.current = Math.max(idCounter.current, highest);
  };

  useEffect(() => {
    if (initialized.current) return;

    const fromUrlBaselineId = searchParams.get("baselineId");
    const fromUrlCandidateId = searchParams.get("candidateId");
    const baselineVarsParam = searchParams.get("baselineVars");
    const candidateVarsParam = searchParams.get("candidateVars");

    const urlBaselineVars = deserializeVars(baselineVarsParam);
    const urlCandidateVars = deserializeVars(candidateVarsParam);

    if (fromUrlBaselineId) {
      setBaselineSelection({ mode: "log", id: fromUrlBaselineId });
    } else if (urlBaselineVars) {
      setBaselineSelection({ mode: "manual", id: "shared-baseline", label: "Shared baseline", vars: urlBaselineVars });
    }

    const candidatesFromUrl: CandidateState[] = [];
    if (fromUrlCandidateId) {
      const entry = sortedDecisions.find((decision) => String(decision.id ?? decision.ts) === fromUrlCandidateId);
      if (entry) candidatesFromUrl.push(decisionFromEntry(entry, entry.name || "Candidate", "candidate"));
    } else if (urlCandidateVars) {
      const decision = buildDecision({
        id: "shared-candidate",
        label: "Shared candidate",
        vars: urlCandidateVars,
        source: "manual",
      });
      candidatesFromUrl.push({ decision });
    }

    if (candidatesFromUrl.length) {
      setCandidates(candidatesFromUrl);
      bumpCounterFromCandidates(candidatesFromUrl);
      initialized.current = true;
      return;
    }

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { baseline?: BaselineSelection; candidates?: StoredCandidate[] };
          if (parsed.baseline) setBaselineSelection(parsed.baseline);
          if (parsed.candidates?.length) {
            const hydrated = parsed.candidates.map((candidate) => {
              const decision = buildDecision({
                id: candidate.id,
                label: candidate.label,
                vars: candidate.vars,
                source: candidate.source,
              });
              return { decision, originId: candidate.originId } satisfies CandidateState;
            });
            setCandidates(hydrated);
            bumpCounterFromCandidates(hydrated);
            initialized.current = true;
            return;
          }
        }
      } catch (error) {
        console.error("Failed to load compare state", error);
      }
    }

    setCandidates([{ decision: cloneDecision(currentDecision, { id: "candidate-1", label: "Candidate 1", source: "manual" }) }]);
    idCounter.current = Math.max(idCounter.current, 2);
    initialized.current = true;
  }, [currentDecision, searchParams, sortedDecisions]);

  useEffect(() => {
    if (!initialized.current) return;
    if (typeof window === "undefined") return;

    const payload: { baseline: BaselineSelection; candidates: StoredCandidate[] } = {
      baseline: baselineSelection,
      candidates: candidates.map((candidate) => ({
        id: candidate.decision.id,
        label: candidate.decision.label,
        vars: candidate.decision.vars,
        source: candidate.decision.source,
        originId: candidate.originId,
      })),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist compare state", error);
    }
  }, [baselineSelection, candidates]);

  useEffect(() => {
    if (!initialized.current) return;
    const params = new URLSearchParams(searchParams.toString());

    if (baselineSelection.mode === "log") {
      params.set("baselineId", baselineSelection.id);
      params.delete("baselineVars");
    } else if (baselineSelection.mode === "manual") {
      params.set("baselineVars", serializeVars(baselineSelection.vars));
      params.delete("baselineId");
    } else {
      params.delete("baselineId");
      params.delete("baselineVars");
    }

    const primaryCandidate = candidates[0];
    if (primaryCandidate) {
      if (primaryCandidate.originId && primaryCandidate.decision.source === "log") {
        params.set("candidateId", primaryCandidate.originId);
        params.delete("candidateVars");
      } else {
        params.set("candidateVars", serializeVars(primaryCandidate.decision.vars));
        params.delete("candidateId");
      }
    } else {
      params.delete("candidateId");
      params.delete("candidateVars");
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [baselineSelection, candidates, pathname, router, searchParams]);

  const addCandidate = (seed?: CandidateState) => {
    const nextId = `candidate-${idCounter.current++}`;
    if (seed) {
      setCandidates((prev) => [...prev, { decision: cloneDecision(seed.decision, { id: nextId }), originId: seed.originId }]);
      return;
    }
    setCandidates((prev) => [
      ...prev,
      { decision: cloneDecision(currentDecision, { id: nextId, label: `Candidate ${prev.length + 1}` }) },
    ]);
  };

  const removeCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((candidate) => candidate.decision.id !== id));
  };

  const updateCandidateLabel = (id: string, label: string) => {
    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.decision.id === id
          ? { ...candidate, decision: { ...candidate.decision, label: label.trim() || "Candidate" } }
          : candidate,
      ),
    );
  };

  const updateCandidateVars = (id: string, key: keyof DecisionVars, value: number) => {
    setCandidates((prev) =>
      prev.map((candidate) => {
        if (candidate.decision.id !== id) return candidate;
        const updated = buildDecision({
          id: candidate.decision.id,
          label: candidate.decision.label,
          vars: { ...candidate.decision.vars, [key]: clampVariable(value) },
          category: candidate.decision.category,
          timestamp: candidate.decision.timestamp,
          source: candidate.decision.source,
        });
        return { ...candidate, decision: updated, originId: candidate.originId };
      }),
    );
  };

  const handleLoadBaseline = (value: string) => {
    if (value === "manual") return;
    if (value === "current") {
      setBaselineSelection({ mode: "current" });
      return;
    }
    setBaselineSelection({ mode: "log", id: value });
  };

  const handleLoadCandidateFromLog = (candidateId: string, value: string) => {
    const entry = sortedDecisions.find((decision) => String(decision.id ?? decision.ts) === value);
    if (!entry) return;
    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.decision.id === candidateId
          ? (() => {
              const hydrated = decisionFromEntry(entry, entry.name || candidate.decision.label, "candidate");
              return { decision: { ...hydrated.decision, id: candidateId }, originId: hydrated.originId };
            })()
          : candidate,
      ),
    );
  };

  const compareResults: Array<{ candidate: CandidateState; result: CompareResult }> = useMemo(
    () =>
      candidates.map((candidate) => ({ candidate, result: compareDecisions(baselineDecision, candidate.decision) })),
    [baselineDecision, candidates],
  );

  return (
    <section className="space-y-4" id="decision-compare">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision vs Decision</p>
          <h2 className="text-xl font-bold">Compare baseline against alternatives</h2>
          <p className="text-sm text-muted-foreground">
            Deterministic, side-by-side comparisons powered by the D-NAV engine. Baseline and candidates stay in sync with your saved log or current calculator values.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="hidden sm:inline-flex">
              Close
            </Button>
          )}
          <Button variant="outline" onClick={() => addCandidate()} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add candidate
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Baseline</CardTitle>
            <Select
              value={
                baselineSelection.mode === "log"
                  ? baselineSelection.id
                  : baselineSelection.mode === "manual"
                    ? "manual"
                    : "current"
              }
              onValueChange={handleLoadBaseline}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Choose baseline" />
              </SelectTrigger>
              <SelectContent>
                {baselineSelection.mode === "manual" && (
                  <SelectItem value="manual" disabled>
                    {baselineSelection.label}
                  </SelectItem>
                )}
                <SelectItem value="current">Current decision</SelectItem>
                {sortedDecisions.map((decision) => (
                  <SelectItem key={decision.ts} value={String(decision.id ?? decision.ts)}>
                    {formatDecisionOption(decision)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            {VAR_KEYS.map((key) => (
              <div key={key} className="rounded-md border px-3 py-2">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">{capitalize(key)}</p>
                <p className="font-semibold text-foreground">{baselineDecision.vars[key]}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              { label: "Return", value: baselineDecision.metrics.return },
              { label: "Pressure", value: baselineDecision.metrics.pressure },
              { label: "Stability", value: baselineDecision.metrics.stability },
              { label: "D-NAV", value: baselineDecision.metrics.dnav },
            ].map((metric) => (
              <div key={metric.label} className="rounded-md border px-3 py-2">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">{metric.label}</p>
                <p className="font-semibold text-foreground">{metric.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {compareResults.map(({ candidate, result }) => (
          <Card key={candidate.decision.id} className="border-primary/30">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  value={candidate.decision.label}
                  onChange={(event) => updateCandidateLabel(candidate.decision.id, event.target.value)}
                  className="max-w-[280px]"
                  placeholder="Candidate label"
                />
                <Badge variant="outline">Δ D-NAV {formatSigned(result.delta.dnav)}</Badge>
                <div className="flex-1" />
                <Select onValueChange={(value) => handleLoadCandidateFromLog(candidate.decision.id, value)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Load from log" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedDecisions.map((decision) => (
                      <SelectItem key={decision.ts} value={String(decision.id ?? decision.ts)}>
                        {formatDecisionOption(decision)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeCandidate(candidate.decision.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Metrics</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {[
                      buildMetricsRow("Return", baselineDecision.metrics.return, result.candidate.metrics.return),
                      buildMetricsRow("Pressure", baselineDecision.metrics.pressure, result.candidate.metrics.pressure),
                      buildMetricsRow("Stability", baselineDecision.metrics.stability, result.candidate.metrics.stability),
                      buildMetricsRow("D-NAV", baselineDecision.metrics.dnav, result.candidate.metrics.dnav),
                    ].map((row) => (
                      <div key={row.label} className="rounded-md border px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">{row.label}</p>
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span>{row.candidate}</span>
                          <span className={row.deltaLabel.startsWith("-") ? "text-destructive" : row.deltaLabel.startsWith("+") ? "text-emerald-600" : "text-muted-foreground"}>
                            {row.deltaLabel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Drivers</p>
                  {result.drivers.top.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No variable shifts are affecting D-NAV.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {result.drivers.top.map((driver) => (
                        <li key={driver.key} className="flex items-start gap-2">
                          <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {driver.key.charAt(0).toUpperCase()}
                          </span>
                          <span className="leading-snug text-foreground">{driver.note}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border px-3 py-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Variables (A vs B)</p>
                  <div className="mt-2 grid gap-2 text-sm">
                    {VAR_KEYS.map((key) => {
                      const baseValue = baselineDecision.vars[key];
                      const candidateValue = result.candidate.vars[key];
                      const delta = candidateValue - baseValue;
                      return (
                        <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-[11px] uppercase text-muted-foreground">{capitalize(key)}</span>
                            <span className="font-semibold text-foreground">{candidateValue}</span>
                          </div>
                          <div className="text-right text-xs font-semibold">
                            <span className="text-muted-foreground">Baseline {baseValue}</span>
                            <div className={delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-emerald-600" : "text-destructive"}>
                              {formatSigned(delta)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-lg border px-3 py-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Smallest nudges</p>
                  {result.sensitivity.suggestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No single-step improvement found.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {result.sensitivity.suggestions.map((suggestion) => (
                        <li key={`${suggestion.target}-${suggestion.recommendedChange.key}-${suggestion.direction}`} className="rounded-md border px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold capitalize">{suggestion.target}</span>
                            <Badge variant="secondary">{suggestion.direction === "increase" ? "+" : "-"}{suggestion.by}</Badge>
                          </div>
                          <p className="text-[13px] leading-snug text-muted-foreground">
                            Change {capitalize(suggestion.recommendedChange.key)} from {suggestion.recommendedChange.from} to {suggestion.recommendedChange.to} — {suggestion.rationale}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Adjust candidate variables</p>
                <div className="space-y-3">
                  <SliderRow
                    id={`${candidate.decision.id}-impact`}
                    label="Impact"
                    hint="Expected benefit / upside"
                    value={candidate.decision.vars.impact}
                    onChange={(value) => updateCandidateVars(candidate.decision.id, "impact", value)}
                  />
                  <SliderRow
                    id={`${candidate.decision.id}-cost`}
                    label="Cost"
                    hint="Money, time, or effort required"
                    value={candidate.decision.vars.cost}
                    onChange={(value) => updateCandidateVars(candidate.decision.id, "cost", value)}
                  />
                  <SliderRow
                    id={`${candidate.decision.id}-risk`}
                    label="Risk"
                    hint="Downside, what could go wrong"
                    value={candidate.decision.vars.risk}
                    onChange={(value) => updateCandidateVars(candidate.decision.id, "risk", value)}
                  />
                  <SliderRow
                    id={`${candidate.decision.id}-urgency`}
                    label="Urgency"
                    hint="How soon action is needed"
                    value={candidate.decision.vars.urgency}
                    onChange={(value) => updateCandidateVars(candidate.decision.id, "urgency", value)}
                  />
                  <SliderRow
                    id={`${candidate.decision.id}-confidence`}
                    label="Confidence"
                    hint="Evidence, readiness, and conviction"
                    value={candidate.decision.vars.confidence}
                    onChange={(value) => updateCandidateVars(candidate.decision.id, "confidence", value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSigned(value: number): string {
  if (value === 0) return "0";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Number.isInteger(value) ? value : value.toFixed(2)}`;
}
