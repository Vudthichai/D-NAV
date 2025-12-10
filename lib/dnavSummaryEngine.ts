// D-NAV summary engine for generating executive-grade interpretations across RPS, categories, archetypes, and learning.
import { type CompanyContext } from "@/types/company";
import {
  type ArchetypePatternRow,
  type CategoryHeatmapRow,
  type RpsBaseline as JudgmentRpsBaseline,
} from "@/utils/judgmentDashboard";

// Helper clamp to avoid external dependencies
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export interface Distribution {
  positivePct: number; // 0–100
  neutralPct: number; // 0–100
  negativePct: number; // 0–100
}

export interface RpsBaseline {
  totalDecisions: number;
  avgDnav: number;
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
  returnDist: Distribution;
  pressureDist: Distribution;
  stabilityDist: Distribution;
}

export interface CategoryStat {
  name: string;
  decisionCount: number;
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
  totalDnav?: number;
  merit?: number;
  energy?: number;
}

export interface ArchetypeCluster {
  name: string;
  percentage: number;
}

export interface LearningRecoveryStats {
  averageRecoveryDecisions: number;
  winRate: number; // 0–100
  decisionDebtIndex?: number; // 0–1; higher = more lingering damage
}

export interface CompanyPeriodSnapshot {
  companyName: string;
  periodLabel: string;
  rpsBaseline: RpsBaseline;
  categories: CategoryStat[];
  archetypes: ArchetypeCluster[];
  learningRecovery?: LearningRecoveryStats;
}

export interface BuildCompanyPeriodSnapshotOptions {
  company?: CompanyContext | null;
  baseline: JudgmentRpsBaseline;
  categories: CategoryHeatmapRow[];
  archetypes: ArchetypePatternRow[];
  learning: {
    lci: number | null;
    decisionsToRecover: number;
    winRate: number;
    decisionDebt: number;
  };
  timeframeKey: string;
  timeframeLabel?: string;
}

export function buildCompanyPeriodSnapshot({
  company,
  baseline,
  categories,
  archetypes,
  learning,
  timeframeKey,
  timeframeLabel,
}: BuildCompanyPeriodSnapshotOptions): CompanyPeriodSnapshot {
  const distributionFromSegments = (segments: { metricKey: string; value: number }[]) => {
    const positivePct = segments.find((segment) => segment.metricKey === "positive")?.value ?? 0;
    const neutralPct = segments.find((segment) => segment.metricKey === "neutral")?.value ?? 0;
    const negativePct = segments.find((segment) => segment.metricKey === "negative")?.value ?? 0;
    return { positivePct, neutralPct, negativePct };
  };

  const totalArchetypeDecisions = archetypes.reduce((sum, row) => sum + row.count, 0);

  return {
    companyName: company?.companyName ?? "Your Company",
    periodLabel: company?.timeframeLabel ?? timeframeLabel ?? timeframeKey,
    rpsBaseline: {
      totalDecisions: baseline.total,
      avgDnav: baseline.avgDnav,
      avgReturn: baseline.avgReturn,
      avgPressure: baseline.avgPressure,
      avgStability: baseline.avgStability,
      returnDist: distributionFromSegments(baseline.returnSegments),
      pressureDist: distributionFromSegments(baseline.pressureSegments),
      stabilityDist: distributionFromSegments(baseline.stabilitySegments),
    },
    categories: categories.map((category) => ({
      name: category.category,
      decisionCount: category.decisionCount,
      avgReturn: category.avgR,
      avgPressure: category.avgP,
      avgStability: category.avgS,
      totalDnav: category.avgDnav * category.decisionCount,
    })),
    archetypes: archetypes.map((row) => ({
      name: row.archetype,
      percentage: totalArchetypeDecisions ? (row.count / totalArchetypeDecisions) * 100 : 0,
    })),
    learningRecovery: {
      averageRecoveryDecisions: learning.decisionsToRecover,
      winRate: learning.winRate,
      decisionDebtIndex: Number.isFinite(learning.decisionDebt)
        ? clamp(learning.decisionDebt / 100, 0, 1)
        : undefined,
    },
  };
}

export interface SystemCompareSummary {
  labelA: string;
  labelB: string;
  postureLine: string;
  terrainLine: string;
  archetypeLine: string;
  learningLine: string;
}

function classifyDistribution(dist: Distribution): {
  label: "dominantPositive" | "leanPositive" | "balanced" | "leanNegative" | "dominantNegative";
} {
  const { positivePct, neutralPct, negativePct } = dist;
  const maxVal = Math.max(positivePct, neutralPct, negativePct);
  if (maxVal >= 70) {
    if (maxVal === positivePct) return { label: "dominantPositive" };
    if (maxVal === negativePct) return { label: "dominantNegative" };
    return { label: "balanced" };
  }
  if (maxVal >= 55) {
    if (maxVal === positivePct) return { label: "leanPositive" };
    if (maxVal === negativePct) return { label: "leanNegative" };
    return { label: "balanced" };
  }
  return { label: "balanced" };
}

function isStableSample(totalDecisions: number): boolean {
  return totalDecisions >= 100;
}

function describePressure(avgPressure: number, dist: Distribution): string {
  const { label } = classifyDistribution(dist);
  if (avgPressure <= -2 && (label === "dominantNegative" || label === "leanNegative")) {
    return "decisions are made with time and slack rather than urgency";
  }
  if (avgPressure < 0 && label !== "dominantPositive") {
    return "pressure is generally low, with most choices avoiding time-compressed fire drills";
  }
  if (avgPressure >= 2 && (label === "dominantPositive" || label === "leanPositive")) {
    return "the system runs hot, making decisions under consistent urgency";
  }
  if (avgPressure > 0) {
    return "pressure tilts positive, indicating a more reactive internal tempo when it matters";
  }
  return "pressure sits near neutral, giving the system flexibility to dial tempo up or down";
}

function describeStability(avgStability: number, dist: Distribution): string {
  const { label } = classifyDistribution(dist);
  if (avgStability >= 2 && (label === "dominantPositive" || label === "leanPositive")) {
    return "decisions land on stable footing and preserve the operating base";
  }
  if (avgStability > 0) {
    return "stability leans positive; the system tends to recover and hold its footing over time";
  }
  if (avgStability <= -2 && (label === "dominantNegative" || label === "leanNegative")) {
    return "decisions frequently destabilize the system, eroding structural footing";
  }
  if (avgStability < 0) {
    return "stability leans negative, suggesting that missteps linger longer than they should";
  }
  return "stability stays roughly balanced — not fragile, but not strongly protected either";
}

function describeReturn(avgReturn: number, dist: Distribution): string {
  const { label } = classifyDistribution(dist);
  if (avgReturn >= 2 && (label === "dominantPositive" || label === "leanPositive")) {
    return "the return profile is clearly positive; most decisions create meaningful value";
  }
  if (avgReturn > 0) {
    return "return is modest but consistently positive; the system prefers repeatable wins over big swings";
  }
  if (avgReturn <= -1 && (label === "dominantNegative" || label === "leanNegative")) {
    return "return trends negative; the decision engine is destroying value more often than it creates it";
  }
  if (avgReturn < 0) {
    return "return leans negative; upside is present but overshadowed by mistakes and drag";
  }
  return "return hovers near neutral; the system is burning effort without clearly compounding value yet";
}

function buildRpsSignatureLine(avgR: number, avgP: number, avgS: number): string {
  const r = avgR;
  const p = avgP;
  const s = avgS;

  // Helpful thresholds
  const highR = r >= 1;
  const modestR = r > 0 && r < 1;
  const lowR = r <= 0;

  const veryLowP = p <= -2;
  const lowP = p < 0 && p > -2;
  const highP = p >= 2;

  const highS = s >= 2;
  const lowS = s <= -1;

  // Calm, compounding posture
  if ((highR || modestR) && (veryLowP || lowP) && highS) {
    return "They lean on calm, repeatable execution rather than high-volatility swings.";
  }

  // High return, high pressure, fragile footing
  if (highR && highP && lowS) {
    return "They push for upside by running hot and accepting a more fragile operating base.";
  }

  // High return, high pressure, still stable
  if (highR && highP && !lowS) {
    return "They tolerate sustained pressure to drive returns while working to keep the system stable.";
  }

  // Low/negative return under pressure and instability
  if (lowR && highP && lowS) {
    return "They absorb a lot of pressure, lose stability, and struggle to turn effort into durable gains.";
  }

  // Modest positive return with neutral posture
  if (modestR && !highP && !veryLowP && !highS && !lowS) {
    return "They operate as a modest compounder with plenty of flexibility left to adjust tempo and risk.";
  }

  // Default catch-all when posture is genuinely ambiguous
  return "Their judgment posture is still mixed — the system hasn’t settled into a clear pattern yet.";
}

export function generateRpsBaselineSummary(
  companyName: string,
  periodLabel: string,
  rps: RpsBaseline,
): string {
  const { totalDecisions, avgDnav, avgReturn, avgPressure, avgStability, returnDist, pressureDist, stabilityDist } = rps;

  if (!totalDecisions || totalDecisions <= 0) {
    return `${companyName}'s decision physics for ${periodLabel} are not yet measurable — there aren't enough logged decisions to read a real pattern.`;
  }

  const stable = isStableSample(totalDecisions);
  const sampleDescriptor = stable ? "system-level baseline" : "early snapshot";

  const returnLine = describeReturn(avgReturn, returnDist);
  const pressureLine = describePressure(avgPressure, pressureDist);
  const stabilityLine = describeStability(avgStability, stabilityDist);
  const signatureLine = buildRpsSignatureLine(avgReturn, avgPressure, avgStability);

  return [
    `${companyName}'s ${sampleDescriptor} for ${periodLabel} covers ${totalDecisions} decisions with an average D-NAV of ${avgDnav.toFixed(1)}. Return sits at ${avgReturn.toFixed(1)}, pressure at ${avgPressure.toFixed(1)}, and stability at ${avgStability.toFixed(1)}.`,
    `${capitalize(returnLine)} At the same time, ${pressureLine}, and ${stabilityLine}.`,
    signatureLine,
  ].join(" ");
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateCategoryProfileSummary(
  companyName: string,
  periodLabel: string,
  categories: CategoryStat[],
): string {
  if (!categories || categories.length === 0) {
    return `For ${periodLabel}, ${companyName} hasn't logged enough categorized decisions to map where judgment load actually sits.`;
  }

  const totalDecisions = categories.reduce((sum, c) => sum + c.decisionCount, 0);
  if (totalDecisions === 0) {
    return `For ${periodLabel}, ${companyName}'s category-level decision data is present but effectively empty.`;
  }

  const sorted = [...categories].sort((a, b) => b.decisionCount - a.decisionCount);
  const primary = sorted.slice(0, 3).filter((c) => c.decisionCount > 0);

  const primaryNames = primary.map((c) => c.name);
  const primaryShare = primary.reduce((sum, c) => sum + c.decisionCount, 0);
  const primaryPct = (primaryShare / totalDecisions) * 100;

  const primaryFragment = primaryNames.length
    ? `Most of ${companyName}'s judgment load in ${periodLabel} sits in ${primaryNames.join(", ")}, which together account for roughly ${primaryPct.toFixed(0)}% of all decisions.`
    : `${companyName}'s decisions are thinly spread across many categories without a clear center of gravity.`;

  const meaningful = sorted.filter((c) => c.decisionCount >= Math.max(5, totalDecisions * 0.05));
  let edgeFragment = "";
  if (meaningful.length > 0) {
    const best = meaningful.slice().sort((a, b) => b.avgReturn - a.avgReturn)[0];
    const worst = meaningful.slice().sort((a, b) => a.avgReturn - b.avgReturn)[0];
    if (best && worst && best.name !== worst.name) {
      edgeFragment = `The clearest edge shows up in ${best.name}, where return trends strongest, while ${worst.name} burns more effort for less payoff.`;
    } else if (best) {
      edgeFragment = `The strongest return signal concentrates in ${best.name}, where decisions tend to compound value more reliably than elsewhere.`;
    }
  }

  return [
    primaryFragment,
    edgeFragment || "",
    `This category profile reveals where ${companyName} actually competes internally — the arenas where its judgment can either compound or quietly leak value.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function generateArchetypeProfileSummary(
  companyName: string,
  periodLabel: string,
  archetypes: ArchetypeCluster[],
): string {
  if (!archetypes || archetypes.length === 0) {
    return `For ${periodLabel}, ${companyName} hasn't expressed a clear decision archetype yet — the pattern is still too fragmented to name.`;
  }

  const sorted = [...archetypes].sort((a, b) => b.percentage - a.percentage);
  const primary = sorted[0];
  const secondary = sorted[1] && sorted[1].percentage >= 20 ? sorted[1] : undefined;

  let baseLine = `${companyName}'s decisions in ${periodLabel} express a primary archetype of ${primary.name}`;
  if (secondary) {
    baseLine += `, with a secondary pull toward ${secondary.name}.`;
  } else {
    baseLine += ".";
  }

  const behaviorFragments: string[] = [];
  const primaryName = primary.name.toLowerCase();

  if (primaryName.includes("calm") || primaryName.includes("compounder")) {
    behaviorFragments.push("This is a system that prefers calm compounding over dramatic swings.");
  }
  if (primaryName.includes("pressured") || primaryName.includes("gambler")) {
    behaviorFragments.push("There is a visible tolerance for pressure and volatility when chasing upside.");
  }
  if (primaryName.includes("stable") || primaryName.includes("protector")) {
    behaviorFragments.push("Stability is treated as a strategic asset, not an afterthought.");
  }
  if (primaryName.includes("volatile") || primaryName.includes("builder")) {
    behaviorFragments.push("The organization leans into build cycles even when the ground is moving under it.");
  }

  const behaviorLine = behaviorFragments.join(" ");

  return [
    baseLine,
    behaviorLine,
    `Together, these archetypes form ${companyName}'s behavioral fingerprint for ${periodLabel} — how it seeks gain, absorbs pressure, and treats stability when making real calls.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function generateLearningRecoverySummary(
  companyName: string,
  periodLabel: string,
  stats?: LearningRecoveryStats,
): string {
  if (!stats) {
    return `Learning and recovery behavior for ${companyName} in ${periodLabel} isn't fully mapped yet — there isn't enough post-decision data to read how quickly the system corrects itself.`;
  }

  const { averageRecoveryDecisions, winRate, decisionDebtIndex } = stats;
  const win = clamp(winRate, 0, 100);

  let recoveryLine = "";
  if (averageRecoveryDecisions <= 2) {
    recoveryLine = "The system recovers quickly; mistakes are absorbed and course-corrected within a couple of calls.";
  } else if (averageRecoveryDecisions <= 5) {
    recoveryLine = "Recovery is steady; the organization fixes direction over a small cluster of follow-up decisions.";
  } else {
    recoveryLine = "Recovery is slow; errors linger across multiple decisions before the system stabilizes again.";
  }

  let resilienceLine = "";
  if (win >= 65) {
    resilienceLine = "A high learning win rate signals adaptive leadership — most follow-on decisions improve the situation rather than dig the hole deeper.";
  } else if (win >= 50) {
    resilienceLine = "Learning is mixed; roughly half of follow-on decisions move things in the right direction.";
  } else {
    resilienceLine = "Learning is weak; follow-on decisions often fail to repair the damage and sometimes extend it.";
  }

  let debtLine = "";
  if (decisionDebtIndex !== undefined) {
    if (decisionDebtIndex > 0.7) {
      debtLine = "Decision debt runs high; bad calls cast a long shadow over the system.";
    } else if (decisionDebtIndex < 0.3) {
      debtLine = "Decision debt stays low; the system rarely carries old mistakes forward for long.";
    }
  }

  return [
    `In ${periodLabel}, ${companyName} shows a learning profile with an average recovery span of ${averageRecoveryDecisions.toFixed(1)} decisions and a learning win rate of ${win.toFixed(0)}%.`,
    recoveryLine,
    resilienceLine,
    debtLine,
  ]
    .filter(Boolean)
    .join(" ");
}

function describeDelta(valueB: number, valueA: number, label: string, precision = 1): string {
  const delta = valueB - valueA;
  const abs = Math.abs(delta);
  if (abs < 0.2) {
    return `${label} is broadly similar (${valueA.toFixed(precision)} vs ${valueB.toFixed(precision)}).`;
  }
  const direction = delta > 0 ? "higher" : "lower";
  return `${label} is ${direction} in B (${valueA.toFixed(precision)} → ${valueB.toFixed(precision)}).`;
}

function topCategoryShifts(
  a: CompanyPeriodSnapshot,
  b: CompanyPeriodSnapshot,
  maxLines = 3,
): string {
  const totalA = a.categories.reduce((sum, c) => sum + c.decisionCount, 0);
  const totalB = b.categories.reduce((sum, c) => sum + c.decisionCount, 0);

  if (totalA === 0 || totalB === 0) {
    return "Category load cannot be compared yet — one of the systems is missing meaningful category data.";
  }

  const mapA = new Map(a.categories.map((c) => [c.name, c]));
  const mapB = new Map(b.categories.map((c) => [c.name, c]));

  type Shift = { name: string; deltaShare: number; shareA: number; shareB: number; avgReturnA?: number; avgReturnB?: number };

  const shifts: Shift[] = [];

  const allNames = new Set<string>([...a.categories.map((c) => c.name), ...b.categories.map((c) => c.name)]);

  allNames.forEach((name) => {
    const ca = mapA.get(name);
    const cb = mapB.get(name);
    const shareA = totalA > 0 ? ((ca?.decisionCount ?? 0) / totalA) * 100 : 0;
    const shareB = totalB > 0 ? ((cb?.decisionCount ?? 0) / totalB) * 100 : 0;
    const deltaShare = shareB - shareA;
    if (Math.abs(deltaShare) > 5) {
      shifts.push({
        name,
        deltaShare,
        shareA,
        shareB,
        avgReturnA: ca?.avgReturn,
        avgReturnB: cb?.avgReturn,
      });
    }
  });

  if (!shifts.length) {
    return "Category load is distributed similarly; no single area moves sharply in either direction.";
  }

  shifts.sort((x, y) => Math.abs(y.deltaShare) - Math.abs(x.deltaShare));
  const top = shifts.slice(0, maxLines);

  const parts = top.map((s) => {
    const dir = s.deltaShare > 0 ? "heavier" : "lighter";
    const change = `${Math.abs(s.deltaShare).toFixed(1)} pts`;
    const perfDetail =
      s.avgReturnA != null && s.avgReturnB != null
        ? ` (Avg Return ${s.avgReturnA.toFixed(1)} → ${s.avgReturnB.toFixed(1)})`
        : "";
    return `${s.name} carries a ${dir} load in B (+${change})${perfDetail}.`;
  });

  return parts.join(" ");
}

function archetypeShiftSummary(a: CompanyPeriodSnapshot, b: CompanyPeriodSnapshot): string {
  if (!a.archetypes.length || !b.archetypes.length) {
    return "Archetype mix cannot be compared cleanly yet.";
  }

  const sortedA = [...a.archetypes].sort((x, y) => y.percentage - x.percentage);
  const sortedB = [...b.archetypes].sort((x, y) => y.percentage - x.percentage);

  const dominantA = sortedA[0];
  const dominantB = sortedB[0];

  const labelA = `${dominantA.name} (${dominantA.percentage.toFixed(0)}%)`;
  const labelB = `${dominantB.name} (${dominantB.percentage.toFixed(0)}%)`;

  if (dominantA.name === dominantB.name) {
    return `Both systems are dominated by ${dominantA.name}, but the weight shifts from ${dominantA.percentage.toFixed(0)}% to ${dominantB.percentage.toFixed(0)}%.`;
  }

  return `System A is dominated by ${labelA}, while system B leans toward ${labelB}.`;
}

function learningShiftSummary(a: CompanyPeriodSnapshot, b: CompanyPeriodSnapshot): string {
  const la = a.learningRecovery;
  const lb = b.learningRecovery;
  if (!la || !lb) {
    return "Learning signals are not fully available for both systems.";
  }

  const lines: string[] = [];

  const deltaRecovery = lb.averageRecoveryDecisions - la.averageRecoveryDecisions;
  if (Math.abs(deltaRecovery) < 0.2) {
    lines.push(`Recovery speed is similar (${la.averageRecoveryDecisions.toFixed(1)} vs ${lb.averageRecoveryDecisions.toFixed(1)} decisions).`);
  } else {
    const dir = deltaRecovery < 0 ? "faster" : "slower";
    lines.push(`Recoveries are ${dir} in B (from ${la.averageRecoveryDecisions.toFixed(1)} to ${lb.averageRecoveryDecisions.toFixed(1)} decisions).`);
  }

  const deltaWin = lb.winRate - la.winRate;
  if (Math.abs(deltaWin) >= 2) {
    const dir = deltaWin > 0 ? "higher" : "lower";
    lines.push(`Learning win rate runs ${dir} in B (${la.winRate.toFixed(0)}% → ${lb.winRate.toFixed(0)}%).`);
  }

  if (la.decisionDebtIndex !== undefined && lb.decisionDebtIndex !== undefined) {
    const deltaDebt = lb.decisionDebtIndex - la.decisionDebtIndex;
    if (Math.abs(deltaDebt) >= 0.05) {
      const dir = deltaDebt < 0 ? "lower" : "higher";
      lines.push(`Decision debt trends ${dir} in B (${(la.decisionDebtIndex * 100).toFixed(0)}% → ${(lb.decisionDebtIndex * 100).toFixed(0)}%).`);
    }
  }

  if (!lines.length) {
    return "Learning posture is broadly similar across both systems.";
  }
  return lines.join(" ");
}

export function generateSystemCompareSummary(
  a: CompanyPeriodSnapshot,
  b: CompanyPeriodSnapshot,
): SystemCompareSummary {
  const labelA = `${a.companyName} · ${a.periodLabel}`;
  const labelB = `${b.companyName} · ${b.periodLabel}`;

  const postureBits: string[] = [];
  postureBits.push(describeDelta(b.rpsBaseline.avgReturn, a.rpsBaseline.avgReturn, "Return"));
  postureBits.push(describeDelta(b.rpsBaseline.avgPressure, a.rpsBaseline.avgPressure, "Pressure"));
  postureBits.push(describeDelta(b.rpsBaseline.avgStability, a.rpsBaseline.avgStability, "Stability"));
  const postureLine = postureBits.join(" ");

  const terrainLine = topCategoryShifts(a, b);
  const archetypeLine = archetypeShiftSummary(a, b);
  const learningLine = learningShiftSummary(a, b);

  return {
    labelA,
    labelB,
    postureLine,
    terrainLine,
    archetypeLine,
    learningLine,
  };
}

export function generateTimeframeComparisonSummary(
  snapshotA: CompanyPeriodSnapshot,
  snapshotB: CompanyPeriodSnapshot,
): string {
  const { companyName } = snapshotA;
  const older = snapshotA;
  const newer = snapshotB;

  const rDelta = newer.rpsBaseline.avgReturn - older.rpsBaseline.avgReturn;
  const pDelta = newer.rpsBaseline.avgPressure - older.rpsBaseline.avgPressure;
  const sDelta = newer.rpsBaseline.avgStability - older.rpsBaseline.avgStability;

  const direction = (v: number) => (v > 0 ? "higher" : v < 0 ? "lower" : "roughly unchanged");

  return [
    `${companyName}'s judgment physics shifted from ${older.periodLabel} to ${newer.periodLabel}.`,
    `Return is ${direction(rDelta)} (${older.rpsBaseline.avgReturn.toFixed(1)} → ${newer.rpsBaseline.avgReturn.toFixed(1)}), pressure is ${direction(pDelta)} (${older.rpsBaseline.avgPressure.toFixed(1)} → ${newer.rpsBaseline.avgPressure.toFixed(1)}), and stability is ${direction(sDelta)} (${older.rpsBaseline.avgStability.toFixed(1)} → ${newer.rpsBaseline.avgStability.toFixed(1)}).`,
    `Together, these deltas show how the system is evolving — whether it is tightening under pressure, reclaiming calm, or trading stability for speed.`,
  ].join(" ");
}

export function generateCrossCompanyComparisonSummary(
  a: CompanyPeriodSnapshot,
  b: CompanyPeriodSnapshot,
): string {
  const aR = a.rpsBaseline;
  const bR = b.rpsBaseline;

  const postureA = buildRpsSignatureLine(aR.avgReturn, aR.avgPressure, aR.avgStability);
  const postureB = buildRpsSignatureLine(bR.avgReturn, bR.avgPressure, bR.avgStability);

  return [
    `${a.companyName} and ${b.companyName} operate with distinctly different judgment physics in ${a.periodLabel}.`,
    `${a.companyName} runs with return ${aR.avgReturn.toFixed(1)}, pressure ${aR.avgPressure.toFixed(1)}, and stability ${aR.avgStability.toFixed(1)}. ${postureA}`,
    `${b.companyName} runs with return ${bR.avgReturn.toFixed(1)}, pressure ${bR.avgPressure.toFixed(1)}, and stability ${bR.avgStability.toFixed(1)}. ${postureB}`,
  ].join(" ");
}

export interface FullInterpretation {
  rpsSummary: string;
  categorySummary: string;
  archetypeSummary: string;
  learningSummary: string;
  momentumLabel: string;
  momentumSummary: string;
}

export function generateFullInterpretation(snapshot: CompanyPeriodSnapshot): FullInterpretation {
  const { companyName, periodLabel, rpsBaseline, categories, archetypes, learningRecovery } = snapshot;

  const momentumLabel = "Momentum Profile";  
const momentumSummary = "This section analyzes directional judgment momentum."; 


  return {
    rpsSummary: generateRpsBaselineSummary(companyName, periodLabel, rpsBaseline),
    categorySummary: generateCategoryProfileSummary(companyName, periodLabel, categories),
    archetypeSummary: generateArchetypeProfileSummary(companyName, periodLabel, archetypes),
    learningSummary: generateLearningRecoverySummary(companyName, periodLabel, learningRecovery),
    momentumLabel,
    momentumSummary,
  };
}
