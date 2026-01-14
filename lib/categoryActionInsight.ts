import { buildCategoryActionInsight, type CategoryActionInsightInput } from "@/lib/insights";

export type CategoryActionInsightResult = {
  insightText: string;
  signalStrength: "strong" | "medium" | "weak";
  logMoreHint?: string | null;
};

export const getCategoryLogMoreHint = (count: number) => {
  if (count >= 10) return null;
  const remaining = Math.max(0, 10 - count);
  if (count >= 5) {
    return `Log ${remaining} more decisions in this category to strengthen the signal.`;
  }
  if (count >= 3) {
    return `Signal is thin — log ${remaining} more decisions here before trusting patterns.`;
  }
  return `Not enough data — log ${remaining} more decisions here to form a usable signal.`;
};

export const getCategoryActionInsight = (input: CategoryActionInsightInput): CategoryActionInsightResult => {
  const insight = buildCategoryActionInsight(input);
  const insightText = insight.watch ? `${insight.summary} ${insight.watch}` : insight.summary;

  return {
    insightText,
    signalStrength: insight.signal,
    logMoreHint: getCategoryLogMoreHint(input.count),
  };
};
