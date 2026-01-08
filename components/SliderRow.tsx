"use client";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SliderRowProps {
  id: string;
  label: ReactNode;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
  definitionHref?: string;
}

export default function SliderRow({
  id,
  label,
  hint,
  value,
  onChange,
  compact = false,
  definitionHref,
}: SliderRowProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 items-center gap-2 grid-cols-[5.5rem_minmax(0,1fr)_2.5rem] sm:grid-cols-[6.5rem_minmax(0,1fr)_2.5rem]",
        compact ? "py-1.5" : "py-3",
      )}
    >
      <label className="flex min-w-0 flex-col gap-1" title={compact ? hint : undefined}>
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold leading-tight text-foreground">{label}</span>
          {definitionHref ? (
            <a
              href={definitionHref}
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground underline-offset-4 hover:text-foreground"
            >
              ?
            </a>
          ) : null}
        </div>
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
