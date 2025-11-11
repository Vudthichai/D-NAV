import { stdev } from "@/utils/stats";
import { movingAverage } from "@/utils/movingAverage";
import { momentumSlope, labelMomentum } from "@/utils/momentum";
import { computeLCI } from "@/utils/lci";

export function useFeedbackLoops(dnavSeries: number[]) {
  const count = dnavSeries.length;
  const unlocked = count >= 15;
  const needed = Math.max(0, 15 - count);

  const momentum = [15, 50, 100]
    .filter((n) => count >= n)
    .map((n) => {
      const maSeries = movingAverage(dnavSeries, n);
      const slope = momentumSlope(maSeries.length ? maSeries : dnavSeries.slice(-n));
      return { n, slope, label: labelMomentum(slope) };
    });

  const lci = computeLCI(dnavSeries);

  const recent = dnavSeries.slice(-15);
  const sigma = recent.length >= 2 ? stdev(recent) : null;

  return { unlocked, needed, momentum, lci, sigma };
}
