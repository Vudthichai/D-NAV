"use client";

import React, { useMemo } from "react";
import type { CompanyPeriodSnapshot } from "@/lib/dnavSummaryEngine";
import { generateSystemCompareSummary } from "@/lib/dnavSummaryEngine";

interface SystemComparePanelProps {
  left: CompanyPeriodSnapshot; // "A"
  right: CompanyPeriodSnapshot; // "B"
  labelA?: string;
  labelB?: string;
}

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({ left, right, labelA, labelB }) => {
  const summary = useMemo(() => generateSystemCompareSummary(left, right), [left, right]);

  const leftRps = left.rpsBaseline;
  const rightRps = right.rpsBaseline;

  return (
    <section className="mt-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Compare</h2>
          <p className="text-sm text-muted-foreground">
            A: {labelA ?? summary.labelA} · B: {labelB ?? summary.labelB}
          </p>
        </div>
      </div>

      {/* Posture row: avg R/P/S side by side */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-muted/40 p-4">
          <h3 className="mb-1 text-sm font-semibold">Average Return (R)</h3>
          <p className="mb-1 text-xs text-muted-foreground">A: {leftRps.avgReturn.toFixed(1)}</p>
          <p className="mb-2 text-xs text-muted-foreground">B: {rightRps.avgReturn.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">
            {describeDirection(rightRps.avgReturn - leftRps.avgReturn)}
          </p>
        </div>
        <div className="rounded-xl border bg-muted/40 p-4">
          <h3 className="mb-1 text-sm font-semibold">Average Pressure (P)</h3>
          <p className="mb-1 text-xs text-muted-foreground">A: {leftRps.avgPressure.toFixed(1)}</p>
          <p className="mb-2 text-xs text-muted-foreground">B: {rightRps.avgPressure.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">
            {describeDirection(rightRps.avgPressure - leftRps.avgPressure, true)}
          </p>
        </div>
        <div className="rounded-xl border bg-muted/40 p-4">
          <h3 className="mb-1 text-sm font-semibold">Average Stability (S)</h3>
          <p className="mb-1 text-xs text-muted-foreground">A: {leftRps.avgStability.toFixed(1)}</p>
          <p className="mb-2 text-xs text-muted-foreground">B: {rightRps.avgStability.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">
            {describeDirection(rightRps.avgStability - leftRps.avgStability)}
          </p>
        </div>
      </div>

      {/* Narrative blocks */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-muted/40 p-4">
          <h3 className="mb-1 text-sm font-semibold">Posture</h3>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{summary.postureLine}</p>
        </div>
        <div className="rounded-xl border bg-muted/40 p-4">
          <h3 className="mb-1 text-sm font-semibold">Decision Terrain</h3>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{summary.terrainLine}</p>
        </div>
        <div className="rounded-xl border bg-muted/40 p-4">
          <h3 className="mb-1 text-sm font-semibold">Archetype Mix</h3>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{summary.archetypeLine}</p>
        </div>
        <div className="rounded-xl border bg-muted/40 p-4">
          <h3 className="mb-1 text-sm font-semibold">Learning &amp; Recovery</h3>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{summary.learningLine}</p>
        </div>
      </div>
    </section>
  );
};

export default SystemComparePanel;

// Helper for quick direction tag inside the cards.
// Place this below the component in the same file.
function describeDirection(delta: number, invertGood = false): string {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.2) return "Roughly unchanged.";
  const higherIsGood = !invertGood;
  const isUp = delta > 0;
  const good = (isUp && higherIsGood) || (!isUp && !higherIsGood);
  const dirWord = isUp ? "higher" : "lower";
  const tone = good ? "healthier posture" : "weaker posture";
  return `${dirWord} in B → ${tone}.`;
}
