'use client';

import { Button } from '@/components/ui/button';
import { DecisionMetrics, getArchetype, getScoreTagText, energyTier } from '@/lib/calculations';

interface SummaryCardProps {
  metrics: DecisionMetrics;
  urgency: number;
  confidence: number;
  onOpenCompare: () => void;
}

export default function SummaryCard({ metrics, urgency, confidence, onOpenCompare }: SummaryCardProps) {
  const archetype = getArchetype(metrics);
  const energyInfo = energyTier(urgency, confidence);
  const scoreTag = getScoreTagText(metrics.dnav);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="m-0 text-xs text-muted-foreground uppercase tracking-wider">Archetype</h3>
        <div className="text-2xl font-black mt-1.5">{archetype.name}</div>
        <div className="text-foreground mt-1.5">{archetype.description}</div>
      </div>
      
      <div>
        <h3 className="m-0 text-xs text-muted-foreground uppercase tracking-wider">Composite (D-NAV)</h3>
        <div className="text-4xl font-black mt-1.5">{metrics.dnav}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {scoreTag} — {energyInfo.name}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Merit: <span className="font-mono">{metrics.merit}</span> • Energy: <span className="font-mono">{metrics.energy}</span>
        </div>
        <div className="mt-4">
          <Button 
            onClick={onOpenCompare}
            variant="outline"
            className="inline-block self-start mt-4 ml-0 bg-transparent text-primary border border-primary/45 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-center shadow-none transition-all duration-200 hover:bg-primary/10 hover:border-primary/65 hover:text-primary-foreground hover:-translate-y-0.5"
          >
            Open Compare
          </Button>
        </div>
      </div>
    </div>
  );
}
