"use client";

import { cn } from "@/lib/utils";

interface DecisionLegendProps {
  className?: string;
}

export default function DecisionLegend({ className }: DecisionLegendProps) {
  return (
    <details className={cn("group text-[11px] text-muted-foreground", className)}>
      <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-wide text-foreground/70 transition hover:text-foreground">
        What do these mean?
      </summary>
      <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Committed</p>
          <p>Explicit commitment, scheduled action, or completed action.</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Indicative</p>
          <p>Directional signal, expectation, or guidance (not guaranteed).</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Variables</p>
          <p>I = Impact · C = Cost · R = Risk · U = Urgency · CF = Confidence</p>
        </div>
      </div>
    </details>
  );
}
