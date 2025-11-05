"use client";

import CompareSheet from "@/components/CompareSheet";
import DecisionCalculator from "@/components/DecisionCalculator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DecisionEntry, DecisionMetrics, DecisionVariables } from "@/lib/calculations";
import { addDecision } from "@/lib/storage";
import { BarChart3, Check, RotateCcw, Save, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

export default function CalculatorPage() {
  const [showCompare, setShowCompare] = useState(false);
  const [decisionName, setDecisionName] = useState("");
  const [decisionCategory, setDecisionCategory] = useState("");
  const [variables, setVariables] = useState<DecisionVariables>({
    impact: 1,
    cost: 1,
    risk: 1,
    urgency: 1,
    confidence: 1,
  });
  const [metrics, setMetrics] = useState<DecisionMetrics>({
    return: 0,
    stability: 0,
    pressure: 0,
    merit: 0,
    energy: 0,
    dnav: 0,
  });
  const [isSaved, setIsSaved] = useState(false);

  const handleDataChange = useCallback(
    (newVariables: DecisionVariables, newMetrics: DecisionMetrics) => {
      setVariables(newVariables);
      setMetrics(newMetrics);
      setIsSaved(false);
    },
    [],
  );

  const handleOpenCompare = () => {
    setShowCompare(true);
  };

  const handleSaveDecision = () => {
    if (!decisionName.trim() || !decisionCategory.trim()) {
      alert("Please enter both a decision name and category before saving.");
      return;
    }

    const decisionEntry: DecisionEntry = {
      ...variables,
      ...metrics,
      ts: Date.now(),
      name: decisionName.trim(),
      category: decisionCategory.trim(),
    };

    try {
      addDecision(decisionEntry);
      setIsSaved(true);

      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save decision:", error);
      alert("Failed to save decision. Please try again.");
    }
  };

  const handleReset = () => {
    setDecisionName("");
    setDecisionCategory("");
    setVariables({
      impact: 1,
      cost: 1,
      risk: 1,
      urgency: 1,
      confidence: 1,
    });
    setMetrics({
      return: 0,
      stability: 0,
      pressure: 0,
      merit: 0,
      energy: 0,
      dnav: 0,
    });
    setIsSaved(false);
  };

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">The Decision NAVigator</h1>
              <p className="text-muted-foreground mt-1">
                Rate your decision variables and watch the model respond in real time
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </div>

        <DecisionCalculator onOpenCompare={handleOpenCompare} onDataChange={handleDataChange} />

        <Card className="mt-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Quick Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Input
                type="text"
                placeholder="Decision name (e.g., 'Investor meetup solo')"
                value={decisionName}
                onChange={(e) => setDecisionName(e.target.value)}
              />
              <Input
                type="text"
                placeholder="Category (e.g., Career, Health, Relationships)"
                value={decisionCategory}
                onChange={(e) => setDecisionCategory(e.target.value)}
              />
              <Button onClick={handleSaveDecision} className="w-full" disabled={!decisionName || !decisionCategory}>
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Decision
                  </>
                )}
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/log#import">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Decisions
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex justify-center gap-4">
          <Button size="lg" onClick={handleOpenCompare}>
            Compare Decisions
          </Button>
          <Button variant="outline" size="lg" onClick={handleSaveDecision}>
            Save & Continue
          </Button>
        </div>
      </div>

      <Button
        className="fixed right-6 bottom-6 bg-primary shadow-lg z-50 rounded-full w-14 h-14"
        onClick={handleOpenCompare}
      >
        <BarChart3 className="w-5 h-5" />
      </Button>

      <CompareSheet
        open={showCompare}
        onOpenChange={setShowCompare}
        baseVariables={variables}
        baseMetrics={metrics}
      />
    </main>
  );
}
