"use client";

import { Button } from "@/components/ui/button";
import type { ExtractedDecisionCandidate } from "@/components/stress-test/decision-intake-types";
import * as XLSX from "xlsx";

interface ExcelExportButtonProps {
  decisions: ExtractedDecisionCandidate[];
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
        const header = ["Date", "Decision", "Category", "Impact", "Cost", "Risk", "Urgency", "Confidence"];
        const rows = decisions.map((decision) => {
          const parsedDate = decision.createdAt ? new Date(decision.createdAt) : null;
          const dateCell = parsedDate && !Number.isNaN(parsedDate.valueOf()) ? parsedDate.toLocaleDateString() : "";
          return [
            dateCell,
            decision.decisionText,
            decision.domain,
            decision.scores.impact,
            decision.scores.cost,
            decision.scores.risk,
            decision.scores.urgency,
            decision.scores.confidence,
          ];
        });
        const worksheet = XLSX.utils.aoa_to_sheet([
          ["Directions: Keep row 1 as a guide, then enter decisions below."],
          header,
          ...rows,
        ]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Decisions");
        const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([arrayBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const filename = `dnav-decisions-export-${new Date().toISOString().split("T")[0]}.xlsx`;
        downloadBlob(blob, filename);
      }}
      disabled={decisions.length === 0}
    >
      Export kept decisions
    </Button>
  );
}
