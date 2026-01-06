'use client';

import { DecisionMetrics, getArchetype } from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  metrics: DecisionMetrics;
  coachText: string;
  className?: string;
  compact?: boolean;
}

export default function SummaryCard({ metrics, coachText, className, compact = false }: SummaryCardProps) {
  const archetype = getArchetype(metrics);

  return (
    <div className={cn("flex flex-1 flex-col", compact ? "gap-4" : "gap-6", className)}>
      <div className="space-y-1.5">
        <h3 className="m-0 text-[11px] text-muted-foreground uppercase tracking-wider">Archetype</h3>
        <div className={cn("font-black", compact ? "text-xl leading-tight" : "text-2xl mt-1.5")}>
          {archetype.name}
        </div>
        <p className={cn("text-muted-foreground", compact ? "text-sm leading-snug" : "text-sm leading-relaxed")}>
          {archetype.description}
        </p>
      </div>

      <div className={cn("rounded-lg border border-border/50 bg-muted/20", compact ? "p-3" : "p-4", "mt-auto")}>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">D-NAV score</p>
          <p className={cn("font-black text-foreground", compact ? "text-2xl" : "text-3xl")}>{metrics.dnav}</p>
        </div>
        <p className={cn("text-foreground", compact ? "mt-2 text-sm leading-snug" : "mt-3 text-sm leading-relaxed")}>
          Next move: {coachText}
        </p>
      </div>
    </div>
  );
}
