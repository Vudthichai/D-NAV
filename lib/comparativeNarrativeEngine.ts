import { type CompanyPeriodSnapshot as SystemSnapshot } from "@/lib/dnavSummaryEngine";

type RpsBlock = {
  returnScore: number;
  pressureScore: number;
  stabilityScore: number;
  dnavScore: number;
};

function snapshotToRpsBlock(snapshot: SystemSnapshot): RpsBlock {
  const baseline = snapshot.rpsBaseline;

  return {
    returnScore: baseline.avgReturn,
    pressureScore: baseline.avgPressure,
    stabilityScore: baseline.avgStability,
    dnavScore: baseline.avgDnav,
  };
}

export type ComparativeContext = "timeframe" | "cross-system" | "benchmark";

export type ComparativeNarrative = {
  context: ComparativeContext;
  headline: string;
  physicsSummary: string;
  postureSummary: string;
  terrainSummary: string;
  archetypeSummary: string;
  learningSummary: string;
  keyBullets: string[];
};

type DeltaSize = "none" | "small" | "moderate" | "large";

type RpsDelta = {
  returnDelta: number;
  pressureDelta: number;
  stabilityDelta: number;
  dnavDelta: number;
};

type LearningDelta = {
  learningIndexDelta: number | null;
  recoveryDelta: number | null;
};

const adverbForDelta: Record<DeltaSize, string> = {
  none: "flat",
  small: "slightly",
  moderate: "meaningfully",
  large: "materially",
};

const directionLabel = (delta: number, positive: string, negative: string): string => {
  if (Math.abs(delta) < 1e-6) return "flat";
  return delta > 0 ? positive : negative;
};

export function classifyDelta(delta: number): DeltaSize {
  const abs = Math.abs(delta);
  if (abs < 0.1) return "none";
  if (abs < 0.3) return "small";
  if (abs < 0.6) return "moderate";
  return "large";
}

export function directionWord(delta: number, upWord: string, downWord: string): string {
  if (Math.abs(delta) < 1e-6) return "flat";
  return delta > 0 ? upWord : downWord;
}

function buildRpsDelta(a: RpsBlock, b: RpsBlock): RpsDelta {
  return {
    returnDelta: b.returnScore - a.returnScore,
    pressureDelta: b.pressureScore - a.pressureScore,
    stabilityDelta: b.stabilityScore - a.stabilityScore,
    dnavDelta: b.dnavScore - a.dnavScore,
  };
}

function buildLearningDelta(a: SystemSnapshot, b: SystemSnapshot): LearningDelta {
  const aLearning = a.learning ?? null;
  const bLearning = b.learning ?? null;

  const learningIndexDelta =
    bLearning &&
    bLearning.learningIndex != null &&
    aLearning &&
    aLearning.learningIndex != null
      ? bLearning.learningIndex - aLearning.learningIndex
      : null;

  const recoveryDelta =
    bLearning &&
    bLearning.avgRecoveryDecisions != null &&
    aLearning &&
    aLearning.avgRecoveryDecisions != null
      ? bLearning.avgRecoveryDecisions - aLearning.avgRecoveryDecisions
      : null;

  return { learningIndexDelta, recoveryDelta };
}

function describeDelta(metric: string, delta: number, higherPhrase: string, lowerPhrase: string): string {
  const size = classifyDelta(delta);
  if (size === "none") {
    return `${metric} stays roughly flat.`;
  }
  const direction = delta > 0 ? higherPhrase : lowerPhrase;
  return `${metric} ${adverbForDelta[size]} ${direction}.`;
}

function buildPhysicsSummary(a: SystemSnapshot, b: SystemSnapshot, context: ComparativeContext): string {
  const { returnDelta, pressureDelta, stabilityDelta, dnavDelta } =
    buildRpsDelta(snapshotToRpsBlock(a), snapshotToRpsBlock(b));

  const aLabel = `${a.companyName} · ${a.periodLabel}`;
  const bLabel = `${b.companyName} · ${b.periodLabel}`;

  const pressureDirection = directionLabel(pressureDelta, "higher-pressure", "lower-pressure");
  const stabilityDirection = directionLabel(stabilityDelta, "higher-stability", "lower-stability");
  const postureLine = `System ${bLabel} shifts into a ${pressureDirection}, ${stabilityDirection} configuration versus ${aLabel}.`;

  const returnLine = describeDelta("Return", returnDelta, "improves", "pulls back");
  const stabilityLine = describeDelta("Stability", stabilityDelta, "improves", "erodes");
  const pressureLine = describeDelta("Pressure", pressureDelta, "intensifies", "releases");
  const dnavLine = describeDelta("D-NAV", dnavDelta, "rises", "falls");

  const details = [returnLine, pressureLine, stabilityLine, dnavLine].join(" ");

  if (context === "benchmark") {
    return details;
  }

  return details;
}



export function classifyPosture(rps: RpsBlock):
  | "calm & repeatable"
  | "strained & reactive"
  | "aggressive & volatile"
  | "disciplined compounding"
  | "fragile"
  | "balanced" {
  const { returnScore, pressureScore, stabilityScore } = rps;
  if (pressureScore < -0.2 && stabilityScore > 0.3) return "calm & repeatable";
  if (pressureScore > 0.6 && stabilityScore < 0) return "strained & reactive";
  if (returnScore > 0.6 && stabilityScore < 0.1 && pressureScore > 0.3) return "aggressive & volatile";
  if (returnScore > 0.6 && stabilityScore > 0.6 && pressureScore >= 0) return "disciplined compounding";
  if (stabilityScore < -0.5 && (pressureScore > 0.2 || returnScore < -0.2)) return "fragile";
  return "balanced";
}

function buildPostureSummary(a: SystemSnapshot, b: SystemSnapshot, context: ComparativeContext): string {
  const postureA = classifyPosture(snapshotToRpsBlock(a));
  const postureB = classifyPosture(snapshotToRpsBlock(b));

  const aLabel = `${a.companyName} · ${a.periodLabel}`;
  const bLabel = `${b.companyName} · ${b.periodLabel}`;

  const postureLine =
    postureA === postureB
      ? `System ${bLabel} holds a ${postureB} posture similar to ${aLabel}, keeping behavioral physics consistent.`
      : `System ${bLabel} shifts posture from ${postureA} to ${postureB} versus ${aLabel}.`;

  return postureLine;
}



function topCategories(categories: SystemSnapshot["categories"], limit = 3) {
  return [...categories]
    .sort((a, b) => b.decisionCount - a.decisionCount)
    .slice(0, limit);
}

function buildTerrainSummary(a: SystemSnapshot, b: SystemSnapshot, context: ComparativeContext): string {
  const totalA = a.categories.reduce((sum, cat) => sum + cat.decisionCount, 0) || 1;
  const totalB = b.categories.reduce((sum, cat) => sum + cat.decisionCount, 0) || 1;
  const topA = topCategories(a.categories, 3);
  const topB = topCategories(b.categories, 3);
  const categoryNames = new Set([...topA, ...topB].map((c) => c.name));

  const gains: string[] = [];
  const losses: string[] = [];
  categoryNames.forEach((name) => {
    const aShare = (a.categories.find((c) => c.name === name)?.decisionCount ?? 0) / totalA;
    const bShare = (b.categories.find((c) => c.name === name)?.decisionCount ?? 0) / totalB;
    const delta = bShare - aShare;
    if (delta > 0.02) gains.push(name);
    if (delta < -0.02) losses.push(name);
  });

  const leadB = topB.map((c) => c.name).join(", ");
  const leadA = topA.map((c) => c.name).join(", ");
  const gainText = gains.length ? `Energy tilts toward ${gains.join(", ")}` : "Energy mix stays stable";
  const lossText = losses.length ? `while ${losses.join(", ")} lose share` : "with no major pullbacks";

    const aLabel = `${a.companyName} · ${a.periodLabel}`;
  const bLabel = `${b.companyName} · ${b.periodLabel}`;

  const comparison =
    context === "cross-system"
      ? `System ${bLabel} concentrates on ${leadB}, whereas System ${aLabel} leans into ${leadA}.`
      : `System ${bLabel} now emphasizes ${leadB} versus ${leadA} previously.`;

  return `${comparison} ${gainText} ${lossText}.`;
}


function dominantArchetypes(archetypes: SystemSnapshot["archetypes"], limit = 2) {
    return [...archetypes]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, limit);
}

function buildArchetypeSummary(a: SystemSnapshot, b: SystemSnapshot, context: ComparativeContext): string {
  const topA = dominantArchetypes(a.archetypes);
  const topB = dominantArchetypes(b.archetypes);
  const leadA = topA.map((a) => a.name).join(" / ");
  const leadB = topB.map((a) => a.name).join(" / ");

  const deltaPrimary = topB[0] && topA[0]
    ? topB[0].percentage - topA[0].percentage
    : 0;
  const posture = classifyDelta(deltaPrimary);
  const direction = deltaPrimary > 0 ? "dominates more" : deltaPrimary < 0 ? "gives back ground" : "remains steady";

  const aLabel = `${a.companyName} ${a.periodLabel}`;
  const bLabel = `${b.companyName} ${b.periodLabel}`;

  const descriptor = context === "benchmark"
  ? `${bLabel} expresses a ${leadB} fingerprint relative to benchmark ${aLabel}`
  : `${bLabel} expresses ${leadB} while ${aLabel} shows ${leadA}`;

  return `${descriptor}, where the lead archetype ${direction} ${posture === "none" ? "with minimal change" : adverbForDelta[posture]} against the comparator.`;
}

function buildLearningSummary(a: SystemSnapshot, b: SystemSnapshot, context: ComparativeContext): string {
  const { learningIndexDelta, recoveryDelta } = buildLearningDelta(a, b);
  if (learningIndexDelta == null && recoveryDelta == null) {
    return "Learning signals are unavailable for one or both systems.";
  }
  const learningPhrase = learningIndexDelta == null
    ? "Learning index is unchanged due to missing data"
    : describeDelta("Learning index", learningIndexDelta, "strengthens", "softens");
  const recoveryPhrase = recoveryDelta == null
    ? "recovery depth cannot be compared"
    : describeDelta("Average recovery decisions", recoveryDelta, "lengthens", "shortens");

  const aLabel = `${a.companyName} ${a.periodLabel}`;
const bLabel = `${b.companyName} ${b.periodLabel}`;

const lead = context === "timeframe"
  ? `${bLabel} shows an updated learning loop versus ${aLabel}.`
  : `${bLabel} operates with a distinct learning tempo versus ${aLabel}.`;

return `${lead} ${learningPhrase} ${recoveryPhrase}.`;
}

function buildHeadline(
  a: SystemSnapshot,
  b: SystemSnapshot,
  context: ComparativeContext,
  rpsDelta: RpsDelta,
): string {
  const hotness = directionWord(rpsDelta.pressureDelta, "runs hotter", "runs cooler");
    const intent = directionWord(rpsDelta.dnavDelta, "more intentional", "less intentional");

  const aLabel = `${a.companyName} ${a.periodLabel}`;
  const bLabel = `${b.companyName} ${b.periodLabel}`;

  if (context === "timeframe") {
    return `${bLabel} is ${hotness} and ${intent} than ${aLabel}.`;
  }

  if (context === "cross-system") {
    return `${bLabel} and ${aLabel} operate with different judgment engines — ${bLabel} is ${hotness} and ${intent}.`;
  }

  return `${bLabel} diverges from benchmark ${aLabel}, operating ${hotness} and ${intent}.`;
}

function gatherBullets(summary: string[]): string[] {
  return summary.filter(Boolean).slice(0, 4);
}

export function buildComparativeNarrative(
  a: SystemSnapshot,
  b: SystemSnapshot,
  context: ComparativeContext,
): ComparativeNarrative {
  const rpsDelta = buildRpsDelta(snapshotToRpsBlock(a), snapshotToRpsBlock(b));
  const physicsSummary = buildPhysicsSummary(a, b, context);
  const postureSummary = buildPostureSummary(a, b, context);
  const terrainSummary = buildTerrainSummary(a, b, context);
  const archetypeSummary = buildArchetypeSummary(a, b, context);
  const learningSummary = buildLearningSummary(a, b, context);
  const headline = buildHeadline(a, b, context, rpsDelta);

  const keyBullets = gatherBullets([
    physicsSummary,
    postureSummary,
    terrainSummary,
    archetypeSummary,
  ]);

  return {
    context,
    headline,
    physicsSummary,
    postureSummary,
    terrainSummary,
    archetypeSummary,
    learningSummary,
    keyBullets,
  };
}
