export type LCIResult = {
  lci: number; // headline
  completeness: number; // rebound depth / drawdown depth
  speed: number; // (down duration) / (recovery duration)  (>=0)
  meta: { peakIdx: number; troughIdx: number; depth: number; ddLen: number; recLen: number };
};

// Compute LCI from a D-NAV time series (oldest → newest).
// Returns null if no drawdown detected.
export function computeLCI(series: number[]): LCIResult | null {
  if (series.length < 6) return null;

  // Find most recent peak→trough (drawdown)
  let peakIdx = 0,
    peakVal = series[0];
  let troughIdx = 0,
    troughVal = series[0];
  for (let i = 1; i < series.length; i++) {
    const v = series[i];
    if (v > peakVal) {
      peakVal = v;
      peakIdx = i;
      troughIdx = i;
      troughVal = v;
    }
    if (v < troughVal) {
      troughVal = v;
      troughIdx = i;
    }
  }
  if (troughIdx <= peakIdx) return null;

  const depth = peakVal - troughVal;
  if (depth <= 0) return null;

  // Recovery window: trough → end (or until first value >= prior peak)
  const recSeries = series.slice(troughIdx);
  const firstRecoverIdx = recSeries.findIndex((v) => v >= peakVal);
  const recLen = firstRecoverIdx === -1 ? recSeries.length - 1 : firstRecoverIdx;
  const ddLen = Math.max(1, troughIdx - peakIdx);

  const maxAfterTrough = Math.max(...recSeries);
  const completeness = (maxAfterTrough - troughVal) / depth; // >1 overshoot
  const speed = Math.min(2, ddLen / Math.max(1, recLen)); // faster up than down → >1
  const lci = completeness * speed;

  return { lci, completeness, speed, meta: { peakIdx, troughIdx, depth, ddLen, recLen } };
}
