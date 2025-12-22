import type { ConsistencyLabel } from "@/lib/adaptation";

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
    label: ConsistencyLabel;
    stddev?: number | null;
    previousStddev?: number | null;
  };
};

export type AdaptationCopyOutput = {
  headlineSummary: string;
  verdict: string;
  tendencyLabel: string;
  tendencyDefinition: string;
};

const STEADY_PP = 1.0;
const MATERIAL_PRESSURE_PP = 3.0;

export function buildAdaptationCopy(input: AdaptationCopyInput): AdaptationCopyOutput {
  const { hasPreviousWindow } = input;
  const { returnPosPP, pressurePressuredPP, stabilityStablePP } = input.deltas;

  if (
    !hasPreviousWindow ||
    returnPosPP === null ||
    pressurePressuredPP === null ||
    stabilityStablePP === null
  ) {
    return {
      headlineSummary: "Baseline established — log more decisions to compare.",
      verdict: "Add another window to measure adaptation.",
      tendencyLabel: "Baseline",
      tendencyDefinition: "First window; no prior comparison.",
    };
  }

  const returnTrend = toTrend(returnPosPP);
  const stabilityTrend = toTrend(stabilityStablePP);
  const pressureTrend = toTrend(pressurePressuredPP);

  const headlineSummary = buildHeadline(returnTrend, stabilityTrend);
  const verdict = buildVerdict(returnTrend, pressureTrend, stabilityTrend);
  const { tendencyLabel, tendencyDefinition } = buildTendency({
    returnDelta: returnPosPP,
    pressureDelta: pressurePressuredPP,
    stabilityDelta: stabilityStablePP,
    consistencyLabel: input.consistency.label,
    stddev: input.consistency.stddev ?? null,
    previousStddev: input.consistency.previousStddev ?? null,
  });

  return {
    headlineSummary,
    verdict,
    tendencyLabel,
    tendencyDefinition,
  };
}

type Trend = "up" | "down" | "steady";

function toTrend(delta: number): Trend {
  if (Math.abs(delta) < STEADY_PP) return "steady";
  return delta > 0 ? "up" : "down";
}

function buildHeadline(returnTrend: Trend, stabilityTrend: Trend): string {
  if (returnTrend === "up" && stabilityTrend === "down") {
    return "Higher upside is being achieved with lower repeatability.";
  }
  if (returnTrend === "up" && stabilityTrend === "up") {
    return "Upside improved with stronger structure.";
  }
  if (returnTrend === "down" && stabilityTrend === "up") {
    return "Structure improved while upside softened.";
  }
  if (returnTrend === "down" && stabilityTrend === "down") {
    return "Lower signal with weaker structure.";
  }
  if (returnTrend === "steady" && stabilityTrend === "up") {
    return "Structure improved while upside held steady.";
  }
  if (returnTrend === "steady" && stabilityTrend === "down") {
    return "Structure weakened while upside held steady.";
  }
  if (returnTrend === "up" && stabilityTrend === "steady") {
    return "Upside improved with similar structure.";
  }
  if (returnTrend === "down" && stabilityTrend === "steady") {
    return "Upside softened with similar structure.";
  }
  return "No meaningful shift in upside or structure.";
}

function buildVerdict(returnTrend: Trend, pressureTrend: Trend, stabilityTrend: Trend): string {
  if (returnTrend === "steady" && pressureTrend === "steady" && stabilityTrend === "steady") {
    return "No meaningful shift; pattern steady.";
  }

  if (returnTrend === "up") {
    if (pressureTrend === "down" && stabilityTrend === "down") {
      return "Upside improved and pressure eased, but structure weakened — expect more swing between decisions.";
    }
    if (pressureTrend === "up" && stabilityTrend === "down") {
      return "Upside improved under heavier pressure — results may be less repeatable.";
    }
    if (pressureTrend === "down" && stabilityTrend === "up") {
      return "Upside improved with calmer conditions and stronger structure.";
    }
    if (pressureTrend === "up" && stabilityTrend === "up") {
      return "Upside improved under heavier pressure with stronger structure.";
    }
    if (pressureTrend === "steady" && stabilityTrend === "down") {
      return "Upside improved, but structure weakened — expect more swing between decisions.";
    }
    if (pressureTrend === "steady" && stabilityTrend === "up") {
      return "Upside improved with stronger structure.";
    }
    if (pressureTrend === "down" && stabilityTrend === "steady") {
      return "Upside improved as pressure eased; structure held steady.";
    }
    if (pressureTrend === "up" && stabilityTrend === "steady") {
      return "Upside improved under heavier pressure; structure held steady.";
    }
    return "Upside improved with steady pressure and structure.";
  }

  if (returnTrend === "down") {
    if (pressureTrend === "down" && stabilityTrend === "up") {
      return "Structure improved as pressure eased, but upside softened.";
    }
    if (pressureTrend === "up" && stabilityTrend === "up") {
      return "Structure improved under heavier pressure, but upside softened.";
    }
    if (pressureTrend === "steady" && stabilityTrend === "up") {
      return "Structure improved while upside softened.";
    }
    if (pressureTrend === "down" && stabilityTrend === "down") {
      return "Upside softened with weaker structure — expect more swing between decisions.";
    }
    if (pressureTrend === "up" && stabilityTrend === "down") {
      return "Upside softened under heavier pressure with weaker structure — results may be less repeatable.";
    }
    if (pressureTrend === "steady" && stabilityTrend === "down") {
      return "Upside softened with weaker structure — expect more swing between decisions.";
    }
    if (pressureTrend === "down" && stabilityTrend === "steady") {
      return "Upside softened as pressure eased; structure held steady.";
    }
    if (pressureTrend === "up" && stabilityTrend === "steady") {
      return "Upside softened under heavier pressure; structure held steady.";
    }
    return "Upside softened with steady pressure and structure.";
  }

  if (pressureTrend === "down" && stabilityTrend === "up") {
    return "Structure improved as pressure eased; upside held steady.";
  }
  if (pressureTrend === "up" && stabilityTrend === "up") {
    return "Structure improved under heavier pressure; upside held steady.";
  }
  if (pressureTrend === "steady" && stabilityTrend === "up") {
    return "Structure improved while upside held steady.";
  }
  if (pressureTrend === "down" && stabilityTrend === "down") {
    return "Structure weakened even as pressure eased — expect more swing between decisions.";
  }
  if (pressureTrend === "up" && stabilityTrend === "down") {
    return "Structure weakened under heavier pressure — expect more swing between decisions.";
  }
  if (pressureTrend === "steady" && stabilityTrend === "down") {
    return "Structure weakened while upside held steady — expect more swing between decisions.";
  }
  if (pressureTrend === "up" && stabilityTrend === "steady") {
    return "Pressure rose while upside and structure held steady.";
  }
  if (pressureTrend === "down" && stabilityTrend === "steady") {
    return "Pressure eased while upside and structure held steady.";
  }
  return "No meaningful shift; pattern steady.";
}

function buildTendency({
  returnDelta,
  pressureDelta,
  stabilityDelta,
  consistencyLabel,
  stddev,
  previousStddev,
}: {
  returnDelta: number;
  pressureDelta: number;
  stabilityDelta: number;
  consistencyLabel: ConsistencyLabel;
  stddev: number | null;
  previousStddev: number | null;
}): { tendencyLabel: string; tendencyDefinition: string } {
  const steadyReturn = Math.abs(returnDelta) < STEADY_PP;
  const steadyPressure = Math.abs(pressureDelta) < STEADY_PP;
  const steadyStability = Math.abs(stabilityDelta) < STEADY_PP;

  if (steadyReturn && steadyPressure && steadyStability) {
    return {
      tendencyLabel: "Steady",
      tendencyDefinition: "No meaningful shift versus the prior window.",
    };
  }

  const consistencyDelta = resolveDelta(stddev, previousStddev);
  const consistencyWorse = consistencyDelta !== null && consistencyDelta > 0;
  const consistencyVolatile = consistencyLabel === "Volatile" || consistencyWorse;

  if (returnDelta > STEADY_PP && stabilityDelta < -STEADY_PP) {
    return {
      tendencyLabel: "Opportunistic",
      tendencyDefinition: "More upside, less repeatable structure.",
    };
  }

  if (returnDelta > STEADY_PP && pressureDelta >= MATERIAL_PRESSURE_PP) {
    return {
      tendencyLabel: "Asymmetric",
      tendencyDefinition: "Upside increased, but carried more pressure.",
    };
  }

  if (returnDelta > STEADY_PP && consistencyVolatile && stabilityDelta >= -STEADY_PP) {
    return {
      tendencyLabel: "Exploratory",
      tendencyDefinition: "Testing variations; outcomes may swing.",
    };
  }

  if (consistencyVolatile) {
    return {
      tendencyLabel: "High-variance",
      tendencyDefinition: "Decision quality swings more from one decision to the next.",
    };
  }

  return {
    tendencyLabel: "Steady",
    tendencyDefinition: "No meaningful shift versus the prior window.",
  };
}

function resolveDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}
