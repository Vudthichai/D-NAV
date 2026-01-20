"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

const clampScore = (value: number) => Math.min(10, Math.max(1, value));

interface ScoreStepperProps {
  label: string;
  value?: number;
  onChange: (next: number) => void;
}

export function ScoreStepper({ label, value, onChange }: ScoreStepperProps) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 5;

  return (
    <div className="flex min-w-[90px] flex-col items-center gap-1 rounded-lg border border-border/50 bg-muted/20 px-2 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clampScore(numeric - 1))}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="min-w-[28px] text-center text-lg font-semibold text-foreground">{numeric}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clampScore(numeric + 1))}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
