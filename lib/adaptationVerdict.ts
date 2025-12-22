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
    return "Signal up; pressure eased.";
  }

  if (pressureDirection === "up" && stabilityDirection === "down") {
    return "Pressure up; stability down.";
  }

  if (returnDirection === "up" && stabilityDirection === "down") {
    return "Signal up; stability down.";
  }

  if (returnDirection === "down" && pressureDirection === "up") {
    return "Signal down; pressure up.";
  }

  if (returnDirection === "down" && stabilityDirection === "down") {
    return "Signal down; stability down.";
  }

  if (returnDirection === "up" && stabilityDirection !== "down") {
    return `Signal up; ${stabilityPhrase}.`;
  }

  return `Signal steady; ${pressurePhrase}; ${stabilityPhrase}.`;
}
