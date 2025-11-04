'use client';

import { Slider } from '@/components/ui/slider';
import { useHighlight } from '@/hooks/use-highlight';

interface SliderRowProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}

export default function SliderRow({ id, label, hint, value, onChange }: SliderRowProps) {
  const highlightRef = useHighlight(`${id}-slider`);
  
  return (
    <div ref={highlightRef} id={`${id}-slider`} className="grid grid-cols-[190px_1fr_52px] items-center gap-3">
      <label className="flex flex-col gap-1.5">
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
        className="w-full"
      />
      <output className="text-right inline-block min-w-[40px] font-extrabold text-base">
        {value}
      </output>
    </div>
  );
}
