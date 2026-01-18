"use client";

import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

interface ExportDecision {
  createdAt: number;
  title: string;
  category: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
}

interface ExcelExportButtonProps {
  decisions: ExportDecision[];
  className?: string;
}

const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
};

export function ExcelExportButton({ decisions, className }: ExcelExportButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={() => {
        if (decisions.length === 0) return;
        const header = [
          "Date",
          "Decision",
          "Category",
          "Impact",
          "Cost",
          "Risk",
          "Urgency",
          "Confidence",
        ];
        const rows = decisions.map((decision) => [
          new Date(decision.createdAt).toLocaleDateString(),
          decision.title,
          decision.category,
          decision.impact,
          decision.cost,
          decision.risk,
          decision.urgency,
          decision.confidence,
        ]);
        const worksheet = XLSX.utils.aoa_to_sheet([
          ["Directions: Keep row 1 as a guide, then enter decisions below."],
          header,
          ...rows,
        ]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Decisions");
        const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const filename = `dnav-decision-intake-${new Date().toISOString().split("T")[0]}.xlsx`;
        downloadBlob(blob, filename);
      }}
      disabled={decisions.length === 0}
    >
      Download Excel (Template)
    </Button>
  );
}
