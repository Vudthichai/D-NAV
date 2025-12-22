export type AdaptationCopyInput = {
  hasPreviousWindow: boolean;
  deltas: {
    returnPosPP: number | null;
    pressurePressuredPP: number | null;
    stabilityStablePP: number | null;
  };
  levels: {
    returnPosPct: number;
    pressurePressuredPct: number;
    stabilityStablePct: number;
  };
  consistency: {
    label: "Tight" | "Moderate" | "Volatile" | string;
    spread?: number;
    rangeMin?: number;
    rangeMax?: number;
    avgSwing?: number;
  };
};

type AdaptationCopyOutput = {
  headlineSummary: string;
  verdict: string;
  bullets?: string[];
};

const STEADY_PP = 2.0;
const MATERIAL_PP = 6.0;

export function buildAdaptationCopy(input: AdaptationCopyInput): AdaptationCopyOutput {
  const hasPrevious = input.hasPreviousWindow;
  const deltas = input.deltas;
  const { returnPosPP, pressurePressuredPP, stabilityStablePP } = deltas;

  if (
    !hasPrevious ||
    returnPosPP === null ||
    pressurePressuredPP === null ||
    stabilityStablePP === null
  ) {
    const signalLevel = levelFromPct(input.levels.returnPosPct);
    const pressureLevel = levelFromPct(input.levels.pressurePressuredPct);
    const stabilityLevel = levelFromPct(input.levels.stabilityStablePct);
    const repeatability = input.consistency.label || "—";

    return {
      headlineSummary: `Baseline window: signal ${signalLevel}, pressure load ${pressureLevel}, stability ${stabilityLevel}; repeatability: ${repeatability}.`,
      verdict: "Baseline captured; keep logging.",
    };
  }

  const signalSummaryWord = signalWord(returnPosPP);
  const pressureSummaryWord = pressureWord(pressurePressuredPP);
  const stabilitySummaryWord = stabilityWord(stabilityStablePP);

  const pressureMaterial = isMaterial(pressurePressuredPP);
  const stabilityMaterial = isMaterial(stabilityStablePP);

  const summaryClauses: string[] = [`Signal ${signalSummaryWord}`];
  if (pressureMaterial) summaryClauses.push(`pressure ${pressureSummaryWord}`);
  if (stabilityMaterial) summaryClauses.push(`stability ${stabilitySummaryWord}`);

  const headlineSummary = buildHeadlineSummary(summaryClauses, signalSummaryWord);

  const verdict = buildVerdict({
    returnDelta: returnPosPP,
    pressureDelta: pressurePressuredPP,
    stabilityDelta: stabilityStablePP,
  });

  return {
    headlineSummary,
    verdict,
  };
}

function buildHeadlineSummary(clauses: string[], signalSummaryWord: string): string {
  if (clauses.length === 1) {
    if (signalSummaryWord === "steady") {
      return "Signal steady; pressure steady.";
    }
    return `Signal ${signalSummaryWord}; pressure steady.`;
  }
  return `${clauses.join("; ")}.`;
}

function buildVerdict({
  returnDelta,
  pressureDelta,
  stabilityDelta,
}: {
  returnDelta: number;
  pressureDelta: number;
  stabilityDelta: number;
}): string {
  const signalWordValue = signalWord(returnDelta);
  const pressureWordValue = pressureWord(pressureDelta);
  const stabilityWordValue = stabilityWord(stabilityDelta);

  const signalSteady = isSteady(returnDelta);
  const pressureSteady = isSteady(pressureDelta);
  const stabilitySteady = isSteady(stabilityDelta);

  if (signalSteady && pressureSteady && stabilitySteady) {
    return "No meaningful shift; pattern steady.";
  }

  const pressureMaterial = isMaterial(pressureDelta);
  const stabilityMaterial = isMaterial(stabilityDelta);

  if (stabilityMaterial && !pressureMaterial) {
    return `Signal ${signalWordValue}; stability ${stabilityWordValue}.`;
  }

  if (pressureMaterial && stabilityMaterial) {
    return `Signal ${signalWordValue}; pressure ${pressureWordValue}; stability ${stabilityWordValue}.`;
  }

  return `Signal ${signalWordValue}; pressure ${pressureWordValue}.`;
}

function signalWord(delta: number): "improved" | "weakened" | "steady" {
  if (isSteady(delta)) return "steady";
  return delta > 0 ? "improved" : "weakened";
}

function pressureWord(delta: number): "rose" | "eased" | "steady" {
  if (isSteady(delta)) return "steady";
  return delta > 0 ? "rose" : "eased";
}

function stabilityWord(delta: number): "improved" | "fell" | "steady" {
  if (isSteady(delta)) return "steady";
  return delta > 0 ? "improved" : "fell";
}

function isSteady(delta: number): boolean {
  return Math.abs(delta) < STEADY_PP;
}

function isMaterial(delta: number): boolean {
  return Math.abs(delta) >= MATERIAL_PP;
}

function levelFromPct(value: number): "low" | "moderate" | "high" {
  if (value >= 66) return "high";
  if (value <= 33) return "low";
  return "moderate";
}
