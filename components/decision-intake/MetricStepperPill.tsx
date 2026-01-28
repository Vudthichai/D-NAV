"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MetricStepperPillProps {
  label: string;
  tooltip?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  scaleLabel?: string;
}

export default function MetricStepperPill({
  label,
  tooltip,
  value,
  onChange,
  min = 1,
  max = 10,
  scaleLabel = "1–10",
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
        "flex items-center gap-2 rounded-full border px-3 py-2 text-xs text-foreground shadow-sm",
        intensity,
      )}
    >
      <div className="flex flex-col">
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[180px] text-[11px]">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        )}
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          {scaleLabel}
        </span>
      </div>
      <button
        type="button"
        onClick={handleDecrease}
        disabled={!canDecrease}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full border text-[13px] font-semibold transition",
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
          "grid h-8 w-8 place-items-center rounded-full border text-[13px] font-semibold transition",
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
