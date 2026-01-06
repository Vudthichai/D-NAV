'use client';

import { DecisionMetrics, JudgmentSignal, getArchetype } from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  metrics: DecisionMetrics;
  coachText: string;
  className?: string;
  compact?: boolean;
  optimizeFor?: string;
  showDefinitionLink?: boolean;
  judgmentSignal?: JudgmentSignal | null;
}

export default function SummaryCard({
  metrics,
  coachText,
  className,
  compact = false,
  optimizeFor,
  showDefinitionLink = true,
  judgmentSignal,
}: SummaryCardProps) {
  const archetype = getArchetype(metrics);

  return (
    <div className={cn("flex flex-1 flex-col", compact ? "gap-4" : "gap-6", className)}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 text-[11px] text-muted-foreground uppercase tracking-wider">Archetype</h3>
          {showDefinitionLink ? (
            <a
              href="/definitions"
              className="text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground"
            >
              See definition
            </a>
          ) : null}
        </div>
        <div className={cn("font-black", compact ? "text-xl leading-tight" : "text-2xl mt-1.5")}>
          {archetype.name}
        </div>
        <p className={cn("text-muted-foreground", compact ? "text-sm leading-snug" : "text-sm leading-relaxed")}>
          {archetype.description}
        </p>
      </div>

      <div className={cn("rounded-lg border border-border/50 bg-muted/20", compact ? "p-3" : "p-4", "mt-auto")}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">D-NAV score</p>
            <p className={cn("font-black text-foreground", compact ? "text-2xl" : "text-3xl")}>{metrics.dnav}</p>
          </div>
          {optimizeFor ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/40 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Optimize for</p>
              <span className="text-sm font-semibold text-foreground">{optimizeFor}</span>
            </div>
          ) : null}
          {judgmentSignal ? (
            <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Judgment Signal Detected
                </p>
                <span className="text-xs font-semibold text-foreground">{judgmentSignal.label}</span>
              </div>
              <p className={cn("text-muted-foreground", compact ? "text-sm leading-snug" : "mt-1 text-sm leading-relaxed")}>
                {judgmentSignal.explanation}
              </p>
              <p className={cn("text-foreground", compact ? "text-sm leading-snug" : "text-sm leading-relaxed")}>
                <span className="font-semibold">Corrective move:</span> {judgmentSignal.correctiveMove}
              </p>
            </div>
          ) : null}
          <p className={cn("text-foreground", compact ? "text-sm leading-snug" : "mt-1 text-sm leading-relaxed")}>
            Next move: {coachText}
          </p>
        </div>
      </div>
    </div>
  );
}
