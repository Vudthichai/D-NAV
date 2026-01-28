"use client";

import { cn } from "@/lib/utils";
import type { DecisionCandidate, DecisionCategory } from "@/lib/intake/decisionExtractLocal";
import MetricStepper from "@/components/decision-intake/MetricStepper";

const METRICS = [
  { key: "impact", label: "I" },
  { key: "cost", label: "Co" },
  { key: "risk", label: "R" },
  { key: "urgency", label: "U" },
  { key: "confidence", label: "Cf" },
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
  const strengthLabel = candidate.strength === "hard" ? "Hard" : "Soft";

  return (
    <div className="rounded-xl border border-border/60 bg-white/70 px-4 py-3 text-xs text-muted-foreground shadow-sm dark:bg-white/10">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
            {candidate.decision}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                candidate.strength === "hard"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/60 bg-muted/20 text-muted-foreground",
              )}
            >
              {strengthLabel}
            </span>
            <select
              value={candidate.category}
              onChange={(event) => onCategoryChange(candidate.id, event.target.value as DecisionCategory)}
              className="h-7 rounded-full border border-border/60 bg-background/70 px-2 text-[10px] font-semibold text-foreground shadow-sm transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
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
                "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide",
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
              className="grid h-7 w-7 place-items-center rounded-full border border-border/60 bg-transparent text-[12px] font-semibold text-muted-foreground transition hover:border-border/80 hover:text-foreground"
              onClick={() => onDismiss(candidate.id)}
              aria-label="Dismiss decision"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
          {METRICS.map((metric) => (
            <MetricStepper
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
