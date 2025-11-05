import { computeMetrics as coreComputeMetrics, DecisionMetrics, DecisionVariables } from "./calculations";

export type Sliders = DecisionVariables;

export type Metrics = DecisionMetrics;

export type Delta = { metric: keyof Metrics; base: number; scenario: number; delta: number };

export function computeMetrics(sliders: Sliders): Metrics {
  return coreComputeMetrics(sliders);
}

export function getDeltas(base: Metrics, scenario: Metrics): Delta[] {
  const keys = Object.keys(base) as (keyof Metrics)[];
  return keys.map((metric) => ({
    metric,
    base: base[metric],
    scenario: scenario[metric],
    delta: scenario[metric] - base[metric],
  }));
}

export function smallestNudge(baseSliders: Sliders, compute = computeMetrics) {
  const sliders = Object.keys(baseSliders) as (keyof Sliders)[];
  let best: { slider: keyof Sliders; direction: 1 | -1; dnavGain: number; newDnav: number } = {
    slider: sliders[0],
    direction: 1,
    dnavGain: -Infinity,
    newDnav: 0,
  };
  const baseDnav = compute(baseSliders).dnav;

  for (const slider of sliders) {
    for (const direction of [1, -1] as const) {
      const nextValue = Math.max(0, Math.min(10, baseSliders[slider] + direction));
      if (nextValue === baseSliders[slider]) continue;
      const trial = { ...baseSliders, [slider]: nextValue } as Sliders;
      const trialDnav = compute(trial).dnav;
      const gain = trialDnav - baseDnav;

      if (gain > best.dnavGain) {
        best = {
          slider,
          direction,
          dnavGain: gain,
          newDnav: trialDnav,
        };
      }
    }
  }

  if (best.dnavGain === -Infinity) {
    return { slider: sliders[0], direction: 1 as 1 | -1, dnavGain: 0, newDnav: baseDnav };
  }

  return best;
}

function formatDeltaValue(value: number) {
  return Number.isInteger(value) ? Math.abs(value).toString() : Math.abs(value).toFixed(1);
}

const positiveLabel = (label: string, delta: number) => `${label} ↑ ${formatDeltaValue(delta)}`;
const negativeLabel = (label: string, delta: number) => `${label} ↓ ${formatDeltaValue(delta)}`;

export function makeNarrative(deltas: Delta[]) {
  const by = (metric: keyof Metrics) => deltas.find((delta) => delta.metric === metric)?.delta ?? 0;
  const retDelta = by("return");
  const stabilityDelta = by("stability");
  const pressureDelta = by("pressure");
  const energyDelta = by("energy");
  const dnavDelta = by("dnav");

  const gains: string[] = [];
  if (retDelta > 0) gains.push("Return");
  if (stabilityDelta > 0) gains.push("Stability");
  if (energyDelta > 0) gains.push("Energy");
  if (pressureDelta < 0) gains.push("Lower pressure");

  const losses: string[] = [];
  if (retDelta < 0) losses.push("Return");
  if (stabilityDelta < 0) losses.push("Stability");
  if (energyDelta < 0) losses.push("Energy");
  if (pressureDelta > 0) losses.push("Pressure climbs");

  const describe = (items: string[]) => {
    if (!items.length) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
  };

  let headline: string;
  if (dnavDelta > 0) {
    const summary = describe(gains);
    headline = summary
      ? `Scenario improves D-NAV by +${formatDeltaValue(dnavDelta)}: gains in ${summary}`
      : `Scenario improves D-NAV by +${formatDeltaValue(dnavDelta)}`;
  } else if (dnavDelta < 0) {
    const summary = describe(losses);
    headline = summary
      ? `Scenario lowers D-NAV by ${formatDeltaValue(dnavDelta)}: ${summary} falls behind`
      : `Scenario lowers D-NAV by ${formatDeltaValue(dnavDelta)}`;
  } else {
    headline = `Same D-NAV: trade-offs offset`;
  }

  const tradeoffs: string[] = [];
  if (retDelta !== 0) tradeoffs.push(retDelta > 0 ? positiveLabel("Return", retDelta) : negativeLabel("Return", retDelta));
  if (stabilityDelta !== 0)
    tradeoffs.push(stabilityDelta > 0 ? positiveLabel("Stability", stabilityDelta) : negativeLabel("Stability", stabilityDelta));
  if (energyDelta !== 0)
    tradeoffs.push(energyDelta > 0 ? positiveLabel("Energy", energyDelta) : negativeLabel("Energy", energyDelta));
  if (pressureDelta !== 0)
    tradeoffs.push(
      pressureDelta > 0
        ? `Pressure ↑ ${formatDeltaValue(pressureDelta)} (cost of speed/risk)`
        : `Pressure ↓ ${formatDeltaValue(pressureDelta)} (more breathing room)`
    );

  return { headline, tradeoffs };
}
