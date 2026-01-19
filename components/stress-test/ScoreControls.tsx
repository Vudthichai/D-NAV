"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";

const scoreKeys = [
  { key: "impact", label: "Impact" },
  { key: "cost", label: "Cost" },
  { key: "risk", label: "Risk" },
  { key: "urgency", label: "Urgency" },
  { key: "confidence", label: "Confidence" },
] as const;

const clampScore = (value: number) => Math.min(10, Math.max(1, value));

type ScoreKey = (typeof scoreKeys)[number]["key"];

type ScoreMap = {
  [key in ScoreKey]?: number;
};

interface ScoreControlsProps {
  scores: ScoreMap;
  onChange: (key: ScoreKey, value: number | undefined) => void;
}

function ScoreStepper({
  value,
  onChange,
}: {
  value?: number;
  onChange: (next: number | undefined) => void;
}) {
  const numeric = typeof value === "number" ? value : 5;

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange(clampScore(numeric - 1))}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <Input
        type="number"
        min={1}
        max={10}
        value={numeric}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) ? clampScore(next) : undefined);
        }}
        className="h-7 w-12 px-1 text-center text-xs"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange(clampScore(numeric + 1))}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function ScoreControls({ scores, onChange }: ScoreControlsProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {scoreKeys.map(({ key, label }) => (
        <div
          key={key}
          className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <ScoreStepper value={scores[key]} onChange={(next) => onChange(key, next)} />
        </div>
      ))}
    </div>
  );
}
