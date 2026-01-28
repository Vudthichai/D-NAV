"use client";

import { cn } from "@/lib/utils";

interface MetricStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export default function MetricStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
}: MetricStepperProps) {
  const handleDecrease = () => {
    onChange(Math.max(min, value - 1));
  };

  const handleIncrease = () => {
    onChange(Math.min(max, value + 1));
  };

  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/10 px-2 py-1 text-[10px]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={handleDecrease}
        disabled={!canDecrease}
        className={cn(
          "grid h-5 w-5 place-items-center rounded-full border text-[10px] font-semibold transition",
          canDecrease
            ? "border-border/60 bg-background/70 text-foreground hover:bg-foreground/10"
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
          "grid h-5 w-5 place-items-center rounded-full border text-[10px] font-semibold transition",
          canIncrease
            ? "border-border/60 bg-background/70 text-foreground hover:bg-foreground/10"
            : "border-border/40 bg-muted/20 text-muted-foreground",
        )}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}
