"use client";

import { cn } from "@/lib/utils";
import type { DecisionCandidate } from "@/lib/intake/decisionExtractLocal";
import MetricStepperPill from "@/components/decision-intake/MetricStepperPill";

const METRICS = [
  { key: "impact", label: "Impact" },
  { key: "cost", label: "Cost" },
  { key: "risk", label: "Risk" },
  { key: "urgency", label: "Urgency" },
  { key: "confidence", label: "Confidence" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

interface DecisionRowCompactProps {
  candidate: DecisionCandidate;
  isAdded: boolean;
  onAdd: (candidate: DecisionCandidate) => void;
  onDismiss: (id: string) => void;
  onMetricChange: (id: string, key: MetricKey, value: number) => void;
}

export default function DecisionRowCompact({
  candidate,
  isAdded,
  onAdd,
  onDismiss,
  onMetricChange,
}: DecisionRowCompactProps) {
  const pageLabel = candidate.evidence.page ? `p.${candidate.evidence.page}` : "p.n/a";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-4 text-xs text-muted-foreground shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:border-neutral-700 dark:hover:bg-neutral-900/55">
      <div className="space-y-2">
        <div className="min-w-0 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Decision</span>
          <p className="line-clamp-2 text-sm sm:text-[15px] font-medium leading-relaxed text-neutral-900 dark:text-neutral-100">
            {candidate.decision}
          </p>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{pageLabel}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}
