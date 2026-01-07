'use client';

import { DecisionMetrics, JudgmentSignal, getArchetype, getReadoutLines } from "@/lib/calculations";
import Term from "@/components/ui/Term";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

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
  const [isMeaningExpanded, setIsMeaningExpanded] = useState(meaningExpanded);
  const canToggleMeaning = useMemo(() => readoutLines.meaning.length > 180, [readoutLines.meaning]);

  useEffect(() => {
    setIsMeaningExpanded(meaningExpanded);
  }, [meaningExpanded]);

  return (
    <div className={cn("flex flex-1 flex-col", compact ? "gap-4" : "gap-6", className)}>
      <div className={cn("rounded-lg border border-border/50 bg-muted/20", compact ? "p-3" : "p-4", "mt-auto")}>
        <div className="flex flex-col gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
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
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className={cn(
                  "font-black transition-colors text-foreground",
                  hasJudgmentSignal ? "text-2xl text-muted-foreground" : "text-3xl",
                  compact ? "leading-tight" : "mt-1"
                )}
              >
                {archetype.name}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-baseline gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 shadow-sm">
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
            <p
              className={cn(
                hasJudgmentSignal ? "text-muted-foreground/80" : "text-muted-foreground",
                compact ? "text-sm leading-snug" : "text-sm leading-relaxed"
              )}
            >
              {archetype.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Condition</span>
            <span className={cn("text-foreground", compact ? "text-sm leading-snug" : "text-sm leading-relaxed")}>
              {readoutLines.condition}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-border/70 bg-background/80 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Action</p>
              <p className={cn("text-foreground", compact ? "text-sm leading-snug" : "text-sm leading-relaxed")}>
                {readoutLines.action}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background/80 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                What this means
              </p>
              <p
                className={cn(
                  isMeaningExpanded ? "text-foreground" : "text-muted-foreground",
                  compact ? "text-sm leading-snug" : "text-sm leading-relaxed",
                  canToggleMeaning && !isMeaningExpanded && "line-clamp-3"
                )}
              >
                {readoutLines.meaning}
              </p>
              {canToggleMeaning ? (
                <button
                  type="button"
                  onClick={() => setIsMeaningExpanded((prev) => !prev)}
                  className="mt-1 inline-flex text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {isMeaningExpanded ? "Less" : "More"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
