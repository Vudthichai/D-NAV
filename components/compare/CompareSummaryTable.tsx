"use client";

import React from "react";
import { formatNumber } from "@/lib/compare/evidence";

export type CompareSummaryRow = {
  label: string;
  valueA: number;
  valueB: number;
  varianceA?: { value: number; label: string };
  varianceB?: { value: number; label: string };
};

type CompareSummaryTableProps = {
  title?: string;
  subtitle?: string;
  labelA: string;
  labelB: string;
  subLabelA?: string;
  subLabelB?: string;
  rows: CompareSummaryRow[];
  className?: string;
};

export function CompareSummaryTable({
  title = "Summary Stats",
  subtitle = "Average D-NAV and R / P / S.",
  labelA,
  labelB,
  subLabelA,
  subLabelB,
  rows,
  className,
}: CompareSummaryTableProps) {
  return (
    <div className={`rounded-xl border bg-muted/40 p-4 ${className ?? ""}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border bg-background/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold" rowSpan={2}>
                Metric
              </th>
              <th className="px-3 py-2 text-right font-semibold" colSpan={2}>
                <div className="flex flex-col items-end">
                  <span>{labelA}</span>
                  {subLabelA && <span className="text-[10px] font-normal text-muted-foreground">{subLabelA}</span>}
                </div>
              </th>
              <th className="px-3 py-2 text-right font-semibold" colSpan={2}>
                <div className="flex flex-col items-end">
                  <span>{labelB}</span>
                  {subLabelB && <span className="text-[10px] font-normal text-muted-foreground">{subLabelB}</span>}
                </div>
              </th>
            </tr>
            <tr className="border-t border-muted/30 text-[10px] uppercase">
              <th className="px-3 py-1.5 text-right font-semibold">Avg</th>
              <th className="px-3 py-1.5 text-right font-semibold">Variance</th>
              <th className="px-3 py-1.5 text-right font-semibold">Avg</th>
              <th className="px-3 py-1.5 text-right font-semibold">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-muted/30">
                <td className="px-3 py-1.5 text-muted-foreground">{row.label}</td>
                <td className="px-3 py-1.5 text-right font-medium text-foreground">{formatValue(row.valueA)}</td>
                <td className="px-3 py-1.5 text-right font-medium text-foreground">
                  {formatVariance(row.varianceA)}
                </td>
                <td className="px-3 py-1.5 text-right font-medium text-foreground">{formatValue(row.valueB)}</td>
                <td className="px-3 py-1.5 text-right font-medium text-foreground">
                  {formatVariance(row.varianceB)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatValue(value: number) {
  if (Number.isNaN(value)) return "—";
  return formatNumber(value, 1);
}

function formatVariance(variance?: { value: number; label: string }) {
  if (!variance || Number.isNaN(variance.value)) return "—";
  return `${formatNumber(variance.value, 2)} (${variance.label})`;
}
