"use client";

import { Slider } from "@/components/ui/slider";

interface SliderRowProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}

export default function SliderRow({ id, label, hint, value, onChange }: SliderRowProps) {
  return (
    <div className="my-2.5 grid items-center gap-3 last:mb-2 sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)_auto]">
      <label className="flex flex-col gap-1 sm:min-w-0">
        <span className="text-base font-bold leading-tight text-foreground">{label}</span>
        <span className="text-xs font-semibold leading-tight text-muted-foreground">{hint}</span>
      </label>
      <Slider
        id={id}
        min={0}
        max={10}
        step={1}
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        className="w-full min-w-0"
      />
      <output className="inline-block min-w-[40px] text-right text-base font-extrabold sm:justify-self-end">{value}</output>
    </div>
  );
}
