"use client";

import DecisionCalculator from "@/components/DecisionCalculator";
import DemoOverlay from "@/components/DemoOverlay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDemoController } from "@/hooks/use-demo-controller";
import { DecisionEntry, DecisionMetrics, DecisionVariables } from "@/lib/calculations";
import { addDecision } from "@/lib/storage";
import { Check, Play, RotateCcw, Save, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

export default function CalculatorPage() {
  const [decisionName, setDecisionName] = useState("");
  const [decisionCategory, setDecisionCategory] = useState("");
  const [showCompare, setShowCompare] = useState(false);
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

  const { startDemo, stopDemo, isActive, registerSliderAction } = useDemoController();

  const handleDataChange = useCallback(
    (newVariables: DecisionVariables, newMetrics: DecisionMetrics) => {
      setVariables(newVariables);
      setMetrics(newMetrics);
      setIsSaved(false); // Reset saved state when data changes
    },
    []
  );

  const handleOpenCompare = () => {
    setShowCompare(true);
  };

  const handleRunDemo = () => {
    // Reset to initial state
    setDecisionName("Demo Decision");
    setDecisionCategory("Demo");
    startDemo();
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

      // Reset saved state after 3 seconds
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
      {/* Demo Overlay */}
      <DemoOverlay />

      {/* Streamlined Calculator Interface */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Decision Calculator</h1>
              <p className="text-muted-foreground mt-1">
                Rate your decision variables and get instant insights
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRunDemo}>
                <Play className="w-4 h-4 mr-2" />
                Run Demo
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Main Calculator */}
        <DecisionCalculator
          onOpenCompare={handleOpenCompare}
          isDemoMode={isActive}
          onDemoStep={(step, action) => {
            registerSliderAction(step, action);
          }}
          onDataChange={handleDataChange}
        />

        {/* Quick Entry */}
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
              <Button
                onClick={handleSaveDecision}
                className="w-full"
                disabled={!decisionName || !decisionCategory}
              >
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

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <Button size="lg" onClick={handleOpenCompare}>
            Compare Decisions
          </Button>
          <Button variant="outline" size="lg" onClick={handleSaveDecision}>
            Save & Continue
          </Button>
        </div>
      </div>

      {/* Floating Compare FAB */}
      <Button
        className="fixed right-6 bottom-6 bg-primary shadow-lg z-50 rounded-full w-14 h-14"
        onClick={handleOpenCompare}
      >
        <Play className="w-5 h-5" />
      </Button>
    </main>
  );
}
