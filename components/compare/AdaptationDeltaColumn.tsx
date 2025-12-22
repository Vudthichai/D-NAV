"use client";

import type { AdaptationMetric } from "@/components/compare/AdaptationPanel";
import { formatDeltaPp, getDeltaDirection } from "@/lib/compare/adaptation";
import { cn } from "@/lib/utils";

type AdaptationDeltaColumnProps = {
  metrics: AdaptationMetric[];
};

const DELTA_EPSILON = 0.5;

export function AdaptationDeltaColumn({ metrics }: AdaptationDeltaColumnProps) {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/40 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Delta
      </div>
      <div className="space-y-3">
        {metrics.map((metric) => {
          const direction = getDeltaDirection(metric.delta, DELTA_EPSILON);
          const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
          const tone = getDeltaTone(metric.key, direction);

          return (
            <div key={`delta-${metric.key}`} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{metric.label}</span>
              <span className={cn("font-semibold", tone)}>
                {arrow} {formatDeltaPp(metric.delta)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getDeltaTone(
  metric: AdaptationMetric["key"],
  direction: "up" | "down" | "flat",
) {
  if (direction === "flat") return "text-muted-foreground";

  if (metric === "return") {
    return direction === "up" ? "text-emerald-600" : "text-rose-500";
  }

  if (metric === "pressure") {
    return direction === "up" ? "text-amber-500" : "text-sky-500";
  }

  return direction === "up" ? "text-emerald-600" : "text-rose-500";
}
