export type CategoryActionInsight = {
  signal: "Strong" | "Mixed" | "Weak";
  posture: string;
  leverage: {
    primary:
      | "Impact"
      | "Cost"
      | "Risk"
      | "Urgency"
      | "Confidence"
      | "Return"
      | "Pressure"
      | "Stability";
    reason: string;
  };
  risks: string[];
  guidance: string[];
};

export type CategoryActionInsightInput = {
  shareOfVolume?: number;
  avgDnav: number;
  avgR: number;
  avgP: number;
  avgS: number;
  dominantFactor?: string | null;
};

export type CategoryActionInsightBaseline = {
  avgDnav: number;
  avgR: number;
  avgP: number;
  avgS: number;
};

const addUnique = (list: string[], value: string) => {
  if (!list.includes(value)) {
    list.push(value);
  }
};

const getVolumePrefix = () => "";

const getPosture = (
  input: CategoryActionInsightInput,
  baseline: CategoryActionInsightBaseline,
) => {
  const prefix = getVolumePrefix();
  const isStable = input.avgS >= baseline.avgS;
  const isCalm = input.avgP <= baseline.avgP;
  const isHighReturn = input.avgR >= baseline.avgR;

  if (isHighReturn && isCalm && isStable) {
    return `${prefix}stable execution with favorable return.`;
  }
  if (isHighReturn && !isCalm) {
    return `${prefix}high return but pressured execution; posture trends volatile.`;
  }
  if (!isHighReturn && isStable && isCalm) {
    return `${prefix}stable execution with muted return.`;
  }
  if (!isStable && isCalm) {
    return `${prefix}low pressure but stability is thinning; base needs protection.`;
  }
  if (!isStable && !isCalm) {
    return `${prefix}pressured, unstable execution; posture is fragile.`;
  }
  return `${prefix}mixed return with uneven pressure and stability.`;
};

const getSignal = (input: CategoryActionInsightInput, baseline: CategoryActionInsightBaseline) => {
  const signals = [
    input.avgS >= baseline.avgS,
    input.avgP <= baseline.avgP,
    input.avgDnav >= baseline.avgDnav,
  ].filter(Boolean).length;

  if (signals >= 3) return "Strong";
  if (signals === 2) return "Mixed";
  return "Weak";
};

const getLeverage = (
  input: CategoryActionInsightInput,
  baseline: CategoryActionInsightBaseline,
): CategoryActionInsight["leverage"] => {
  const isStable = input.avgS >= baseline.avgS;
  const isCalm = input.avgP <= baseline.avgP;

  if (input.avgR < baseline.avgR && isStable && isCalm) {
    return {
      primary: "Return",
      reason: "return trails baseline while stability holds",
    };
  }

  if (!isCalm) {
    if (!isStable) {
      return {
        primary: "Stability",
        reason: "pressure is elevated and stability is below baseline",
      };
    }
    return {
      primary: "Urgency",
      reason: "pressure runs above baseline",
    };
  }

  if (!isStable) {
    return {
      primary: "Stability",
      reason: "stability is below baseline",
    };
  }

  if (input.avgR >= baseline.avgR && isStable && isCalm) {
    return {
      primary: "Impact",
      reason: "room to compound value without added pressure",
    };
  }

  return {
    primary: "Risk",
    reason: "signals are mixed across return, pressure, and stability",
  };
};

const getDominantRisk = (dominantFactor?: string | null) => {
  switch (dominantFactor) {
    case "Confidence":
      return "confidence overfitting / narrative lock-in";
    case "Urgency":
      return "pressure drift";
    case "Risk":
      return "fragility accumulation";
    case "Cost":
      return "under-investment / false efficiency";
    default:
      return null;
  }
};

const getGuidanceForLeverage = (primary: CategoryActionInsight["leverage"]["primary"]) => {
  switch (primary) {
    case "Return":
    case "Impact":
      return [
        "Increase impact per decision (bundle moves or narrow scope).",
        "Raise evidence on highest-stakes calls.",
      ];
    case "Urgency":
      return [
        "Reduce urgency drivers (clear blockers or trim scope).",
        "Sequence commitments to avoid pressure stacking.",
      ];
    case "Stability":
      return [
        "Protect stability before scaling scope.",
        "Add buffers or redundancy to reduce volatility.",
      ];
    case "Risk":
      return [
        "De-risk downside before expanding volume.",
        "Tighten thresholds on downside exposure.",
      ];
    case "Confidence":
      return ["Raise evidence on highest-stakes calls."];
    case "Cost":
      return ["Invest in critical inputs to avoid false efficiency."];
    case "Pressure":
      return ["Reduce pressure drivers before adding scope."];
    default:
      return ["Clarify decision thresholds before scaling volume."];
  }
};

const getDominantGuidance = (dominantFactor?: string | null) => {
  switch (dominantFactor) {
    case "Confidence":
      return "Raise evidence on highest-stakes calls.";
    case "Urgency":
      return "Avoid adding urgency; keep execution calm as volume rises.";
    case "Risk":
      return "De-risk largest bets before scaling volume.";
    case "Cost":
      return "Invest in critical inputs to avoid false efficiency.";
    default:
      return null;
  }
};

export const buildCategoryActionInsight = (
  input: CategoryActionInsightInput,
  baseline: CategoryActionInsightBaseline,
): CategoryActionInsight => {
  const signal = getSignal(input, baseline);
  const leverage = getLeverage(input, baseline);
  const posture = getPosture(input, baseline);
  const risks: string[] = [];

  if (input.avgP > baseline.avgP) {
    addUnique(risks, "pressure drift");
  }
  if (input.avgS < baseline.avgS) {
    addUnique(risks, "fragility accumulation");
  }
  if (input.avgR < baseline.avgR) {
    addUnique(risks, "value leakage");
  }
  if (input.avgDnav < baseline.avgDnav) {
    addUnique(risks, "decision quality slide");
  }

  const dominantRisk = getDominantRisk(input.dominantFactor);
  if (dominantRisk) {
    addUnique(risks, dominantRisk);
  }

  const guidance: string[] = [];
  getGuidanceForLeverage(leverage.primary).forEach((line) => addUnique(guidance, line));

  const dominantGuidance = getDominantGuidance(input.dominantFactor);
  if (dominantGuidance) {
    addUnique(guidance, dominantGuidance);
  }

  if (guidance.length < 2) {
    addUnique(guidance, "Clarify decision thresholds before scaling volume.");
    addUnique(guidance, "Focus scope on highest-return decisions.");
  }

  return {
    signal,
    posture,
    leverage,
    risks: risks.slice(0, 3),
    guidance: guidance.slice(0, 4),
  };
};
