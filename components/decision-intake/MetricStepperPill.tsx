"use client";

import { cn } from "@/lib/utils";

interface MetricStepperPillProps {
  label: "I" | "Co" | "R" | "U" | "Cf";
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

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/10 px-3 py-2 text-xs text-foreground shadow-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={handleDecrease}
        disabled={!canDecrease}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full border text-[13px] font-semibold transition",
          canDecrease
            ? "border-border/60 bg-background/70 text-foreground hover:bg-foreground/10 active:scale-95"
            : "border-border/40 bg-muted/20 text-muted-foreground",
        )}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <span className="min-w-[24px] text-center text-[13px] font-semibold text-foreground">{value}</span>
      <button
        type="button"
        onClick={handleIncrease}
        disabled={!canIncrease}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full border text-[13px] font-semibold transition",
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
