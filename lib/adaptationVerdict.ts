import { getDeltaDirection } from "@/lib/compare/adaptation";

const VERDICT_EPSILON = 1;

export type AdaptationVerdictInputs = {
  hasPrevious: boolean;
  returnDelta: number;
  pressureDelta: number;
  stabilityDelta: number;
};

// Adaptation evaluates legibility, not ambition.
export function buildAdaptationVerdict({
  hasPrevious,
  returnDelta,
  pressureDelta,
  stabilityDelta,
}: AdaptationVerdictInputs): string {
  if (!hasPrevious) {
    return "Not enough history to compare yet.";
  }

  const returnDirection = getDeltaDirection(returnDelta, VERDICT_EPSILON);
  const pressureDirection = getDeltaDirection(pressureDelta, VERDICT_EPSILON);
  const stabilityDirection = getDeltaDirection(stabilityDelta, VERDICT_EPSILON);

  const pressurePhrase =
    pressureDirection === "down"
      ? "pressure eased"
      : pressureDirection === "up"
        ? "pressure intensified"
        : "pressure held steady";

  const stabilityPhrase =
    stabilityDirection === "up"
      ? "stability improved"
      : stabilityDirection === "down"
        ? "stability softened"
        : "stability held steady";

  if (returnDirection === "up" && pressureDirection === "down") {
    return "Signal strengthened while pressure eased. This window reads more legibly.";
  }

  if (pressureDirection === "up" && stabilityDirection === "down") {
    return "Pressure intensified without added stability. Reliability may feel strained.";
  }

  if (returnDirection === "up" && stabilityDirection === "down") {
    return "Mixed shift: signal improved but stability fell; expect more swing.";
  }

  if (returnDirection === "down" && pressureDirection === "up") {
    return "Signal softened as pressure intensified; legibility is harder to read.";
  }

  if (returnDirection === "down" && stabilityDirection === "down") {
    return "Signal softened and stability fell; reliability may feel noisier.";
  }

  if (returnDirection === "up" && stabilityDirection !== "down") {
    return `Signal strengthened with ${stabilityPhrase}; legibility looks clearer.`;
  }

  return `Signal held steady with ${pressurePhrase} and ${stabilityPhrase}.`;
}
