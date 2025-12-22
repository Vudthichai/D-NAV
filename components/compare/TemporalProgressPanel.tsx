"use client";

import React from "react";

import type { DecisionEntry } from "@/lib/calculations";

export type TemporalProgressPanelProps = {
  decisions: DecisionEntry[];
};

export function TemporalProgressPanel({ decisions }: TemporalProgressPanelProps) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Temporal progress</p>
          <p className="text-sm font-semibold text-foreground">Decision label timeline</p>
        </div>
        <span className="text-[11px] text-muted-foreground">{decisions.length} decisions</span>
      </div>
      <div className="mt-3 space-y-2 text-xs">
        {decisions.length === 0 ? (
          <div className="rounded-lg border bg-background/60 p-3 text-muted-foreground">No decisions logged yet.</div>
        ) : (
          <ul className="space-y-2">
            {decisions.map((decision) => {
              const label = getRegimeLabel(decision);

              return (
                <li key={`${decision.ts}-${decision.name}`} className="flex items-center justify-between rounded-lg border bg-background/60 px-3 py-2">
                  <span className="font-semibold text-foreground">{decision.name}</span>
                  <span className="text-muted-foreground">{label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function getOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getRegimeLabel(decision: DecisionEntry): string {
  const candidates = [
    decision.regime,
    decision.regimeLabel,
    decision.policy,
    decision.policyLabel,
    decision.vehicleSegment,
    decision.archetype,
    decision.label,
  ];

  for (const candidate of candidates) {
    const resolved = getOptionalString(candidate);
    if (resolved) return resolved;
  }

  return "Unlabeled";
}
