export function mean(values: number[]): number {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function std(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function rollingMean(values: number[], window: number): number[] {
  if (!values.length || window <= 1) return values.slice();
  return values.map((_, idx) => {
    const slice = values.slice(Math.max(0, idx - window + 1), idx + 1);
    return mean(slice);
  });
}

export function rollingStd(values: number[], window: number): number[] {
  if (!values.length || window <= 1) return values.map(() => 0);
  return values.map((_, idx) => {
    const slice = values.slice(Math.max(0, idx - window + 1), idx + 1);
    return std(slice);
  });
}

export function correlation(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  const meanA = mean(a);
  const meanB = mean(b);
  const numerator = a.reduce((sum, value, idx) => sum + (value - meanA) * (b[idx] - meanB), 0);
  const denomA = Math.sqrt(a.reduce((sum, value) => sum + (value - meanA) ** 2, 0));
  const denomB = Math.sqrt(b.reduce((sum, value) => sum + (value - meanB) ** 2, 0));
  const denominator = denomA * denomB || 1;
  return numerator / denominator;
}

export function describeVolatility(stdValue: number): "Steady" | "Mixed" | "Chaotic" {
  if (stdValue < 0.75) return "Steady";
  if (stdValue < 1.5) return "Mixed";
  return "Chaotic";
}
