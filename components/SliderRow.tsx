"use client";

import { Slider } from "@/components/ui/slider";

interface SliderRowProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function SliderRow({
  id,
  label,
  hint,
  value,
  onChange,
  disabled = false,
  className,
}: SliderRowProps) {
  return (
    <div
      className={`grid min-w-0 items-center gap-2 py-1 sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)_auto] ${className ?? ""}`}
    >
      <label className="flex flex-col gap-1 sm:min-w-0">
        <span className="text-sm font-semibold leading-tight text-foreground">{label}</span>
        <span className="text-[11px] font-medium leading-snug text-muted-foreground">{hint}</span>
      </label>
      <Slider
        id={id}
        min={1}
        max={10}
        step={1}
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        disabled={disabled}
        className="w-full min-w-0"
      />
      <output className="inline-block min-w-[40px] text-right text-sm font-extrabold sm:justify-self-end">
        {value}
      </output>
    </div>
  );
}
