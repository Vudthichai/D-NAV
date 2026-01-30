"use client";

import { cn } from "@/lib/utils";

interface MetricStepperPillProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export default function MetricStepperPill({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
}: MetricStepperPillProps) {
  const clampValue = (nextValue: number) => Math.max(min, Math.min(max, nextValue));

  const handleDecrease = () => {
    onChange(clampValue(value - 1));
  };

  const handleIncrease = () => {
    onChange(clampValue(value + 1));
  };

  const canDecrease = value > min;
  const canIncrease = value < max;
  const intensity =
    value >= 8
      ? "border-foreground/30 bg-foreground/10"
      : value >= 5
        ? "border-border/70 bg-muted/10"
        : "border-border/60 bg-muted/5";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] text-foreground dark:border-white/20 dark:ring-1 dark:ring-white/20",
        intensity,
      )}
    >
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={handleDecrease}
        disabled={!canDecrease}
        className={cn(
          "grid h-6 w-6 place-items-center rounded-full border text-[12px] font-semibold transition dark:border-white/20 dark:ring-1 dark:ring-white/20",
          canDecrease
            ? "border-border/60 bg-background/70 text-foreground hover:bg-foreground/10 active:scale-95"
            : "border-border/40 bg-muted/20 text-muted-foreground",
        )}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <span className="min-w-[18px] text-center text-[11px] font-semibold text-foreground">{value}</span>
      <button
        type="button"
        onClick={handleIncrease}
        disabled={!canIncrease}
        className={cn(
          "grid h-6 w-6 place-items-center rounded-full border text-[12px] font-semibold transition dark:border-white/20 dark:ring-1 dark:ring-white/20",
          canIncrease
            ? "border-border/60 bg-background/70 text-foreground hover:bg-foreground/10 active:scale-95"
            : "border-border/40 bg-muted/20 text-muted-foreground",
        )}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}
