"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { DecisionEntry } from "@/lib/calculations";
import { getWhySentence } from "@/lib/inspector";
import { cn } from "@/lib/utils";

type DecisionInspectorDrawerProps = {
  open: boolean;
  onClose: () => void;
  decisionIndex: number | null;
  decision: DecisionEntry | null;
  regimeLabel: string | null;
  returnValue: number | null;
  pressureValue: number | null;
  stabilityValue: number | null;
  dnavValue: number | null;
};

type MeterRowProps = {
  label: string;
  value: number | null;
  tone: "positive" | "neutral" | "negative";
  align?: "left" | "right";
};

const formatValue = (value: number | null, digits = 1) =>
  value === null || Number.isNaN(value) ? "—" : value.toFixed(digits);

const formatSignedValue = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  const formatted = Math.abs(value).toFixed(1);
  if (value > 0) return `(+${formatted})`;
  if (value < 0) return `(−${formatted})`;
  return `(${formatted})`;
};

const toneClasses: Record<MeterRowProps["tone"], string> = {
  positive: "bg-emerald-500/70",
  neutral: "bg-slate-400/70",
  negative: "bg-rose-500/70",
};

function MeterRow({ label, value, tone, align = "left" }: MeterRowProps) {
  const ratio = value === null ? 0 : Math.min(Math.abs(value) / 9, 1);
  const width = `${ratio * 100}%`;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span>{label}</span>
        <span className="text-muted-foreground">{formatSignedValue(value)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted/60">
        <div
          className={cn("h-2 rounded-full", toneClasses[tone], align === "right" ? "ml-auto" : "mr-auto")}
          style={{ width }}
        />
      </div>
    </div>
  );
}

export function DecisionInspectorDrawer({
  open,
  onClose,
  decisionIndex,
  regimeLabel,
  returnValue,
  pressureValue,
  stabilityValue,
  dnavValue,
}: DecisionInspectorDrawerProps) {
  const titleIndex = decisionIndex ?? "—";
  const resolvedRegime = regimeLabel ?? "Unscored";

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <SheetContent side="right" className="w-full max-w-none p-6 sm:max-w-[420px]">
        <div className="flex h-full flex-col gap-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">
              Decision {titleIndex} — {resolvedRegime}
            </p>
            <p className="text-sm text-muted-foreground">D-NAV: {formatValue(dnavValue)}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Why this regime?</p>
            <p className="text-sm text-muted-foreground">
              {getWhySentence(returnValue, pressureValue, stabilityValue)}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Factor breakdown</p>
            <MeterRow label="Return" value={returnValue} tone="positive" />
            <MeterRow
              label="Pressure"
              value={pressureValue}
              tone={pressureValue !== null && pressureValue < 0 ? "negative" : "neutral"}
              align={pressureValue !== null && pressureValue < 0 ? "right" : "left"}
            />
            <MeterRow label="Stability" value={stabilityValue} tone="positive" />
          </div>

          <details className="rounded-lg border bg-muted/40 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Calculation details
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Inputs normalized to −9 → +9</li>
              <li>Pressure contributes negatively to overall score</li>
              <li>D-NAV combines Return, Pressure, Stability</li>
              <li>Regime labels are applied after scores are computed</li>
            </ul>
          </details>

          <div className="mt-auto pt-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/methodology">View methodology</Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
