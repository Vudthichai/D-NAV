export type CompareMode = "entity";

export type CohortSummary = {
  label: string;
  timeframeLabel: string;
  avgReturn: number;
  avgPressure: number;
  avgStability: number;
};

export type CompareResult = {
  mode: CompareMode;
  cohortA: CohortSummary;
  cohortB: CohortSummary;
  deltas: {
    returnDelta: number;
    pressureDelta: number;
    stabilityDelta: number;
  };
  postureLine: string;
};
