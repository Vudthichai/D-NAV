"use client";

import type { PostureSummary } from "@/lib/judgment/posture";
import { deriveEarlyWarnings } from "@/lib/judgment/posture";

export function EarlyWarningFlags({
  label,
  posture,
}: {
  label: string;
  posture: PostureSummary;
}) {
  const flags = deriveEarlyWarnings(posture);

  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Early Warning Flags</p>
          <p className="text-sm font-semibold text-foreground">{label}</p>
        </div>
        <span className="text-[11px] text-muted-foreground">auto-detected</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {flags.map((flag) => (
          <div key={flag.key} className="rounded-lg border bg-background/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">{flag.title}</span>
              <span
                className={
                  flag.status === "On"
                    ? "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900"
                    : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                }
              >
                {flag.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{flag.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
