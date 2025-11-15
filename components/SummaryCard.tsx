'use client';

import { DecisionMetrics, getArchetype } from '@/lib/calculations';

interface SummaryCardProps {
  metrics: DecisionMetrics;
  coachText: string;
}

export default function SummaryCard({ metrics, coachText }: SummaryCardProps) {
  const archetype = getArchetype(metrics);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="m-0 text-[11px] text-muted-foreground uppercase tracking-wider">Archetype</h3>
        <div className="text-xl font-black mt-1.5">{archetype.name}</div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Coach insight:</span> {coachText}
        </p>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/20 p-4 mt-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">D-NAV Score</p>
          </div>
          <p className="text-2xl font-black text-foreground">{metrics.dnav}</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          This reflects how much energy you are putting into your decision.
        </p>
      </div>
    </div>
  );
}
