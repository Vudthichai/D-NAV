"use client";

import DatasetSelect from "@/components/DatasetSelect";
import { useDataset } from "@/components/DatasetProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DecisionEntry, computeMetrics, parseCSV } from "@/lib/calculations";
import { getDatasetDisplayLabel } from "@/lib/reportDatasets";
import { type CompanyContext } from "@/types/company";
import { datasetMetaToCompanyContext, type DatasetMeta } from "@/types/dataset";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";

export interface DecisionRow {
  date: string;
  decisionName: string;
  category: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
}

type QuickEntry = {
  name: string;
  category: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
};

type QuickMetricKey = "impact" | "cost" | "risk" | "urgency" | "confidence";

type ParsedRecord =
  Partial<Record<keyof DecisionRow, string | number | null>> &
  Record<string, unknown>;

export default function LogContent() {
  const searchParams = useSearchParams();
  const [isCompact, setIsCompact] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const categoryParam = useMemo(() => searchParams.get("category")?.trim() ?? "", [searchParams]);
  const [quickEntry, setQuickEntry] = useState<QuickEntry>({
    name: "",
    category: "",
    impact: 5,
    cost: 5,
    risk: 5,
    urgency: 5,
    confidence: 5,
  });
  const [companyContext, setCompanyContext] = useState<CompanyContext>({
    companyName: "",
    timeframeLabel: "",
    type: undefined,
  });
  const {
    datasets,
    activeDatasetId: datasetId,
    activeDataset,
    meta,
    decisions,
    setDecisions,
    addDataset,
    deleteDataset,
    setDatasetLabel,
    setDatasetMeta,
    isDatasetLoading,
    loadError,
  } = useDataset();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanyContext(datasetMetaToCompanyContext(meta));
  }, [datasetId, meta]);

  useEffect(() => {
    if (!categoryParam) return;
    setQuickEntry((prev) => (prev.category ? prev : { ...prev, category: categoryParam }));
  }, [categoryParam]);

  const handleDeleteDecision = (timestamp: number) => {
    if (confirm("Are you sure you want to delete this decision?")) {
      setDecisions((prev) => prev.filter((decision) => decision.ts !== timestamp));
    }
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all decisions? This action cannot be undone.")) {
      setDecisions([]);
    }
  };

  const applyMetaPatch = (field: keyof CompanyContext, value: string | CompanyContext["type"] | CompanyContext["stage"] | CompanyContext["source"] | undefined) => {
    if (!datasetId) return;

    const metaPatch: Partial<DatasetMeta> = {};
    if (field === "companyName") {
      metaPatch.companyName = typeof value === "string" ? value : "";
    } else if (field === "timeframeLabel") {
      const label = typeof value === "string" ? value : "";
      metaPatch.periodLabel = label;
      metaPatch.displayLabel = label;
    } else if (field === "sector") {
      metaPatch.sector = typeof value === "string" ? value : undefined;
    } else if (field === "contextNote") {
      metaPatch.contextNote = typeof value === "string" ? value : undefined;
    } else if (field === "ticker") {
      metaPatch.ticker = typeof value === "string" ? value : undefined;
    } else if (field === "stage") {
      metaPatch.stage = value as CompanyContext["stage"];
    } else if (field === "type") {
      metaPatch.type = value as CompanyContext["type"];
    } else if (field === "source") {
      metaPatch.source = value as CompanyContext["source"];
    }

    setDatasetMeta(datasetId, metaPatch);
  };

  const handleContextChange = (
    field: keyof CompanyContext,
    value: string | CompanyContext["type"] | CompanyContext["stage"] | CompanyContext["source"],
  ) => {
    setCompanyContext((prev) => ({
      ...prev,
      [field]: typeof value === "string" ? value : value || undefined,
    }));
    applyMetaPatch(field, value);
  };

  const handleContextInput = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    handleContextChange(name as keyof CompanyContext, value);
  };

  const clampMetric = (value: number) => Math.min(10, Math.max(1, value));

  const handleQuickMetricChange = (field: QuickMetricKey, value: string) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setQuickEntry((prev) => ({ ...prev, [field]: clampMetric(numeric) }));
  };

  const handleQuickAddDecision = () => {
    if (!quickEntry.name.trim() || !quickEntry.category.trim()) {
      alert("Please enter both a decision name and category before saving.");
      return;
    }

    const metrics = computeMetrics({
      impact: quickEntry.impact,
      cost: quickEntry.cost,
      risk: quickEntry.risk,
      urgency: quickEntry.urgency,
      confidence: quickEntry.confidence,
    });

    const entry: DecisionEntry = {
      ts: Date.now(),
      name: quickEntry.name.trim(),
      category: quickEntry.category.trim(),
      impact: quickEntry.impact,
      cost: quickEntry.cost,
      risk: quickEntry.risk,
      urgency: quickEntry.urgency,
      confidence: quickEntry.confidence,
      ...metrics,
    };

    setDecisions((prev) => [entry, ...prev]);
    setQuickEntry((prev) => ({ ...prev, name: "" }));
  };

  const handleDeleteDataset = () => {
    if (!datasetId) return;
    if (datasets.length <= 1) return;
    if (decisions.length > 0) {
      const confirmed = confirm(
        "Delete this dataset and all of its decisions? This action cannot be undone.",
      );
      if (!confirmed) return;
    }
    deleteDataset(datasetId);
  };

  const handleDatasetLabelChange = (value: string) => {
    if (!datasetId) return;
    setDatasetLabel(datasetId, value);
  };

  const handleDatasetLabelBlur = () => {
    if (!datasetId) return;
    const trimmed = (activeDataset?.label ?? "").trim();
    if (trimmed) return;
    const datasetIndex = datasets.findIndex((dataset) => dataset.id === datasetId);
    const fallbackLabel = datasetIndex >= 0 ? getDatasetDisplayLabel(datasetIndex) : "Dataset";
    setDatasetLabel(datasetId, fallbackLabel);
  };

  const handleJudgmentUnitChange = (value: string) => {
    if (!datasetId) return;
    setDatasetMeta(datasetId, { judgmentUnitLabel: value });
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

  const handleParsingError = (error: unknown, fallback: string) => {
    console.error(fallback, error);
    const message = error instanceof Error ? error.message : fallback;
    setImportError(message);
    setImportStatus(null);
  };

  const REQUIRED_HEADERS: Record<string, keyof DecisionRow> = {
    date: "date",
    "decision name": "decisionName",
    category: "category",
    impact: "impact",
    cost: "cost",
    risk: "risk",
    urgency: "urgency",
    confidence: "confidence",
  };

  const OPTIONAL_HEADERS = new Set([
    "return",
    "pressure",
    "stability",
    "r",
    "p",
    "s",
    "merit",
    "energy",
    "d-nav",
    "dnav",
    "notes",
    "ticker",
    "year",
  ]);

  const normalizeHeader = (key: string = "") => key.trim().toLowerCase();

  const validateHeaders = (headers: string[]) => {
    const normalized = headers.map(normalizeHeader);
    const missing = Object.keys(REQUIRED_HEADERS).filter((required) => !normalized.includes(required));
    if (missing.length) {
      throw new Error(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
    }
  };

  const handleExportSpreadsheet = () => {
    if (decisions.length === 0) {
      alert("No decisions to export.");
      return;
    }

    const headers = [
      "Date",
      "Decision Name",
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

    const rows = decisions.map((decision) => ({
      Date: new Date(decision.ts).toLocaleDateString(),
      "Decision Name": decision.name,
      Category: decision.category,
      Impact: decision.impact,
      Cost: decision.cost,
      Risk: decision.risk,
      Urgency: decision.urgency,
      Confidence: decision.confidence,
      Return: Number(decision.return.toFixed(2)),
      Stability: Number(decision.stability.toFixed(2)),
      Pressure: Number(decision.pressure.toFixed(2)),
      Merit: Number(decision.merit.toFixed(2)),
      Energy: Number(decision.energy.toFixed(2)),
      "D-NAV": Number(decision.dnav.toFixed(2)),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Decisions");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `dnav-decisions-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const parseNumeric = (value: unknown): number => {
    let numeric: number | null = null;
    if (typeof value === "number" && Number.isFinite(value)) {
      numeric = value;
    } else if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.-]/g, "");
      const parsed = parseFloat(cleaned);
      if (Number.isFinite(parsed)) {
        numeric = parsed;
      }
    }

    if (numeric === null) {
      return 1;
    }

    return Math.min(10, Math.max(1, numeric));
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
    record: ParsedRecord,
    index: number,
    fallbackBase: number
  ): DecisionEntry | null => {
    const name = String(record.decisionName ?? "").trim();
    if (!name) return null;

    const category = String(record.category ?? "General").trim() || "General";
    const impact = parseNumeric(record.impact);
    const cost = parseNumeric(record.cost);
    const risk = parseNumeric(record.risk);
    const urgency = parseNumeric(record.urgency);
    const confidence = parseNumeric(record.confidence);

    const metrics = computeMetrics({ impact, cost, risk, urgency, confidence });
    const ts = parseTimestamp(
      record.date,
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

  const recordsToDecisions = (records: ParsedRecord[]): DecisionEntry[] => {
    const fallbackBase = Date.now();
    return records
      .map((record, index) => mapRecordToDecision(record, index, fallbackBase))
      .filter((decision): decision is DecisionEntry => Boolean(decision));
  };

  type SortKey = "category" | "return" | "stability" | "pressure" | "dnav";
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        const nextDirection = current.direction === "asc" ? "desc" : "asc";
        return { key, direction: nextDirection };
      }
      return { key, direction: "desc" };
    });
  };

  const sortedDecisions = useMemo(() => {
    if (!sortConfig) return [...decisions];
    const list = [...decisions];
    list.sort((a, b) => {
      if (sortConfig.key === "category") {
        const aCategory = a.category.toLowerCase();
        const bCategory = b.category.toLowerCase();
        if (aCategory === bCategory) return 0;
        const comparison = aCategory.localeCompare(bCategory);
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }

      const getNumericValue = (entry: DecisionEntry, key: SortKey) => {
        switch (key) {
          case "return":
            return entry.return;
          case "stability":
            return entry.stability;
          case "pressure":
            return entry.pressure;
          case "dnav":
            return entry.dnav;
          default:
            return 0;
        }
      };

      const aValue = getNumericValue(a, sortConfig.key);
      const bValue = getNumericValue(b, sortConfig.key);
      if (aValue === bValue) return 0;
      return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
    });
    return list;
  }, [decisions, sortConfig]);

  const renderSortButton = (label: string, column: SortKey, alignRight = false) => {
    const isActive = sortConfig?.key === column;
    const Icon = !isActive ? ArrowUpDown : sortConfig?.direction === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          isActive ? "text-foreground" : "text-muted-foreground"
        } hover:text-foreground ${alignRight ? "ml-auto" : ""}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
        {isActive && (
          <span className="sr-only">Sorted {sortConfig?.direction === "asc" ? "ascending" : "descending"}</span>
        )}
      </button>
    );
  };

  const parseCsvRecords = (rows: string[][]): ParsedRecord[] => {
    if (rows.length === 0) return [];
    validateHeaders(rows[0]);
    const headerMap = rows[0].map((header) => {
      const normalized = normalizeHeader(header);
      if (REQUIRED_HEADERS[normalized]) {
        return REQUIRED_HEADERS[normalized];
      }
      if (OPTIONAL_HEADERS.has(normalized)) {
        return null;
      }
      return null;
    });
    return rows
      .slice(1)
      .filter((row) => row.some((cell) => String(cell || "").trim().length > 0))
      .map((row) => {
        const record: ParsedRecord = {};
        row.forEach((cell, idx) => {
          const key = headerMap[idx];
          if (key) {
            record[key] = cell;
          }
        });
        return record;
      });
  };

  const parseSheetRecords = (sheet: XLSX.Sheet): ParsedRecord[] => {
    const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as unknown as string[][];
    const headers = (headerRow[0] || []).map(String);
    validateHeaders(headers);

    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (!raw.length) return [];

    return raw.map((row) => {
      const record: ParsedRecord = {};
      Object.entries(row).forEach(([key, value]) => {
        const normalized = normalizeHeader(key);
        const mappedKey = REQUIRED_HEADERS[normalized];
        if (mappedKey) {
          const normalizedValue =
            typeof value === "number" || typeof value === "string" ? value : null;
          record[mappedKey] = normalizedValue;
        }
      });
      return record;
    });
  };

  const buildDecisionKey = (entry: Pick<DecisionEntry, "name" | "ts">) => {
    const decisionText = entry.name?.trim();
    if (!decisionText) return null;

    const datePart = entry.ts
      ? new Date(entry.ts).toISOString().slice(0, 10)
      : "";

    return `${decisionText} | ${datePart}`;
  };

  const processImportedDecisions = (entries: DecisionEntry[]) => {
    if (entries.length === 0) {
      setImportError("No valid decisions found in the uploaded file.");
      setImportStatus(null);
      return;
    }

    const existing = decisions;
    const seen = new Set(
      existing
        .map((decision) => buildDecisionKey(decision))
        .filter((key): key is string => Boolean(key))
    );
    let duplicates = 0;

    const unique = entries.filter((entry) => {
      const key = buildDecisionKey(entry);
      if (!key) return false;

      if (seen.has(key)) {
        duplicates += 1;
        return false;
      }
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      setImportError("All rows matched existing decisions. No new entries were added.");
      setImportStatus(null);
      return;
    }

    const merged = [...unique, ...existing].sort((a, b) => b.ts - a.ts);
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
          handleParsingError(error, "The CSV file could not be parsed. Please verify the template format.");
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
          handleParsingError(error, "The Excel file could not be parsed. Please verify the template format.");
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
      "Decision Name",
      "Category",
      "Impact",
      "Cost",
      "Risk",
      "Urgency",
      "Confidence",
      "Return",
      "Pressure",
      "Stability",
      "Merit",
      "Energy",
      "D-NAV",
    ];
    const sampleRows = [
      header,
      [
        new Date().toISOString().split("T")[0],
        "Launch beta release",
        "Product",
        "8",
        "3",
        "4",
        "7",
        "6",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [
        "",
        "Investor round prep",
        "Capital",
        "6",
        "5",
        "3",
        "8",
        "7",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ];

    if (type === "csv") {
      const csvContent = sampleRows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      downloadBlob(blob, "dnav-import-template.csv");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sampleRows);
    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 30 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
    ];
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

  const categorySuggestions = useMemo(() => {
    const categorySet = new Set(decisions.map((decision) => decision.category));
    if (categoryParam) categorySet.add(categoryParam);
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  }, [categoryParam, decisions]);

  return (
    <div className="max-w-6xl mx-auto grid gap-4 grid-cols-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DatasetSelect label="Dataset" />
          <Button variant="outline" size="sm" onClick={addDataset}>
            Add dataset
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={datasets.length <= 1}
            onClick={handleDeleteDataset}
          >
            Remove dataset
          </Button>
        </div>
        {loadError ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {loadError}
          </div>
        ) : isDatasetLoading ? (
          <div className="rounded-md border border-muted/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Loading dataset…
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full space-y-2 sm:max-w-md">
          <label className="text-sm font-medium text-foreground" htmlFor="datasetLabel">
            Dataset name
          </label>
          <Input
            id="datasetLabel"
            name="datasetLabel"
            placeholder="e.g., Apple 2020 decisions"
            value={activeDataset?.label ?? ""}
            onChange={(event) => handleDatasetLabelChange(event.target.value)}
            onBlur={handleDatasetLabelBlur}
          />
          <p className="text-xs text-muted-foreground">
            Give each dataset a clear name so comparisons read naturally (e.g., “Tesla decisions 2023” vs “Apple decisions
            2020”).
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Company Context</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="companyName">
                Company name <span className="text-destructive">*</span>
              </label>
              <Input
                id="companyName"
                name="companyName"
                placeholder="e.g., Horizon Labs"
                value={companyContext.companyName}
                onChange={handleContextInput}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="timeframeLabel">
                Timeframe covered <span className="text-destructive">*</span>
              </label>
              <Input
                id="timeframeLabel"
                name="timeframeLabel"
                placeholder="e.g., 2022–2024 or Last 18 months"
                value={companyContext.timeframeLabel}
                onChange={handleContextInput}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="judgmentUnitLabel">
              Judgment Unit (optional)
            </label>
            <Input
              id="judgmentUnitLabel"
              name="judgmentUnitLabel"
              placeholder="e.g. move, play, trade"
              value={meta.judgmentUnitLabel ?? ""}
              onChange={(event) => handleJudgmentUnitChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              What does one decision represent in this dataset? Examples: moves, plays, trades. Defaults to
              “decisions”.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Type</label>
              <Select
                value={companyContext.type}
                onValueChange={(value) => handleContextChange("type", value as CompanyContext["type"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Public",
                    "Private",
                    "Startup",
                    "Non-profit",
                    "Fund",
                    "Other",
                  ].map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="sector">
                Sector
              </label>
              <Input
                id="sector"
                name="sector"
                placeholder="e.g., B2B SaaS"
                value={companyContext.sector || ""}
                onChange={handleContextInput}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Stage</label>
              <Select
                value={companyContext.stage}
                onValueChange={(value) => handleContextChange("stage", value as CompanyContext["stage"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {["Early", "Growth", "Mature", "Turnaround", "Other"].map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="ticker">
                Ticker (if public)
              </label>
              <Input
                id="ticker"
                name="ticker"
                placeholder="e.g., DNAV"
                value={companyContext.ticker || ""}
                onChange={handleContextInput}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Source</label>
              <Select
                value={companyContext.source}
                onValueChange={(value) => handleContextChange("source", value as CompanyContext["source"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {["Public filings", "Internal decision log", "Mixed", "Other"].map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="contextNote">
                Context note
              </label>
              <Textarea
                id="contextNote"
                name="contextNote"
                placeholder="50-person SaaS startup..."
                value={companyContext.contextNote || ""}
                onChange={handleContextInput}
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
            <Button
              variant="secondary"
              onClick={handleExportSpreadsheet}
              disabled={decisions.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Spreadsheet
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
          <div className="mb-4 rounded-lg border border-muted/50 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Quick Log</p>
              <Button size="sm" variant="secondary" onClick={handleQuickAddDecision}>
                Add decision
              </Button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="quickDecisionName">
                  Decision name
                </label>
                <Input
                  id="quickDecisionName"
                  value={quickEntry.name}
                  onChange={(event) => setQuickEntry((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g., Launch beta release"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="quickDecisionCategory">
                  Category
                </label>
                <Input
                  id="quickDecisionCategory"
                  list="log-category-options"
                  value={quickEntry.category}
                  onChange={(event) =>
                    setQuickEntry((prev) => ({ ...prev, category: event.target.value }))
                  }
                  placeholder="e.g., Product"
                />
                <datalist id="log-category-options">
                  {categorySuggestions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
              {([
                { key: "impact", label: "Impact" },
                { key: "cost", label: "Cost" },
                { key: "risk", label: "Risk" },
                { key: "urgency", label: "Urgency" },
                { key: "confidence", label: "Confidence" },
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground" htmlFor={`quick-${key}`}>
                    {label}
                  </label>
                  <Input
                    id={`quick-${key}`}
                    type="number"
                    min={1}
                    max={10}
                    value={quickEntry[key]}
                    onChange={(event) => handleQuickMetricChange(key, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>{renderSortButton("Category", "category")}</TableHead>
                <TableHead className="text-right">Impact</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Risk</TableHead>
                <TableHead className="text-right">Urgency</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead className="text-right">
                  <div className="flex justify-end">{renderSortButton("Return", "return", true)}</div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex justify-end">{renderSortButton("Pressure", "pressure", true)}</div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex justify-end">{renderSortButton("Stability", "stability", true)}</div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex justify-end">{renderSortButton("D-NAV", "dnav", true)}</div>
                </TableHead>
                <TableHead className="text-center">✕</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDecisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-8 w-8" />
                      <p>No decisions saved yet</p>
                      <p className="text-sm">Open Patterns to create your first decision</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedDecisions.map((decision) => (
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
