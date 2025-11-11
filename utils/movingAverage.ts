export function movingAverage(values: number[], n: number): number[] {
  if (values.length < n || n <= 0) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out.push(sum / n);
  }
  return out;
}
