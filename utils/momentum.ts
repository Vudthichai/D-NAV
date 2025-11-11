// Least-squares slope for y over x = 0..n-1
export function momentumSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (values[i] - yMean);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den; // D-NAV per decision
}

export function labelMomentum(slope: number) {
  if (slope > 0.25) return "Up";
  if (slope < -0.25) return "Down";
  return "Flat";
}
