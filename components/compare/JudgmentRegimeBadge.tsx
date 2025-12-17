"use client";

import { cn } from "@/utils/cn";
import type { RegimeResult, RegimeType } from "@/lib/judgment/posture";

const REGIME_COLORS: Record<RegimeType, string> = {
  Exploitative: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Exploratory: "bg-blue-100 text-blue-800 border-blue-200",
  Stressed: "bg-red-100 text-red-800 border-red-200",
  Asymmetric: "bg-purple-100 text-purple-800 border-purple-200",
};

export function JudgmentRegimeBadge({
  label,
  regime,
}: {
  label: string;
  regime: RegimeResult;
}) {
  const pillClass = REGIME_COLORS[regime.regime];
  const confidencePct = Math.round(regime.confidence * 100);

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Judgment Regime</p>
          <p className="text-sm font-semibold text-foreground">{label}</p>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", pillClass)}>{regime.regime}</span>
      </div>
      <p className="text-sm text-muted-foreground">{regime.explanation}</p>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <div className="h-1.5 flex-1 rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-foreground/70"
            style={{ width: `${confidencePct}%`, maxWidth: "100%" }}
          />
        </div>
        <span className="font-semibold">{confidencePct}%</span>
      </div>
    </div>
  );
}
