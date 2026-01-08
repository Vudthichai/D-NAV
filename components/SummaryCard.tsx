'use client';

import { DecisionMetrics, JudgmentSignal, getArchetype, getReadoutLines } from "@/lib/calculations";
import Term from "@/components/ui/Term";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface SummaryCardProps {
  metrics: DecisionMetrics;
  className?: string;
  compact?: boolean;
  showMagnitudeCue?: boolean;
  showDefinitionLink?: boolean;
  judgmentSignal?: JudgmentSignal | null;
  meaningExpanded?: boolean;
}

export default function SummaryCard({
  metrics,
  className,
  compact = false,
  showMagnitudeCue = true,
  judgmentSignal,
}: SummaryCardProps) {
  const archetype = getArchetype(metrics);
  const readoutLines = getReadoutLines(metrics, judgmentSignal);
  const hasJudgmentSignal = Boolean(judgmentSignal);
  const summaryText = useMemo(
    () => `${readoutLines.condition} ${readoutLines.meaning}`.trim(),
    [readoutLines.condition, readoutLines.meaning],
  );
  const magnitudeCue =
    showMagnitudeCue &&
    metrics.dnav <= 20
      ? "Low leverage. Treat as a small move unless upside changes."
      : metrics.dnav >= 80
        ? "High leverage. Same geometry, bigger consequences."
        : null;

  return (
    <div className={cn("flex flex-1 flex-col", compact ? "gap-3" : "gap-6", className)}>
      <div className={cn("rounded-lg border border-border/50 bg-muted/20", compact ? "p-2.5" : "p-4", "mt-auto")}>
        <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-3")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Archetype</p>
              <div
                className={cn(
                  "font-black transition-colors text-foreground",
                  hasJudgmentSignal ? "text-2xl text-muted-foreground" : "text-3xl",
                  compact ? "leading-tight" : "leading-snug",
                )}
              >
                {archetype.name}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/80 px-3 py-1 shadow-sm">
              <div className="flex items-center gap-2">
                <Term
                  termKey="dnav"
                  disableUnderline
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  D-NAV
                </Term>
                <p className="text-base font-black text-foreground">{metrics.dnav}</p>
              </div>
              {magnitudeCue ? (
                <p className="mt-1 text-[10px] font-medium text-muted-foreground">{magnitudeCue}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1">
            <p
              className={cn(
                compact
                  ? "text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70"
                  : "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
              )}
            >
              System summary
            </p>
            <p
              className={cn(
                hasJudgmentSignal ? "text-muted-foreground/80" : "text-muted-foreground",
                compact ? "text-xs leading-snug" : "text-sm leading-relaxed",
                "line-clamp-2",
              )}
            >
              {summaryText}
            </p>
          </div>
          <div className={cn("rounded-md border border-border/70 bg-background/80", compact ? "px-3 py-2" : "px-3 py-2.5")}>
            <p
              className={cn(
                compact
                  ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70"
                  : "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
              )}
            >
              Action
            </p>
            <p
              className={cn(
                "text-foreground",
                compact ? "text-sm font-semibold leading-snug" : "text-sm leading-relaxed",
              )}
            >
              {readoutLines.action}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
