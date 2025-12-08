"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import DecisionPortfolioBrief from "@/components/DecisionPortfolioBrief";
import { TIMEFRAMES, type TimeframeValue, useReportsData } from "@/hooks/useReportsData";
import { buildCompanyPeriodSnapshot } from "@/lib/dnavSummaryEngine";

export default function ReportsOnePagerPrint() {
  const searchParams = useSearchParams();
  const timeframeParam = (searchParams.get("window") ?? "all") as string;
  const timeframe: TimeframeValue = TIMEFRAMES.some(({ value }) => value === timeframeParam)
    ? (timeframeParam as TimeframeValue)
    : "all";

  const { company, baseline, categories, archetypes, learning } = useReportsData({ timeframe });

  // Build the same snapshot used on the main Reports page
  const snapshot = useMemo(
    () =>
      company && baseline
        ? buildCompanyPeriodSnapshot({
            company,
            baseline,
            categories,
            archetypes,
            learning,
            timeframeKey: timeframe,
          })
        : null,
    [archetypes, baseline, categories, company, learning, timeframe],
  );

  useEffect(() => {
    // Auto-open print dialog once the page has rendered
    if (typeof window !== "undefined") {
      const timeoutId = setTimeout(() => {
        window.print();
      }, 250);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, []);

  if (!snapshot) return null;

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Optional: simple text header for print */}
      <h1 className="text-2xl font-semibold mb-4">Decision Portfolio Brief</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Snapshot for {snapshot.companyName} · {snapshot.periodLabel}
      </p>

      <DecisionPortfolioBrief snapshot={snapshot} />
    </div>
  );
}
