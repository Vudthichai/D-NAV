'use client';

import { Button } from '@/components/ui/button';
import { DecisionMetrics, getArchetype } from '@/lib/calculations';

interface SummaryCardProps {
  metrics: DecisionMetrics;
  coachText: string;
  onOpenCompare: () => void;
}

export default function SummaryCard({ metrics, coachText, onOpenCompare }: SummaryCardProps) {
  const archetype = getArchetype(metrics);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="m-0 text-xs text-muted-foreground uppercase tracking-wider">Archetype</h3>
        <div className="text-2xl font-black mt-1.5">{archetype.name}</div>
      </div>

      <div>
        <h3 className="m-0 text-xs text-muted-foreground uppercase tracking-wider">Coach</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{coachText}</p>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">D-NAV Score</p>
          </div>
          <p className="text-3xl font-black text-foreground">{metrics.dnav}</p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          D-NAV Composite: A single score that captures the overall health of this decision.
        </p>
      </div>

      <div className="mt-2">
        <Button
          onClick={onOpenCompare}
          variant="outline"
          className="inline-block self-start bg-transparent text-primary border border-primary/45 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-center shadow-none transition-all duration-200 hover:bg-primary/10 hover:border-primary/65 hover:text-primary-foreground hover:-translate-y-0.5"
        >
          Open Compare
        </Button>
      </div>
    </div>
  );
}
