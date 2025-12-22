import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeverageRow } from "@/types/leverage";

const variableLabels: Record<LeverageRow["variable"], string> = {
  impact: "Impact",
  cost: "Cost",
  risk: "Risk",
  urgency: "Urgency",
  confidence: "Confidence",
};

const leverageTone: Record<LeverageRow["leverageTag"], string> = {
  High: "bg-emerald-500/10 text-emerald-700",
  Medium: "bg-amber-500/10 text-amber-700",
  Low: "bg-slate-500/10 text-slate-700",
};

const formatSigned = (value: number) => {
  if (value === 0) return "0";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Number.isInteger(value) ? value.toString() : value.toFixed(1)}`;
};

const formatDelta = (value: number) => {
  if (value === 0) return "0";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Number.isInteger(value) ? value.toString() : value.toFixed(1)}`;
};

interface LeverageLedgerProps {
  rows: LeverageRow[];
  hasChanges: boolean;
  isReady?: boolean;
}

export default function LeverageLedger({ rows, hasChanges, isReady = true }: LeverageLedgerProps) {
  return (
    <Card className="h-full border-primary/20 shadow-sm">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Leverage</p>
        <CardTitle className="text-base font-semibold">What moved the needle</CardTitle>
      </CardHeader>
      <CardContent>
        {!isReady ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Complete all inputs to calculate leverage.
          </div>
        ) : !hasChanges ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No changes yet. Adjust one variable to see leverage.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const Icon = row.direction === "up" ? ArrowUp : row.direction === "down" ? ArrowDown : Minus;
              return (
                <div
                  key={row.variable}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {variableLabels[row.variable]} {formatSigned(row.deltaInput)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        → {formatDelta(row.deltaDnav)} D-NAV
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className={leverageTone[row.leverageTag]}>
                    {row.leverageTag} leverage
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
