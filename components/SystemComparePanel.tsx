"use client";

import React, { useMemo } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { CompareResult, VelocityResult } from "@/lib/compare/types";

interface SystemComparePanelProps {
  result: CompareResult;
  warning?: string;
  showDebug?: boolean;
}

const MODE_LABELS: Record<string, string> = {
  entity: "Entity",
  temporal: "Temporal",
  velocity: "Velocity",
};

const SystemComparePanel: React.FC<SystemComparePanelProps> = ({ result, warning, showDebug }) => {
  const { cohortA, cohortB, deltas, narrative, velocity, driverDeltas, consistency, topDrivers, scopeLabel, judgmentUnit } = result;

  const scopeDescription = scopeLabel
    ? scopeLabel
    : cohortA.timeframeLabel === cohortB.timeframeLabel
      ? cohortA.timeframeLabel
      : `${cohortA.timeframeLabel} · ${cohortB.timeframeLabel}`;

  const cards = useMemo(
    () => buildQuestionCards({ result, judgmentUnit }),
    [judgmentUnit, result],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Results</h2>
          <p className="text-xs text-muted-foreground">What you&apos;re looking at</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-3 py-1 uppercase tracking-wide">{MODE_LABELS[result.mode]}</span>
          <span>
            {cohortA.label} vs {cohortB.label}
          </span>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">
          {MODE_LABELS[result.mode]} comparison{judgmentUnit ? ` · ${judgmentUnit}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">Scope: {scopeDescription}</p>
        {velocity && (
          <p className="mt-2 text-xs text-muted-foreground">
            Target rule: {describeVelocityRule(velocity.a)}
          </p>
        )}
      </div>

      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{warning}</div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border bg-card/60 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{card.title}</p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">{card.answer}</h3>
            {card.why && <p className="mt-1 text-xs text-muted-foreground">Why: {card.why}</p>}
            {card.metrics && <p className="mt-2 text-[11px] text-muted-foreground">Metrics: {card.metrics}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Posture</p>
        <p className="mt-1 text-sm text-muted-foreground">{narrative}</p>
        {topDrivers.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Top drivers: {topDrivers.slice(0, 2).join(" · ")}</p>
        )}
      </div>

      {velocity && (
        <div className="grid gap-4 lg:grid-cols-3">
          <VelocityCard label={`Velocity — ${cohortA.label}`} unit={judgmentUnit} result={velocity.a} />
          <VelocityCard label={`Velocity — ${cohortB.label}`} unit={judgmentUnit} result={velocity.b} />
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Punchline</p>
            <p className="mt-1 text-sm text-muted-foreground">{velocity.punchline}</p>
          </div>
        </div>
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="details">
          <AccordionTrigger className="text-sm font-semibold">Show details</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-muted/40 p-4">
                <h3 className="mb-2 text-sm font-semibold">Consistency (std dev)</h3>
                <p className="text-xs text-muted-foreground">Lower values mean steadier outcomes.</p>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{cohortA.label}</span>
                    <span>
                      R {formatValue(consistency.cohortAStd.return)} · P {formatValue(consistency.cohortAStd.pressure)} · S {" "}
                      {formatValue(consistency.cohortAStd.stability)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{cohortB.label}</span>
                    <span>
                      R {formatValue(consistency.cohortBStd.return)} · P {formatValue(consistency.cohortBStd.pressure)} · S {" "}
                      {formatValue(consistency.cohortBStd.stability)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/40 p-4 md:col-span-2">
                <h3 className="mb-1 text-sm font-semibold">Drivers (A → B)</h3>
                <p className="text-xs text-muted-foreground">Impact, Cost, Risk, Urgency, Confidence.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: "Impact", delta: driverDeltas.impact },
                    { label: "Cost", delta: driverDeltas.cost },
                    { label: "Risk", delta: driverDeltas.risk },
                    { label: "Urgency", delta: driverDeltas.urgency },
                    { label: "Confidence", delta: driverDeltas.confidence },
                  ].map((driver) => (
                    <div key={driver.label} className="rounded-lg border border-dashed bg-background/60 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{driver.label}</span>
                        <span className="text-muted-foreground">Δ {formatDelta(driver.delta)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {describeDriverShift(driver.label, driver.delta, cohortA.label, cohortB.label)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {showDebug && result.developerDetails && (
              <div className="mt-4 rounded-xl border bg-muted/40 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Developer details (debug)</p>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-3 text-[11px] text-muted-foreground">
{JSON.stringify(result.developerDetails, null, 2)}
                </pre>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
};

export default SystemComparePanel;

function VelocityCard({ label, result, unit }: { label: string; result: VelocityResult; unit?: string }) {
  const unitLabel = unit ? `${unit}${result.decisionsToTarget === 1 ? "" : "s"}` : "decisions";
  return (
    <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <h3 className="text-sm font-semibold text-foreground">{result.targetLabel}</h3>
          <p className="text-xs text-muted-foreground">Windowed velocity</p>
        </div>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        {result.targetReached && result.decisionsToTarget ? (
          <p className="text-sm font-semibold text-foreground">
            Reached after {result.decisionsToTarget} {unit ? unitLabel : "decisions"} (first time the target rule held for {result.consecutiveWindows}
            consecutive windows).
          </p>
        ) : (
          <p className="text-sm font-semibold text-foreground">Target not reached in this scope.</p>
        )}
        <p className="text-xs text-muted-foreground">What this means: {describeVelocityRule(result)}</p>
        {result.reason && <p className="text-xs text-muted-foreground">{result.reason}</p>}
      </div>
    </div>
  );
}

function buildQuestionCards({
  result,
  judgmentUnit,
}: {
  result: CompareResult;
  judgmentUnit?: string;
}): Array<{ title: string; answer: string; why?: string; metrics?: string }> {
  const { cohortA, cohortB, deltas, driverDeltas, consistency, velocity } = result;
  const labelA = cohortA.label;
  const labelB = cohortB.label;
  const unitLabel = judgmentUnit || "decision";

  const steadinessScoreA = average([consistency.cohortAStd.return, consistency.cohortAStd.pressure, consistency.cohortAStd.stability]);
  const steadinessScoreB = average([consistency.cohortBStd.return, consistency.cohortBStd.pressure, consistency.cohortBStd.stability]);
  const steadierAnswer =
    Math.abs(steadinessScoreA - steadinessScoreB) < 0.05
      ? "Similar steadiness"
      : steadinessScoreA < steadinessScoreB
        ? `${labelA} is steadier than ${labelB}`
        : `${labelB} is steadier than ${labelA}`;

  const aggressionA = cohortA.avgRisk + cohortA.avgUrgency + cohortA.avgCost;
  const aggressionB = cohortB.avgRisk + cohortB.avgUrgency + cohortB.avgCost;
  const aggressionAnswer =
    Math.abs(aggressionA - aggressionB) < 0.1
      ? "Similar aggression"
      : aggressionB > aggressionA
        ? `${labelB} is more aggressive than ${labelA}`
        : `${labelA} is more aggressive than ${labelB}`;

  const aggressionDrivers = buildDriverSummary(driverDeltas, labelA, labelB);

  const velocityAnswer = (() => {
    if (velocity) {
      const a = velocity.a.decisionsToTarget;
      const b = velocity.b.decisionsToTarget;
      if (!a && !b) return "Not enough decisions to evaluate target reliably.";
      if (!a) return `${labelB} reaches the target; ${labelA} has not reached it.`;
      if (!b) return `${labelA} reaches the target; ${labelB} has not reached it.`;
      if (a === b) return `Both reach the target after ${a} ${unitLabel}${a === 1 ? "" : "s"}.`;
      const faster = a < b ? labelA : labelB;
      const slower = faster === labelA ? labelB : labelA;
      const fastDecisions = Math.min(a, b);
      const slowDecisions = Math.max(a, b);
      return `${faster} reaches the target in ${fastDecisions} ${unitLabel}${fastDecisions === 1 ? "" : "s"}; ${slower} in ${slowDecisions}.`;
    }
    if (result.mode === "velocity") return "Not assessed in this mode";
    return "Not assessed in this mode";
  })();

  const pressureAnswer = deltas.pressureDelta > 0.2
    ? `${labelB} faces more pressure while return ${deltas.returnDelta >= 0 ? "improves" : "dips"}.`
    : Math.abs(deltas.pressureDelta) < 0.1
      ? "Similar pressure patterns"
      : `${labelA} faces more pressure swings.`;

  const recoveryAnswer = velocity
    ? velocity.a.targetReached && velocity.b.targetReached
      ? velocity.a.decisionsToTarget! === velocity.b.decisionsToTarget
        ? "Similar recovery speed"
        : velocity.a.decisionsToTarget! < velocity.b.decisionsToTarget!
          ? `${labelA} recovers faster under the target rule.`
          : `${labelB} recovers faster under the target rule.`
      : "Not enough data to compare recovery."
    : "Recovery not computed here.";

  const cards = [
    {
      title: "Who’s steadier?",
      answer: steadierAnswer,
      why: `Consistency favors ${steadinessScoreA < steadinessScoreB ? labelA : labelB}.`,
      metrics: `${labelA} σ ${formatValue(steadinessScoreA)} vs ${labelB} σ ${formatValue(steadinessScoreB)}`,
    },
    {
      title: "Who’s more aggressive?",
      answer: aggressionAnswer,
      why: aggressionDrivers,
      metrics: `${labelA} aggression ${formatValue(aggressionA)} vs ${labelB} ${formatValue(aggressionB)}`,
    },
    {
      title: "Who learns faster?",
      answer: velocityAnswer,
      why: velocity ? describeVelocityDriver(velocity) : undefined,
      metrics: velocity
        ? `${labelA} target ${velocity.a.decisionsToTarget ?? "—"}; ${labelB} target ${velocity.b.decisionsToTarget ?? "—"}`
        : undefined,
    },
    {
      title: "Who breaks under pressure?",
      answer: pressureAnswer,
      why: deltas.stabilityDelta < 0 ? `${labelB} stability softens when pressure rises.` : `${labelA} holds stability under pressure swings.`,
      metrics: `ΔP ${formatDelta(deltas.pressureDelta)} · ΔS ${formatDelta(deltas.stabilityDelta)}`,
    },
    {
      title: "Who recovers faster?",
      answer: recoveryAnswer,
      why: velocity ? describeVelocityDriver(velocity) : undefined,
      metrics: velocity
        ? `${labelA}: ${velocity.a.decisionsToTarget ?? "—"} ${unitLabel}s · ${labelB}: ${velocity.b.decisionsToTarget ?? "—"} ${unitLabel}s`
        : undefined,
    },
  ];

  return cards.filter((card) => Boolean(card.answer));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function formatValue(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatDelta(value: number) {
  if (Math.abs(value) < 0.05) return "0";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(value)}`;
}

function describeDriverShift(label: string, delta: number, cohortALabel: string, cohortBLabel: string) {
  if (Math.abs(delta) < 0.05) return `${label} is similar across both.`;
  return delta > 0
    ? `${cohortBLabel} shows higher ${label.toLowerCase()} than ${cohortALabel}.`
    : `${cohortBLabel} shows lower ${label.toLowerCase()} than ${cohortALabel}.`;
}

function describeVelocityRule(result: VelocityResult) {
  const { thresholds, windowSize, consecutiveWindows } = result;
  if (result.target === "RETURN_RISE") {
    return `Return lifts when the rolling average over the last ${windowSize} decisions stays ≥ ${thresholds.returnLift.toFixed(1)} for ${consecutiveWindows} windows.`;
  }
  if (result.target === "PRESSURE_STABILIZE") {
    return `Pressure stabilizes when the rolling pressure over the last ${windowSize} decisions stays within ±${thresholds.pressureBand.toFixed(1)} and stability stays above ${thresholds.stabilityFloor.toFixed(1)} for ${consecutiveWindows} windows.`;
  }
  return `Stability holds when the rolling stability over the last ${windowSize} decisions stays within ±${thresholds.stabilityBand.toFixed(1)} and above ${thresholds.stabilityFloor.toFixed(1)} for ${consecutiveWindows} windows.`;
}

function describeVelocityDriver(velocity: NonNullable<CompareResult["velocity"]>) {
  const a = velocity.a.decisionsToTarget;
  const b = velocity.b.decisionsToTarget;
  if (!a && !b) return "Targets not reached in the current window.";
  if (!a) return `${velocity.b.targetLabel} reached only by the second cohort.`;
  if (!b) return `${velocity.a.targetLabel} reached only by the first cohort.`;
  return `${velocity.a.targetLabel} reached in ${a} vs ${b} decisions.`;
}

function buildDriverSummary(drivers: CompareResult["driverDeltas"], labelA: string, labelB: string) {
  const contributors = [
    { key: "Risk", value: drivers.risk },
    { key: "Urgency", value: drivers.urgency },
    { key: "Cost", value: drivers.cost },
  ].filter((driver) => Math.abs(driver.value) > 0.05);

  if (contributors.length === 0) return "Aggression signals are similar.";
  const strongest = contributors.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
  return strongest.value > 0
    ? `${labelB} pushes higher ${strongest.key.toLowerCase()} than ${labelA}.`
    : `${labelA} pushes higher ${strongest.key.toLowerCase()} than ${labelB}.`;
}
