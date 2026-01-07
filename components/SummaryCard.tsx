'use client';

import { DecisionMetrics, JudgmentSignal, getArchetype, getReadoutLines } from "@/lib/calculations";
import Term from "@/components/ui/Term";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  metrics: DecisionMetrics;
  className?: string;
  compact?: boolean;
  showDefinitionLink?: boolean;
  judgmentSignal?: JudgmentSignal | null;
  meaningExpanded?: boolean;
}

export default function SummaryCard({
  metrics,
  className,
  compact = false,
  showDefinitionLink = true,
  judgmentSignal,
  meaningExpanded = false,
}: SummaryCardProps) {
  const archetype = getArchetype(metrics);
  const readoutLines = getReadoutLines(metrics, judgmentSignal);
  const hasJudgmentSignal = Boolean(judgmentSignal);
  const meaningPreview =
    readoutLines.meaning.length > 80 ? `${readoutLines.meaning.slice(0, 77)}…` : readoutLines.meaning;

  return (
    <div className={cn("flex flex-1 flex-col", compact ? "gap-4" : "gap-6", className)}>
      <div className={cn("rounded-lg border border-border/50 bg-muted/20", compact ? "p-3" : "p-4", "mt-auto")}>
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Archetype
                </h3>
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
                  "font-black transition-colors text-foreground",
                  hasJudgmentSignal ? "text-2xl text-muted-foreground" : "text-3xl",
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
                <Term
                  termKey="dnav"
                  disableUnderline
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  D-NAV
                </Term>
                <p className="text-base font-black text-foreground">{metrics.dnav}</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Condition</p>
              <p className={cn("text-foreground", compact ? "text-sm leading-snug" : "text-sm leading-relaxed")}>
                {readoutLines.condition}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background/80 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Action</p>
              <p className={cn("text-foreground", compact ? "text-sm leading-snug" : "text-sm leading-relaxed")}>
                {readoutLines.action}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What this means</p>
              {meaningExpanded ? (
                <p className={cn("text-foreground", compact ? "text-sm leading-snug" : "text-sm leading-relaxed")}>
                  {readoutLines.meaning}
                </p>
              ) : (
                <p
                  className={cn(
                    "text-muted-foreground",
                    compact ? "text-sm leading-snug" : "text-sm leading-relaxed",
                    "line-clamp-1"
                  )}
                >
                  {meaningPreview}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
