import { buildDecision, computeMetrics } from "./compute";
import { findSmallestNudge } from "./sensitivity";
import {
  type CompareResult,
  type Decision,
  type DecisionVars,
  type Delta,
  type Driver,
  type SensitivitySuggestion,
} from "./types";

const VAR_KEYS: (keyof DecisionVars)[] = ["impact", "cost", "risk", "urgency", "confidence"];

function normalizeDecision(decision: Decision): Decision {
  const metrics = computeMetrics(decision.vars);
  return { ...decision, metrics };
}

function buildDelta(baseline: Decision, candidate: Decision): Delta {
  return {
    dnav: candidate.metrics.dnav - baseline.metrics.dnav,
    return: candidate.metrics.return - baseline.metrics.return,
    pressure: candidate.metrics.pressure - baseline.metrics.pressure,
    stability: candidate.metrics.stability - baseline.metrics.stability,
    vars: VAR_KEYS.reduce<Partial<Record<keyof DecisionVars, number>>>((acc, key) => {
      const delta = candidate.vars[key] - baseline.vars[key];
      if (delta !== 0) acc[key] = delta;
      return acc;
    }, {}),
  };
}

function buildDrivers(baseline: Decision, candidate: Decision): Driver[] {
  const baseMetrics = baseline.metrics;
  const baselineVars = baseline.vars;
  const drivers: Driver[] = VAR_KEYS.map((key) => {
    const solo = buildDecision({ id: key, label: key, vars: { ...baselineVars, [key]: candidate.vars[key] } });
    const dnavShift = solo.metrics.dnav - baseMetrics.dnav;
    const returnShift = solo.metrics.return - baseMetrics.return;
    const pressureShift = solo.metrics.pressure - baseMetrics.pressure;
    const stabilityShift = solo.metrics.stability - baseMetrics.stability;

    const noteParts: string[] = [];
    if (dnavShift !== 0) noteParts.push(`D-NAV ${formatDelta(dnavShift)}`);
    if (returnShift !== 0) noteParts.push(`Return ${formatDelta(returnShift)}`);
    if (pressureShift !== 0) noteParts.push(`Pressure ${formatDelta(pressureShift)}`);
    if (stabilityShift !== 0) noteParts.push(`Stability ${formatDelta(stabilityShift)}`);

    const changeLabel = `${capitalize(key)} ${baselineVars[key]} → ${candidate.vars[key]}`;
    const note = noteParts.length ? `${changeLabel} drives ${noteParts.join(", ")}` : `${changeLabel} is unchanged.`;

    return { key, contribution: Math.abs(dnavShift), note };
  });

  return drivers
    .filter((driver) => driver.contribution > 0)
    .sort((a, b) => {
      if (b.contribution === a.contribution) return a.key.localeCompare(b.key);
      return b.contribution - a.contribution;
    })
    .slice(0, 3);
}

function buildSensitivity(candidate: Decision): SensitivitySuggestion[] {
  const targets: Array<{ target: "dnav" | "return" | "pressure" | "stability"; delta: number }> = [
    { target: "dnav", delta: 1 },
    { target: "return", delta: 1 },
    { target: "pressure", delta: -1 },
    { target: "stability", delta: 1 },
  ];

  return targets
    .map((target) => findSmallestNudge(candidate.vars, target.target, target.delta))
    .filter((suggestion): suggestion is SensitivitySuggestion => Boolean(suggestion));
}

export function compareDecisions(baseline: Decision, candidate: Decision): CompareResult {
  const normalizedBaseline = normalizeDecision(baseline);
  const normalizedCandidate = normalizeDecision(candidate);

  return {
    baseline: normalizedBaseline,
    candidate: normalizedCandidate,
    delta: buildDelta(normalizedBaseline, normalizedCandidate),
    drivers: { top: buildDrivers(normalizedBaseline, normalizedCandidate) },
    sensitivity: { suggestions: buildSensitivity(normalizedCandidate) },
  };
}

export function cloneDecision(decision: Decision, overrides?: Partial<Decision>): Decision {
  return buildDecision({
    id: overrides?.id ?? decision.id,
    label: overrides?.label ?? decision.label,
    vars: overrides?.vars ?? decision.vars,
    category: overrides?.category ?? decision.category,
    timestamp: overrides?.timestamp ?? decision.timestamp,
    source: overrides?.source ?? decision.source,
  });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDelta(value: number): string {
  const prefix = value > 0 ? "+" : "";
  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return `${prefix}${formatted}`;
}
