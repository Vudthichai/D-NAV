import React from "react";

type VarianceSummaryProps = {
  systems: {
    label: string;
    std: { R: number; P: number; S: number };
    mean: { R: number; P: number; S: number };
  }[];
};

export function VarianceSummary({ systems }: VarianceSummaryProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {systems.map((system) => (
        <div key={system.label} className="rounded-xl border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{system.label}</p>
            <p className="text-[11px] text-muted-foreground">Mean → σ</p>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <Stat label="Return" mean={system.mean.R} std={system.std.R} />
            <Stat label="Pressure" mean={system.mean.P} std={system.std.P} />
            <Stat label="Stability" mean={system.mean.S} std={system.std.S} />
          </dl>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, mean, std }: { label: string; mean: number; std: number }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{format(mean)}</p>
      <p className="text-[11px] text-muted-foreground">σ {format(std)}</p>
    </div>
  );
}

function format(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
