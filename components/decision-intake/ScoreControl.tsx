"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

const clampScore = (value: number) => Math.min(10, Math.max(1, value));

interface ScoreControlProps {
  label: string;
  value?: number;
  onChange: (next: number) => void;
}

export function ScoreControl({ label, value, onChange }: ScoreControlProps) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 5;

  return (
    <div className="flex w-[120px] flex-shrink-0 flex-col gap-1 rounded-lg border border-border/60 bg-background px-2 py-2 shadow-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-5 w-5"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clampScore(numeric - 1))}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-8 text-center text-base font-semibold text-foreground tabular-nums">{numeric}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-5 w-5"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clampScore(numeric + 1))}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
