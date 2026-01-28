"use client";

import { cn } from "@/lib/utils";
import type { DecisionCandidate, DecisionCategory } from "@/lib/intake/decisionExtractLocal";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const METRICS = [
  { key: "impact", label: "I", name: "Impact" },
  { key: "cost", label: "C", name: "Cost" },
  { key: "risk", label: "R", name: "Risk" },
  { key: "urgency", label: "U", name: "Urgency" },
  { key: "confidence", label: "CF", name: "Confidence" },
] as const;

const MIN_SCORE = 0;
const MAX_SCORE = 10;

type MetricKey = (typeof METRICS)[number]["key"];

interface KeyDecisionRowProps {
  candidate: DecisionCandidate;
  categoryOptions: DecisionCategory[];
  isAdded: boolean;
  onAdd: (candidate: DecisionCandidate) => void;
  onDismiss: (id: string) => void;
  onCategoryChange: (id: string, category: DecisionCategory) => void;
  onMetricChange: (id: string, key: MetricKey, value: number) => void;
  onStrengthChange: (id: string, strength: DecisionCandidate["strength"]) => void;
}

interface ScoreChipProps {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
}

function ScoreChip({ label, name, value, onChange }: ScoreChipProps) {
  const handleChange = (nextValue: number) => {
    onChange(Math.max(MIN_SCORE, Math.min(MAX_SCORE, nextValue)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-full border border-border/60 bg-muted/10 px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:border-border/80 hover:bg-foreground/5"
          aria-label={`${name} score ${value}`}
        >
          {label}:{value}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 rounded-xl border border-border/60 bg-background/95 p-3 text-xs shadow-lg">
        <div className="text-[11px] font-semibold text-foreground">{name}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-full border border-border/60 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            onClick={() => handleChange(value - 1)}
            disabled={value <= MIN_SCORE}
            aria-label={`Decrease ${name}`}
          >
            −
          </button>
          <span className="text-sm font-semibold text-foreground">{value}</span>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-full border border-border/60 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            onClick={() => handleChange(value + 1)}
            disabled={value >= MAX_SCORE}
            aria-label={`Increase ${name}`}
          >
            +
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">Range {MIN_SCORE}–{MAX_SCORE}</p>
      </PopoverContent>
    </Popover>
  );
}

export default function KeyDecisionRow({
  candidate,
  categoryOptions,
  isAdded,
  onAdd,
  onDismiss,
  onCategoryChange,
  onMetricChange,
  onStrengthChange,
}: KeyDecisionRowProps) {
  const pageLabel = candidate.evidence.page ? `P.${candidate.evidence.page}` : "P.n/a";

  return (
    <div className="rounded-xl border border-border/60 bg-white/70 px-4 py-4 text-xs text-muted-foreground shadow-sm dark:bg-white/10">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-base font-semibold leading-snug text-foreground">{candidate.decision}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/10 p-0.5">
                <button
                  type="button"
                  onClick={() => onStrengthChange(candidate.id, "committed")}
                  className={cn(
                    "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                    candidate.strength === "committed"
                      ? "border border-foreground bg-foreground text-background shadow-sm"
                      : "border border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={candidate.strength === "committed"}
                >
                  Committed
                </button>
                <button
                  type="button"
                  onClick={() => onStrengthChange(candidate.id, "indicative")}
                  className={cn(
                    "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                    candidate.strength === "indicative"
                      ? "border border-foreground bg-foreground text-background shadow-sm"
                      : "border border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={candidate.strength === "indicative"}
                >
                  Indicative
                </button>
              </div>
              <Select
                value={candidate.category}
                onValueChange={(value) => onCategoryChange(candidate.id, value as DecisionCategory)}
              >
                <SelectTrigger size="sm" className="h-7 rounded-full border-border/60 bg-background/70 px-3 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {categoryOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {pageLabel}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "rounded-full text-[10px] font-semibold uppercase tracking-wide",
                isAdded
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15"
                  : "border-border/60 bg-foreground/5 text-foreground hover:bg-foreground/10",
              )}
              onClick={() => onAdd(candidate)}
              disabled={isAdded}
            >
              {isAdded ? "Added ✓" : "Add to session"}
            </Button>
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
        <div className="flex flex-wrap items-center gap-2">
          {METRICS.map((metric) => (
            <ScoreChip
              key={metric.key}
              label={metric.label}
              name={metric.name}
              value={candidate.sliders[metric.key]}
              onChange={(value) => onMetricChange(candidate.id, metric.key, value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
