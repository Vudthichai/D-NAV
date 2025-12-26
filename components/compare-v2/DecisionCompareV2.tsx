"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import SliderRow from "@/components/SliderRow";
import { useDataset } from "@/components/DatasetProvider";
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
import { serializeVars } from "@/src/lib/dnav/serialize";
import {
  DECISION_VAR_KEYS,
  DEFAULT_DECISION_VARS,
  type CompareDelta,
  type Decision,
  type DecisionVars,
  type DriverDelta,
  type NudgeSuggestion,
} from "@/src/lib/dnav/types";
import { useCompareDecisions } from "@/src/hooks/useCompareDecisions";
import { type Selection, useCompareParams } from "@/src/hooks/useCompareParams";
import { cn } from "@/lib/utils";
import type { DecisionEntry } from "@/lib/calculations";

type Side = "a" | "b";

const METRIC_LABELS: Record<string, string> = {
  dnav: "D-NAV",
  return: "Return",
  pressure: "Pressure",
  stability: "Stability",
  energy: "Energy",
  merit: "Merit",
};

const SLIDER_META: Record<keyof DecisionVars, { label: string; hint: string }> = {
  impact: { label: "Impact", hint: "Expected upside or payoff" },
  cost: { label: "Cost", hint: "Effort, time, or spend required" },
  risk: { label: "Risk", hint: "Execution and downside risk" },
  urgency: { label: "Urgency", hint: "How quickly you need outcomes" },
  confidence: { label: "Confidence", hint: "Evidence and conviction level" },
};

const formatNumber = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));
const formatDelta = (value: number) => (value > 0 ? `+${formatNumber(value)}` : formatNumber(value));

const resolveDecisionId = (entry: DecisionEntry): string | null => entry.id ?? entry.ts?.toString() ?? null;

function selectionToQuery(side: Side, selection: Selection): Record<string, string | undefined> {
  if (selection.kind === "log") {
    return {
      [side]: `log:${selection.id}`,
      [`${side}Label`]: selection.label,
    };
  }

  return {
    [side]: `manual:${serializeVars(selection.vars)}`,
    [`${side}Label`]: selection.label,
  };
}

function ManualEditor({
  side,
  selection,
  onChange,
}: {
  side: Side;
  selection: Extract<Selection, { kind: "manual" }>;
  onChange: (selection: Selection) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Manual entry</p>
          <p className="text-xs text-muted-foreground">Adjust sliders to update the URL for side {side.toUpperCase()}.</p>
        </div>
        <Input
          value={selection.label ?? ""}
          placeholder={`Label for decision ${side.toUpperCase()}`}
          onChange={(event) =>
            onChange({
              ...selection,
              label: event.target.value || undefined,
            })
          }
          className="sm:max-w-xs"
        />
      </div>

      <div className="space-y-3">
        {DECISION_VAR_KEYS.map((key) => (
          <SliderRow
            key={`${side}-${key}`}
            id={`${side}-${key}`}
            label={SLIDER_META[key].label}
            hint={SLIDER_META[key].hint}
            value={selection.vars[key]}
            onChange={(value) =>
              onChange({
                ...selection,
                vars: { ...selection.vars, [key]: value },
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function MetricsGrid({ decision }: { decision: Decision | null }) {
  const metrics = decision?.metrics;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {(["dnav", "return", "pressure", "stability"] as Array<keyof Decision["metrics"]>).map((metric) => (
        <div key={metric} className="rounded-lg border border-border/60 bg-background/80 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{METRIC_LABELS[metric]}</p>
          <p className="text-lg font-semibold text-foreground">{metrics ? formatNumber(metrics[metric]) : "—"}</p>
        </div>
      ))}
    </div>
  );
}

function DeltaRow({ deltas }: { deltas: CompareDelta[] }) {
  const primaryDeltas = deltas.filter((delta) =>
    ["dnav", "return", "pressure", "stability"].includes(delta.metric),
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {primaryDeltas.map((delta) => (
        <div key={delta.metric} className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{METRIC_LABELS[delta.metric]}</p>
          <p className={cn("text-lg font-semibold", delta.delta > 0 ? "text-emerald-600" : delta.delta < 0 ? "text-red-600" : "text-foreground")}>
            {formatDelta(delta.delta)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatNumber(delta.from)} → {formatNumber(delta.to)}
          </p>
        </div>
      ))}
    </div>
  );
}

function DriversList({ drivers }: { drivers: DriverDelta[] }) {
  if (!drivers.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Drivers</h3>
        <Badge variant="outline" className="text-xs">
          Top {drivers.length}
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {drivers.map((driver) => (
          <div key={driver.key} className="rounded-lg border border-border/60 bg-background/90 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{SLIDER_META[driver.key].label}</p>
            <p className={cn("text-lg font-semibold", driver.delta > 0 ? "text-emerald-600" : driver.delta < 0 ? "text-red-600" : "text-foreground")}>
              {formatDelta(driver.delta)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(driver.from)} → {formatNumber(driver.to)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NudgeCard({ nudge }: { nudge: NudgeSuggestion }) {
  return (
    <div className="rounded-lg border border-border/60 bg-emerald-50/70 p-4 text-sm text-emerald-900 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Smallest nudge</p>
      <p className="mt-1">
        Adjust <strong>{SLIDER_META[nudge.key].label}</strong> {nudge.direction > 0 ? "up" : "down"} to {nudge.proposed} for a{" "}
        <strong>ΔD-NAV of {formatNumber(nudge.dnavGain)}</strong> (to {formatNumber(nudge.nextDnav)}).
      </p>
    </div>
  );
}

function SelectionPanel({
  side,
  selection,
  decision,
  decisions,
  onSelectionChange,
  isLoading,
}: {
  side: Side;
  selection: Selection;
  decision: Decision | null;
  decisions: DecisionEntry[];
  onSelectionChange: (selection: Selection) => void;
  isLoading: boolean;
}) {
  const options = useMemo(() => {
    return (
      decisions
        .map((entry) => {
          const id = resolveDecisionId(entry);
          if (!id) return null;
          const timestamp = entry.ts ?? 0;
          const date = entry.ts ? new Date(entry.ts).toLocaleDateString() : "Unknown date";
          return {
            id,
            label: entry.name || entry.title || "Logged decision",
            subtitle: `${date} • D-NAV ${entry.dnav ?? entry.return ?? ""}`,
            timestamp,
            vars: {
              impact: entry.impact,
              cost: entry.cost,
              risk: entry.risk,
              urgency: entry.urgency,
              confidence: entry.confidence,
            } satisfies DecisionVars,
          };
        })
        .filter(Boolean) as Array<{ id: string; label: string; subtitle: string; timestamp: number; vars: DecisionVars }>
    ).sort((a, b) => b.timestamp - a.timestamp);
  }, [decisions]);

  const currentLabel = selection.kind === "log" ? selection.label ?? decision?.label ?? "Log entry" : selection.label ?? "Manual decision";

  const handleUseManual = (baseVars: DecisionVars) => {
    onSelectionChange({
      kind: "manual",
      vars: baseVars,
      label: selection.kind === "manual" ? selection.label : currentLabel,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold text-foreground">
            Decision {side.toUpperCase()}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={selection.kind === "log" ? "outline" : "default"} className="text-xs">
              {selection.kind === "log" ? "Log" : "Manual"}
            </Badge>
            <span className="text-sm text-foreground">{currentLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleUseManual(selection.kind === "manual" ? selection.vars : decision?.vars ?? DEFAULT_DECISION_VARS)}>
            Edit manual
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pick from log</p>
            <p className="text-xs text-muted-foreground">Select a saved decision to populate side {side.toUpperCase()}.</p>
          </div>
          <Select
            onValueChange={(value) => {
              const match = options.find((option) => option.id === value);
              if (match) {
                onSelectionChange({ kind: "log", id: match.id, label: match.label });
              }
            }}
            value={selection.kind === "log" ? selection.id : undefined}
            disabled={isLoading}
          >
            <SelectTrigger className="md:w-[260px]">
              <SelectValue placeholder={isLoading ? "Loading log..." : "Choose decision"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.subtitle}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selection.kind === "manual" && (
          <ManualEditor
            side={side}
            selection={selection}
            onChange={(updated) => onSelectionChange(updated)}
          />
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Metrics</p>
          <MetricsGrid decision={decision} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DecisionCompareV2() {
  const { decisions, isDatasetLoading } = useDataset();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useCompareParams();
  const { decisionA, decisionB, result, loading, errors } = useCompareDecisions(params);

  const updateSelection = (side: Side, selection: Selection) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    const mapped = selectionToQuery(side, selection);

    Object.entries(mapped).forEach(([key, value]) => {
      if (value === undefined) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });

    const url = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(url);
  };

  const deltas = result?.deltas ?? [];
  const drivers = result?.drivers ?? [];
  const nudge = result?.smallestNudge;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compare</p>
        <h1 className="text-2xl font-semibold text-foreground">Decision A vs Decision B</h1>
        <p className="text-sm text-muted-foreground">
          Use URL parameters (a, b) to pick log entries or manual inputs. Updates are shareable and deterministic.
        </p>
      </div>

      {(loading || isDatasetLoading) && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">Loading log entries…</CardContent>
        </Card>
      )}

      {errors.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            {errors.map((error) => (
              <p key={error} className="text-sm text-destructive">
                {error}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <SelectionPanel
          side="a"
          selection={params.a}
          decision={decisionA}
          decisions={decisions}
          isLoading={loading || isDatasetLoading}
          onSelectionChange={(selection) => updateSelection("a", selection)}
        />
        <SelectionPanel
          side="b"
          selection={params.b}
          decision={decisionB}
          decisions={decisions}
          isLoading={loading || isDatasetLoading}
          onSelectionChange={(selection) => updateSelection("b", selection)}
        />
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Deltas</CardTitle>
        </CardHeader>
        <CardContent>{deltas.length ? <DeltaRow deltas={deltas} /> : <p className="text-sm text-muted-foreground">Select two decisions to compare.</p>}</CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Drivers &amp; nudges</CardTitle>
          {nudge && <Badge variant="outline">Suggestion</Badge>}
        </CardHeader>
        <CardContent className="space-y-4">
          {drivers.length ? <DriversList drivers={drivers} /> : <p className="text-sm text-muted-foreground">No drivers yet.</p>}
          {nudge && <NudgeCard nudge={nudge} />}
        </CardContent>
      </Card>
    </div>
  );
}
