'use client';

import { DecisionMetrics, getArchetype } from '@/lib/calculations';

interface SummaryCardProps {
  metrics: DecisionMetrics;
  coachText: string;
}

export default function SummaryCard({ metrics, coachText }: SummaryCardProps) {
  const archetype = getArchetype(metrics);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="m-0 text-xs text-muted-foreground uppercase tracking-wider">Archetype</h3>
        <div className="text-2xl font-black mt-1.5">{archetype.name}</div>
      </div>

      <div>
        <h3 className="m-0 text-xs text-muted-foreground uppercase tracking-wider">Coach</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">
          This is the posture you’re taking under uncertainty — the instinctive way you’re holding this decision. The coach insight gives you the smallest possible correction to make this call smarter.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-3">
          <span className="font-semibold text-foreground">Coach insight:</span> {coachText}
        </p>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">D-NAV Score</p>
          </div>
          <p className="text-3xl font-black text-foreground">{metrics.dnav}</p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          This reflects how much energy you are putting into your decision.
        </p>
      </div>
    </div>
  );
}
