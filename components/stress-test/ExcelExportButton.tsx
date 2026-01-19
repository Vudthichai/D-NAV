"use client";

import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

interface ExportDecision {
  createdAt: number;
  title: string;
  detail?: string;
  category: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
  source?: {
    fileName: string;
    pageNumber?: number | null;
    excerpt?: string;
  };
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
        const cleanDecisions = decisions.filter((decision) => decision.title.trim().length > 0);
        if (cleanDecisions.length === 0) return;
        const header = [
          "Title",
          "Detail",
          "Category",
          "Impact",
          "Cost",
          "Risk",
          "Urgency",
          "Confidence",
          "Source File",
          "Source Page",
          "Source Excerpt",
        ];
        const rows = cleanDecisions.map((decision) => [
          decision.title,
          decision.detail ?? "",
          decision.category,
          decision.impact,
          decision.cost,
          decision.risk,
          decision.urgency,
          decision.confidence,
          decision.source?.fileName ?? "",
          decision.source?.pageNumber ?? "",
          decision.source?.excerpt ?? "",
        ]);
        const worksheet = XLSX.utils.aoa_to_sheet([
          ["Directions: Keep row 1 as a guide, then enter decisions below."],
          header,
          ...rows,
        ]);
        worksheet["!cols"] = [
          { wch: 42 },
          { wch: 60 },
          { wch: 18 },
          { wch: 8 },
          { wch: 8 },
          { wch: 8 },
          { wch: 10 },
          { wch: 12 },
          { wch: 28 },
          { wch: 12 },
          { wch: 60 },
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Decisions");
        const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const filename = `dnav-decisions-export-${new Date().toISOString().split("T")[0]}.xlsx`;
        downloadBlob(blob, filename);
      }}
      disabled={decisions.length === 0}
    >
      Export Decisions (Excel)
    </Button>
  );
}
