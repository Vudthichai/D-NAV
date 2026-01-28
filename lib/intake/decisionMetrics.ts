import { computeMetrics, type DecisionVariables } from "@/lib/calculations";

export interface DecisionRpsDnav {
  r: number;
  p: number;
  s: number;
  dnav: number;
}

export const computeRpsDnav = (vars: DecisionVariables): DecisionRpsDnav => {
  const metrics = computeMetrics(vars);
  return {
    r: metrics.return,
    p: metrics.pressure,
    s: metrics.stability,
    dnav: metrics.dnav,
  };
};
