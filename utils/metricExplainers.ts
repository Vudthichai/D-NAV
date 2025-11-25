export interface MetricExplainer {
  description: string;
  example: string;
}

const metricExplainers: Record<string, MetricExplainer> = {
  "Total Decisions": {
    description: "Count of decisions recorded in the selected window.",
    example: "Logging 12 choices this month results in 12 total decisions.",
  },
  "Average D-NAV": {
    description: "Average D-NAV score across the filtered decisions.",
    example: "Scores of 40 and 60 yield an average D-NAV of 50.",
  },
  "Decision Cadence": {
    description: "How frequently decisions are made, normalized to the selected cadence unit.",
    example: "6 decisions across two weeks shows a cadence of 3 per week.",
  },
  "Consistency": {
    description: "Standard deviation of D-NAV scores; lower values indicate steadier outcomes.",
    example: "A consistency score of 8 means results are tightly clustered.",
  },
  "Recent Trend": {
    description: "Difference between the average of the last five decisions and the prior five.",
    example: "Last five averaging 60 vs. prior five at 50 produces a +10 trend.",
  },
  "Return on Effort": {
    description: "Total return divided by the total energy invested.",
    example: "Generating 15 return from 5 energy equates to a 3.0 ratio.",
  },
  "Window Archetype": {
    description: "Prevailing decision archetype across the selected window.",
    example: "A Maverick window archetype highlights aggressive upside seeking.",
  },
  "Return Distribution": {
    description: "Share of decisions landing as positive, neutral, or negative return.",
    example: "60% positive / 20% neutral / 20% negative indicates upside skew.",
  },
  "Return distribution": {
    description: "Share of decisions landing as positive, neutral, or negative return.",
    example: "60% positive / 20% neutral / 20% negative indicates upside skew.",
  },
  "Return Distribution|positive": {
    description: "Portion of decisions that generated a net-positive return.",
    example: "If 12 of 20 entries won, the positive slice is 60%.",
  },
  "Return distribution|positive": {
    description: "Portion of decisions that generated a net-positive return.",
    example: "If 12 of 20 entries won, the positive slice is 60%.",
  },
  "Return Distribution|neutral": {
    description: "Portion of decisions that broke even.",
    example: "Two zero-return outcomes in ten decisions produce 20% neutral.",
  },
  "Return distribution|neutral": {
    description: "Portion of decisions that broke even.",
    example: "Two zero-return outcomes in ten decisions produce 20% neutral.",
  },
  "Return Distribution|negative": {
    description: "Portion of decisions that finished in the red.",
    example: "Three losses in a 15-decision sample equal 20% negative.",
  },
  "Return distribution|negative": {
    description: "Portion of decisions that finished in the red.",
    example: "Three losses in a 15-decision sample equal 20% negative.",
  },
  "Stability Distribution": {
    description: "Balance of decisions that landed stable, uncertain, or fragile.",
    example: "Half of choices landing stable implies a resilient footing.",
  },
  "Stability distribution": {
    description: "Balance of decisions that landed stable, uncertain, or fragile.",
    example: "Half of choices landing stable implies a resilient footing.",
  },
  "Stability Distribution|stable": {
    description: "Percentage of decisions showing positive stability.",
    example: "8 of 16 choices scoring above zero stability equals 50% stable.",
  },
  "Stability distribution|stable": {
    description: "Percentage of decisions showing positive stability.",
    example: "8 of 16 choices scoring above zero stability equals 50% stable.",
  },
  "Stability Distribution|uncertain": {
    description: "Percentage of decisions with neutral stability.",
    example: "Three neutral reads in a dozen decisions equals 25% uncertain.",
  },
  "Stability distribution|uncertain": {
    description: "Percentage of decisions with neutral stability.",
    example: "Three neutral reads in a dozen decisions equals 25% uncertain.",
  },
  "Stability Distribution|fragile": {
    description: "Percentage of decisions showing negative stability.",
    example: "If four outcomes were fragile, the slice is 33%.",
  },
  "Stability distribution|fragile": {
    description: "Percentage of decisions showing negative stability.",
    example: "If four outcomes were fragile, the slice is 33%.",
  },
  "Pressure Distribution": {
    description: "Mix of pressured, balanced, or calm operating conditions.",
    example: "A 40% calm read means most executions feel controlled.",
  },
  "Pressure distribution": {
    description: "Mix of pressured, balanced, or calm operating conditions.",
    example: "A 40% calm read means most executions feel controlled.",
  },
  "Pressure Distribution|pressured": {
    description: "Percentage of decisions experiencing net pressure.",
    example: "Five pressured calls out of ten equals 50% pressured.",
  },
  "Pressure distribution|pressured": {
    description: "Percentage of decisions experiencing net pressure.",
    example: "Five pressured calls out of ten equals 50% pressured.",
  },
  "Pressure Distribution|balanced": {
    description: "Percentage of decisions landing at neutral pressure.",
    example: "Three balanced reads in twelve decisions equals 25% balanced.",
  },
  "Pressure distribution|balanced": {
    description: "Percentage of decisions landing at neutral pressure.",
    example: "Three balanced reads in twelve decisions equals 25% balanced.",
  },
  "Pressure Distribution|calm": {
    description: "Percentage of decisions where calm outweighed pressure.",
    example: "If six entries were calm, the calm portion is 60%.",
  },
  "Pressure distribution|calm": {
    description: "Percentage of decisions where calm outweighed pressure.",
    example: "If six entries were calm, the calm portion is 60%.",
  },
  "Loss Streak": {
    description: "Active and longest chain of consecutive negative returns.",
    example: "A 2 / 4 streak means two current losses and four at peak.",
  },
  "Return Debt": {
    description: "Sum of returns needed to offset the active loss streak.",
    example: "Three -2 losses accrue 6 units of return debt.",
  },
  "Payback Ratio": {
    description: "Average positive return required to clear each loss in the streak.",
    example: "Needing 9 upside to repay three losses implies a 3.0 ratio.",
  },
  "Feedback Loops": {
    description: "Suite of momentum, recovery, and consistency diagnostics unlocked with more data.",
    example: "Log 15 decisions to reveal recovery speed, trend slope, and stability.",
  },
  "Recovery (LCI)": {
    description: "Composite of completeness and speed measuring how you rebound from drawdowns.",
    example: "LCI 1.2 with completeness 1.1 and speed 1.1 shows slightly over-recovering momentum.",
  },
  Momentum: {
    description: "Slope of D-NAV moving averages showing directional drift over multiple windows.",
    example: "A +0.8 slope on the 15-decision window signals upward acceleration.",
  },
};

export const getMetricExplainer = (term: string): MetricExplainer | undefined => metricExplainers[term];

export const registerMetricExplainer = (
  term: string,
  explainer: MetricExplainer,
): void => {
  metricExplainers[term] = explainer;
};
