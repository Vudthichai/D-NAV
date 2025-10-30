"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DecisionEntry, computeMetrics, parseCSV } from "@/lib/calculations";
import { loadLog, removeDecision, clearLog, saveLog } from "@/lib/storage";
import { AlertTriangle, Download, FileSpreadsheet, FileText, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

export default function LogPage() {
  const [decisions, setDecisions] = useState<DecisionEntry[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const [selectedDecisions, setSelectedDecisions] = useState<Set<number>>(new Set());
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load decisions on component mount
  useEffect(() => {
    setDecisions(loadLog());
  }, []);

  const handleDeleteDecision = (timestamp: number) => {
    if (confirm("Are you sure you want to delete this decision?")) {
      removeDecision(timestamp);
      setDecisions(loadLog());
    }
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all decisions? This action cannot be undone.")) {
      clearLog();
      setDecisions([]);
      setSelectedDecisions(new Set());
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (decisions.length === 0) {
      alert("No decisions to export.");
      return;
    }

    const headers = [
      "Date",
      "Name", 
      "Category",
      "Impact",
      "Cost",
      "Risk",
      "Urgency",
      "Confidence",
      "Return",
      "Stability",
      "Pressure",
      "Merit",
      "Energy",
      "D-NAV"
    ];

    const csvContent = [
      headers.join(","),
      ...decisions.map(decision => [
        new Date(decision.ts).toLocaleDateString(),
        `"${decision.name}"`,
        `"${decision.category}"`,
        decision.impact,
        decision.cost,
        decision.risk,
        decision.urgency,
        decision.confidence,
        decision.return.toFixed(2),
        decision.stability.toFixed(2),
        decision.pressure.toFixed(2),
        decision.merit.toFixed(2),
        decision.energy.toFixed(2),
        decision.dnav.toFixed(2)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    downloadBlob(blob, `dnav-decisions-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const normalizeKey = (key: string = "") => key.toLowerCase().replace(/[^a-z0-9]/g, "");

  const parseNumeric = (value: unknown): number => {
    if (typeof value === "number" && !Number.isNaN(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.-]/g, "");
      const parsed = parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const parseTimestamp = (value: unknown, index: number, fallbackBase: number): number => {
    if (value === undefined || value === null || value === "") {
      return fallbackBase - index;
    }

    if (value instanceof Date) {
      const time = value.getTime();
      if (!Number.isNaN(time)) {
        return time;
      }
    }

    if (typeof value === "number" && !Number.isNaN(value)) {
      if (value > 1e12) return Math.round(value);
      if (value > 1e9) return Math.round(value * 1000);
      const excelDate = XLSX.SSF.parse_date_code(value);
      if (excelDate) {
        return Date.UTC(
          excelDate.y,
          excelDate.m - 1,
          excelDate.d,
          excelDate.H,
          excelDate.M,
          Math.round(excelDate.S || 0)
        );
      }
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return fallbackBase - index;
      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) {
        return parseTimestamp(numeric, index, fallbackBase);
      }
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.getTime();
      }
    }

    return fallbackBase - index;
  };

  const mapRecordToDecision = (
    record: Record<string, unknown>,
    index: number,
    fallbackBase: number
  ): DecisionEntry | null => {
    const name = String(record.name ?? record.decision ?? "").trim();
    if (!name) return null;

    const category = String(record.category ?? record.segment ?? "General").trim() || "General";
    const impact = parseNumeric(record.impact);
    const cost = parseNumeric(record.cost);
    const risk = parseNumeric(record.risk);
    const urgency = parseNumeric(record.urgency);
    const confidence = parseNumeric(record.confidence);

    const metrics = computeMetrics({ impact, cost, risk, urgency, confidence });
    const ts = parseTimestamp(
      record.timestamp ?? record.ts ?? record.date ?? record.when ?? record.datetime,
      index,
      fallbackBase
    );

    return {
      ts,
      name,
      category,
      impact,
      cost,
      risk,
      urgency,
      confidence,
      ...metrics,
    };
  };

  const recordsToDecisions = (records: Record<string, unknown>[]): DecisionEntry[] => {
    const fallbackBase = Date.now();
    return records
      .map((record, index) => mapRecordToDecision(record, index, fallbackBase))
      .filter((decision): decision is DecisionEntry => Boolean(decision));
  };

  const parseCsvRecords = (rows: string[][]): Record<string, unknown>[] => {
    if (rows.length < 2) return [];
    const headers = rows[0].map(normalizeKey);
    return rows
      .slice(1)
      .filter((row) => row.some((cell) => String(cell || "").trim().length > 0))
      .map((row) => {
        const record: Record<string, unknown> = {};
        row.forEach((cell, idx) => {
          const key = headers[idx];
          if (key) {
            record[key] = cell;
          }
        });
        return record;
      });
  };

  const parseSheetRecords = (sheet: XLSX.Sheet): Record<string, unknown>[] => {
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    return raw.map((row) => {
      const record: Record<string, unknown> = {};
      Object.entries(row).forEach(([key, value]) => {
        const normalized = normalizeKey(key);
        if (normalized) {
          record[normalized] = value;
        }
      });
      return record;
    });
  };

  const processImportedDecisions = (entries: DecisionEntry[]) => {
    if (entries.length === 0) {
      setImportError("No valid decisions found in the uploaded file.");
      setImportStatus(null);
      return;
    }

    const existing = loadLog();
    const seen = new Set(existing.map((d) => d.ts));
    let duplicates = 0;

    const unique = entries.filter((entry) => {
      if (seen.has(entry.ts)) {
        duplicates += 1;
        return false;
      }
      seen.add(entry.ts);
      return true;
    });

    if (unique.length === 0) {
      setImportError("All rows matched existing decisions. No new entries were added.");
      setImportStatus(null);
      return;
    }

    const merged = [...unique, ...existing].sort((a, b) => b.ts - a.ts);
    saveLog(merged);
    setDecisions(merged);
    setImportError(null);
    const duplicateNote = duplicates ? ` (${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped)` : "";
    setImportStatus(`${unique.length} decision${unique.length === 1 ? "" : "s"} imported${duplicateNote}.`);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus("Importing...");
    setImportError(null);
    const input = event.target;
    const extension = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onerror = () => {
      setImportError("Failed to read the selected file.");
      setImportStatus(null);
      input.value = "";
    };

    if (extension.endsWith(".csv")) {
      reader.onload = (loadEvent) => {
        try {
          const text = String(loadEvent.target?.result || "");
          const rows = parseCSV(text);
          const records = parseCsvRecords(rows);
          const decisions = recordsToDecisions(records);
          processImportedDecisions(decisions);
        } catch (error) {
          console.error("Failed to import CSV:", error);
          setImportError("The CSV file could not be parsed. Please verify the template format.");
          setImportStatus(null);
        } finally {
          input.value = "";
        }
      };
      reader.readAsText(file);
      return;
    }

    if (extension.endsWith(".xlsx") || extension.endsWith(".xls")) {
      reader.onload = (loadEvent) => {
        try {
          const data = loadEvent.target?.result as ArrayBuffer;
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          if (!sheet) {
            throw new Error("Workbook does not contain a readable sheet.");
          }
          const records = parseSheetRecords(sheet);
          const decisions = recordsToDecisions(records);
          processImportedDecisions(decisions);
        } catch (error) {
          console.error("Failed to import Excel:", error);
          setImportError("The Excel file could not be parsed. Please verify the template format.");
          setImportStatus(null);
        } finally {
          input.value = "";
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    setImportError("Unsupported file type. Please upload a CSV or Excel file.");
    setImportStatus(null);
    input.value = "";
  };

  const handleDownloadTemplate = (type: "csv" | "xlsx") => {
    const header = [
      "Date",
      "Name",
      "Category",
      "Impact",
      "Cost",
      "Risk",
      "Urgency",
      "Confidence",
    ];
    const sample = [
      new Date().toISOString().split("T")[0],
      "Investor update call",
      "Growth",
      "8",
      "3",
      "4",
      "7",
      "6",
    ];

    if (type === "csv") {
      const csvContent = [header.join(","), sample.join(",")].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      downloadBlob(blob, "dnav-import-template.csv");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([header, sample]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "dnav-import-template.xlsx");
  };

  const triggerImport = () => {
    setImportStatus(null);
    setImportError(null);
    fileInputRef.current?.click();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return isCompact 
      ? date.toLocaleDateString()
      : date.toLocaleString();
  };

  const getValueColor = (value: number, type: "return" | "stability" | "pressure") => {
    if (type === "pressure") {
      if (value > 0) return "text-red-600";
      if (value < 0) return "text-green-600";
      return "text-yellow-600";
    }
    if (value > 0) return "text-green-600";
    if (value < 0) return "text-red-600";
    return "text-yellow-600";
  };

  return (
    <div className="max-w-6xl mx-auto grid gap-4 grid-cols-1">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <CardTitle>Decision Log</CardTitle>
            <Badge variant="outline">{decisions.length} decisions</Badge>
          </div>
          <div className="flex gap-2 items-center flex-wrap justify-end">
            <label className="text-muted-foreground flex gap-1.5 items-center">
              <Checkbox
                checked={isCompact}
                onCheckedChange={(checked) => setIsCompact(checked as boolean)}
              />
              Compact view
            </label>
            <Button
              variant="ghost"
              onClick={() => handleDownloadTemplate("csv")}
            >
              <FileText className="h-4 w-4 mr-2" />
              CSV Template
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleDownloadTemplate("xlsx")}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel Template
            </Button>
            <Button variant="default" onClick={triggerImport}>
              <Upload className="h-4 w-4 mr-2" />
              Import Decisions
            </Button>
            <Button variant="secondary" onClick={handleExportCSV} disabled={decisions.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
            <Button variant="destructive" onClick={handleClearAll} disabled={decisions.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </CardHeader>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={handleFileChange}
        />
        <CardContent>
          {(importStatus || importError) && (
            <div className="mb-4 space-y-1 text-sm">
              {importStatus && <p className="text-green-600">{importStatus}</p>}
              {importError && <p className="text-destructive">{importError}</p>}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Impact</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Risk</TableHead>
                <TableHead className="text-right">Urgency</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead className="text-right">Return</TableHead>
                <TableHead className="text-right">Pressure</TableHead>
                <TableHead className="text-right">Stability</TableHead>
                <TableHead className="text-right">D-NAV</TableHead>
                <TableHead className="text-center">✕</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-8 w-8" />
                      <p>No decisions saved yet</p>
                      <p className="text-sm">Go to the Calculator to create your first decision</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                decisions.map((decision) => (
                  <TableRow key={decision.ts}>
                    <TableCell className="font-medium">
                      {formatDate(decision.ts)}
                    </TableCell>
                    <TableCell className="font-medium">{decision.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{decision.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{decision.impact}</TableCell>
                    <TableCell className="text-right">{decision.cost}</TableCell>
                    <TableCell className="text-right">{decision.risk}</TableCell>
                    <TableCell className="text-right">{decision.urgency}</TableCell>
                    <TableCell className="text-right">{decision.confidence}</TableCell>
                    <TableCell className={`text-right font-medium ${getValueColor(decision.return, "return")}`}>
                      {decision.return.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${getValueColor(decision.pressure, "pressure")}`}>
                      {decision.pressure.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${getValueColor(decision.stability, "stability")}`}>
                      {decision.stability.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      {decision.dnav.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDecision(decision.ts)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
