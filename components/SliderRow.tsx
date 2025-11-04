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
    <div className="grid grid-cols-[190px_1fr_52px] gap-3 items-center my-2.5 last:mb-2">
      <label className="flex flex-col gap-1">
        <span className="font-bold text-foreground text-base leading-tight">{label}</span>
        <span className="font-semibold text-muted-foreground text-xs leading-tight">{hint}</span>
      </label>
      <Slider
        id={id}
        min={0}
        max={10}
        step={1}
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        className="w-full"
      />
      <output className="text-right inline-block min-w-[40px] font-extrabold text-base">{value}</output>
    </div>
  );
}
