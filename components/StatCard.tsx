'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  pill: {
    text: string;
    color: 'green' | 'amber' | 'red' | 'blue';
  };
  subtitle?: string;
  description?: string;
}

export default function StatCard({ title, value, pill, subtitle, description }: StatCardProps) {
  const formatValue = (val: number) => val > 0 ? `+${val}` : val < 0 ? val.toString() : '0';

  const pillVariants = {
    green: 'bg-green-500/18 text-green-400 border-green-500/40',
    amber: 'bg-amber-500/18 text-amber-400 border-amber-500/35',
    red: 'bg-red-500/18 text-red-400 border-red-500/40',
    blue: 'bg-blue-500/18 text-blue-400 border-blue-500/35'
  };

  return (
    <Card className="bg-white/4 rounded-lg p-3 min-h-[96px] flex flex-col justify-between border-0">
      <CardContent className="p-0 flex flex-col justify-between h-full space-y-2">
        <h3 className="m-0 text-[11px] text-muted-foreground tracking-wider uppercase font-medium">
          {title}
        </h3>
        {subtitle ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            {subtitle}
          </p>
        ) : null}
        <div className="text-3xl font-black leading-tight">
          {formatValue(value)}
        </div>
        {description ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        ) : null}
        <Badge
          variant="outline"
          className={cn(
            "inline-block px-1.5 py-0.5 rounded-full font-bold text-[9px] leading-tight whitespace-nowrap w-fit",
            pillVariants[pill.color]
          )}
        >
          {pill.text}
        </Badge>
      </CardContent>
    </Card>
  );
}
