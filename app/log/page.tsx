"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DecisionEntry } from "@/lib/calculations";
import { loadLog, removeDecision, clearLog } from "@/lib/storage";
import { Trash2, Download, FileText, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

export default function LogPage() {
  const [decisions, setDecisions] = useState<DecisionEntry[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const [selectedDecisions, setSelectedDecisions] = useState<Set<number>>(new Set());

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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dnav-decisions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          <div className="flex gap-2 items-center flex-wrap">
            <label className="text-muted-foreground flex gap-1.5 items-center">
              <Checkbox 
                checked={isCompact}
                onCheckedChange={(checked) => setIsCompact(checked as boolean)}
              /> 
              Compact view
            </label>
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
        <CardContent>
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
