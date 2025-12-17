"use client";

import type { PostureSummary } from "@/lib/judgment/posture";
import { cn } from "@/utils/cn";

export function PostureGeometryPanel({
  label,
  posture,
  interpretation,
}: {
  label: string;
  posture: PostureSummary;
  interpretation?: string;
}) {
  const distance = posture.geometry.distanceToAttractor;
  const variance = posture.geometry.varianceMagnitude;
  const varianceLabel = posture.geometry.varianceLabel;

  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Posture Geometry</p>
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        </div>
        <span className="text-[11px] text-muted-foreground">Variance: {varianceLabel}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Distance to attractor</p>
          <p className="text-sm font-semibold text-foreground">{distance.toFixed(2)}</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted">
            <div
              className={cn("h-1.5 rounded-full", distance < 1 ? "bg-emerald-500" : "bg-amber-500")}
              style={{ width: `${Math.min(distance * 15, 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg border bg-background/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Centroid (R · P · S)</p>
          <p className="text-sm font-semibold text-foreground">
            {posture.geometry.centroid.R.toFixed(2)} · {posture.geometry.centroid.P.toFixed(2)} · {posture.geometry.centroid.S.toFixed(2)}
          </p>
          <p className="text-[11px] text-muted-foreground">Variance halo {variance.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-background/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Risk proxies</p>
          <p className="text-sm font-semibold text-foreground">
            Fragility {posture.geometry.stabilityRiskRatio.toFixed(1)} · Pressure debt {posture.geometry.pressureDebtProxy.toFixed(1)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {posture.trends.pressureLag
              ? "Pressure is rising with return — watch the debt build."
              : "Pressure is not outpacing returns."}
          </p>
        </div>
      </div>
      {interpretation && <p className="mt-3 text-sm text-muted-foreground">{interpretation}</p>}
    </div>
  );
}
