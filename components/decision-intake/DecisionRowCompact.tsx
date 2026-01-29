"use client";

import { cn } from "@/lib/utils";
import type { DecisionCandidate, DecisionCategory } from "@/lib/intake/decisionExtractLocal";
import MetricStepperPill from "@/components/decision-intake/MetricStepperPill";

const METRICS = [
  { key: "impact", label: "I" },
  { key: "cost", label: "C" },
  { key: "risk", label: "R" },
  { key: "urgency", label: "U" },
  { key: "confidence", label: "CF" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

interface DecisionRowCompactProps {
  candidate: DecisionCandidate;
  categoryOptions: DecisionCategory[];
  isAdded: boolean;
  onAdd: (candidate: DecisionCandidate) => void;
  onDismiss: (id: string) => void;
  onCategoryChange: (id: string, category: DecisionCategory) => void;
  onMetricChange: (id: string, key: MetricKey, value: number) => void;
}

export default function DecisionRowCompact({
  candidate,
  categoryOptions,
  isAdded,
  onAdd,
  onDismiss,
  onCategoryChange,
  onMetricChange,
}: DecisionRowCompactProps) {
  const pageLabel = candidate.evidence.page ? `p.${candidate.evidence.page}` : "p.n/a";

  return (
    <div className="rounded-xl border border-border/60 bg-white/70 px-4 py-4 text-xs text-muted-foreground shadow-sm dark:bg-white/10">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Decision</span>
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {candidate.decision}
            </p>
          </div>
          <div className="flex w-[300px] shrink-0 items-center justify-end gap-2 whitespace-nowrap">
            <select
              value={candidate.category}
              onChange={(event) => onCategoryChange(candidate.id, event.target.value as DecisionCategory)}
              className="h-8 rounded-full border border-border/60 bg-background/70 px-2 text-[10px] font-semibold text-foreground shadow-sm transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="rounded-full border border-border/60 bg-muted/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {pageLabel}
            </span>
            <button
              type="button"
              className={cn(
                "rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide",
                isAdded
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  : "border-border/60 bg-foreground/5 text-foreground hover:bg-foreground/10",
              )}
              onClick={() => onAdd(candidate)}
              disabled={isAdded}
            >
              {isAdded ? "Added ✓" : "Add to Session"}
            </button>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-full border border-border/60 bg-transparent text-[14px] font-semibold text-muted-foreground transition hover:border-border/80 hover:text-foreground"
              onClick={() => onDismiss(candidate.id)}
              aria-label="Dismiss decision"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
          {METRICS.map((metric) => (
            <MetricStepperPill
              key={metric.key}
              label={metric.label}
              value={candidate.sliders[metric.key]}
              onChange={(value) => onMetricChange(candidate.id, metric.key, value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
