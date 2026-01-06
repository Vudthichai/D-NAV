'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title?: string;
  label?: string;
  value: number | string;
  helper?: string;
  pill?: {
    text: string;
    color: 'green' | 'amber' | 'red' | 'blue';
  };
  subtitle?: string;
  description?: string;
  dense?: boolean;
  definitionHref?: string;
}

export default function StatCard({
  title,
  label,
  value,
  helper,
  pill,
  subtitle,
  description,
  dense = false,
  definitionHref,
}: StatCardProps) {
  const formatValue = (val: number | string) => {
    if (typeof val === 'number') return val > 0 ? `+${val}` : val < 0 ? val.toString() : '0';
    return val;
  };

  const pillVariants = {
    green: 'bg-green-500/18 text-green-400 border-green-500/40',
    amber: 'bg-amber-500/18 text-amber-400 border-amber-500/35',
    red: 'bg-red-500/18 text-red-400 border-red-500/40',
    blue: 'bg-blue-500/18 text-blue-400 border-blue-500/35',
  };

  return (
    <Card
      className={cn(
        "bg-white/4 rounded-xl border-0",
        dense ? "p-3" : "p-3.5 min-h-[110px]",
        "flex flex-col justify-between",
      )}
    >
      <CardContent className={cn("p-0 flex flex-col h-full", dense ? "gap-1.5" : "justify-between")}>
        <div className="flex items-center justify-between gap-2">
          <h3
            className={cn(
              "m-0 text-xs text-muted-foreground tracking-wider uppercase font-normal",
              dense && "mb-0.5",
            )}
          >
            {title ?? label}
          </h3>
          {definitionHref ? (
            <a
              href={definitionHref}
              className="text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground"
            >
              See definition
            </a>
          ) : null}
        </div>
        {subtitle ? (
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            {subtitle}
          </p>
        ) : null}
        <div className={cn("font-black leading-tight", dense ? "text-3xl" : "text-4xl")}>
          {formatValue(value)}
        </div>
        {description || helper ? (
          <p
            className={cn(
              "text-muted-foreground",
              dense ? "text-xs leading-snug" : "mt-3 text-sm leading-relaxed",
            )}
          >
            {description ?? helper}
          </p>
        ) : null}
        {pill ? (
          <Badge
            variant="outline"
            className={cn(
              "inline-block px-1.5 py-0.5 rounded-full font-extrabold text-[9px] leading-tight whitespace-nowrap w-fit",
              pillVariants[pill.color],
            )}
          >
            {pill.text}
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}
