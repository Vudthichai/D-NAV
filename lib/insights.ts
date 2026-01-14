export type CategoryActionInsightInput = {
  count: number;
  avgR: number;
  avgP: number;
  avgS: number;
  returnNegPct: number;
  pressureHighPct: number;
  stabilityNegPct: number;
};

export type CategoryActionInsight = {
  summary: string;
  watch?: string;
  signal: "strong" | "medium" | "weak";
};

export const capitalizeFirst = (value: string) => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const getSignal = (count: number): CategoryActionInsight["signal"] => {
  if (count >= 10) return "strong";
  if (count >= 5) return "medium";
  return "weak";
};

const ensureSentence = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
};

const getPosture = (avgP: number, avgS: number) => {
  if (avgP >= 1 && avgS <= 0) return "Pressured and fragile execution.";
  if (avgP >= 1 && avgS > 0) return "Pressured but stable footing.";
  if (avgP < 1 && avgS <= 0) return "Low pressure but fragile base.";
  return "Stable footing with manageable pressure.";
};

const getReturnClause = (avgR: number) => {
  if (avgR <= 0) return "Return leakage—tighten impact per decision.";
  if (avgR < 1) return "Muted return—raise impact per decision.";
  return "Return is healthy—protect what’s working.";
};

const getWatch = (input: CategoryActionInsightInput) => {
  if (input.stabilityNegPct >= 25) return "Watch: fragility pockets";
  if (input.pressureHighPct >= 25) return "Watch: pressure spikes";
  if (input.returnNegPct >= 25) return "Watch: value leakage";
  return undefined;
};

export const buildCategoryActionInsight = (input: CategoryActionInsightInput): CategoryActionInsight => {
  const posture = ensureSentence(getPosture(input.avgP, input.avgS));
  const returnClause = ensureSentence(getReturnClause(input.avgR));
  const summary = capitalizeFirst(`${posture} ${returnClause}`.trim());

  return {
    summary,
    watch: getWatch(input),
    signal: getSignal(input.count),
  };
};
