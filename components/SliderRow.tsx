"use client";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface SliderRowProps {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}

export default function SliderRow({ id, label, hint, value, onChange, compact = false }: SliderRowProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 items-center gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]",
        compact ? "py-1" : "py-1.5",
      )}
    >
      <label className="flex min-w-0 flex-col gap-1" title={compact ? hint : undefined}>
        <span className="truncate text-sm font-semibold leading-tight text-foreground">{label}</span>
        {!compact && hint ? (
          <span className="text-[11px] font-medium leading-snug text-muted-foreground">{hint}</span>
        ) : null}
      </label>
      <Slider
        id={id}
        min={1}
        max={10}
        step={1}
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        className="w-full min-w-0"
      />
      <output className="inline-block min-w-[40px] text-right text-sm font-extrabold sm:justify-self-end">
        {value}
      </output>
    </div>
  );
}
