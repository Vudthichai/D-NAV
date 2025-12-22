import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DecisionInputs, DecisionMetrics, LeverageRow } from "@/types/leverage";
import { buildLeverageInsight } from "@/lib/leverage/insightCopy";

interface LeverageInsightProps {
  baseInputs: DecisionInputs;
  baseMetrics: DecisionMetrics;
  modifiedMetrics: DecisionMetrics;
  rows: LeverageRow[];
  insightOverride?: string;
}

export default function LeverageInsight({
  baseInputs,
  baseMetrics,
  modifiedMetrics,
  rows,
  insightOverride,
}: LeverageInsightProps) {
  const insight =
    insightOverride ?? buildLeverageInsight({ baseInputs, baseMetrics, modifiedMetrics, rows });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Insight sentence</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground">{insight}</p>
      </CardContent>
    </Card>
  );
}
