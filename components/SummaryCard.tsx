'use client';

import { DecisionMetrics, JudgmentSignal, JudgmentSignalKey, getArchetype } from "@/lib/calculations";
import { cn } from "@/lib/utils";

const signalSummaries: Record<JudgmentSignalKey, string> = {
  fragileExecution: "Speed is outpacing the stability of execution.",
  narrativeInflation: "Belief is running ahead of the evidence and returns.",
  rushedWithoutNecessity: "The timeline is racing without a matching external push.",
  underexploitedLeverage: "Solid returns and footing are being under-used.",
};

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
  const hasJudgmentSignal = Boolean(judgmentSignal);
  const judgmentExplanation = judgmentSignal ? signalSummaries[judgmentSignal.key] || judgmentSignal.explanation : null;

  return (
    <div className={cn("flex flex-1 flex-col", compact ? "gap-4" : "gap-6", className)}>
      {hasJudgmentSignal ? (
        <div className={cn("rounded-lg border border-primary/50 bg-primary/5", compact ? "p-3" : "p-4")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Judgment Signal Detected</p>
          <p className={cn("font-black text-foreground", compact ? "text-lg mt-1" : "text-xl mt-1.5")}>
            {judgmentSignal?.label}
          </p>
          {judgmentExplanation ? (
            <p className="text-sm leading-snug text-foreground/80">{judgmentExplanation}</p>
          ) : null}
          {judgmentSignal?.correctiveMove ? (
            <p className="text-sm leading-snug text-foreground">
              <span className="font-semibold">Corrective move:</span> {judgmentSignal.correctiveMove}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={cn("rounded-lg border border-border/50 bg-muted/20", compact ? "p-3" : "p-4", "mt-auto")}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
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
              <div
                className={cn(
                  "font-black transition-colors",
                  hasJudgmentSignal ? "text-lg text-muted-foreground" : "text-2xl text-foreground",
                  compact ? "leading-tight" : "mt-1"
                )}
              >
                {archetype.name}
              </div>
              <p
                className={cn(
                  hasJudgmentSignal ? "text-muted-foreground/80" : "text-muted-foreground",
                  compact ? "text-sm leading-snug" : "text-sm leading-relaxed"
                )}
              >
                {archetype.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-baseline gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">D-NAV</p>
                <p className="text-base font-black text-foreground">{metrics.dnav}</p>
              </div>
              {optimizeFor ? (
                <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Optimize for</p>
                  <span className="text-sm font-semibold text-foreground">{optimizeFor}</span>
                </div>
              ) : null}
            </div>
          </div>
          {!hasJudgmentSignal ? (
            <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Next move</p>
              <p className={cn("text-foreground", compact ? "text-sm leading-snug" : "text-sm leading-relaxed")}>
                {coachText}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
