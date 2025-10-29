"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDemo } from "@/hooks/use-demo";
import { ChevronLeft, ChevronRight, Info, Play, Square, X } from "lucide-react";

interface DemoOverlayProps {
  className?: string;
}

export default function DemoOverlay({ className }: DemoOverlayProps) {
  const { demoState, stopDemo, nextStep, prevStep } = useDemo();

  if (!demoState.isActive || !demoState.currentStep) {
    return null;
  }

  const currentStep = demoState.currentStep;
  const progress = demoState.progress;

  // Get tooltip position and content based on active element
  const getTooltipInfo = (): { side: "top" | "bottom" | "left" | "right"; content: string } => {
    if (!demoState.highlightedElement) return { side: "top", content: "" };

    const element = document.getElementById(demoState.highlightedElement);
    if (!element) return { side: "top", content: "" };

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Determine side based on element position
    let side: "top" | "bottom" | "left" | "right" = "top";
    if (rect.top < viewportHeight / 2) {
      side = "bottom";
    }

    // Get tooltip content based on current step
    const tooltips: Record<string, string> = {
      welcome:
        "This is the Decision Variables section where you'll rate each factor from 1-10 based on your current context and feelings.",
      "impact-slider":
        "Impact measures the expected benefit or upside of your decision. Higher values indicate greater potential positive outcomes.",
      "cost-slider":
        "Cost represents the money, time, or effort required for this decision. Lower values mean less resource investment needed.",
      "risk-slider":
        "Risk assesses what could go wrong. Higher values indicate greater potential for negative consequences.",
      "urgency-slider":
        "Urgency measures how soon action is needed. Higher values mean the decision can't wait much longer.",
      "confidence-slider":
        "Confidence reflects your evidence, readiness, and conviction about this decision. Higher values mean you're more certain.",
      "metrics-view":
        "These Key Metrics update in real-time as you adjust variables. They show Return (Impact - Cost), Stability (Confidence - Risk), and Pressure (Urgency - Confidence).",
      "summary-view":
        "The Decision Summary shows your composite D-NAV score, decision archetype, and key insights - essentially your decision's 'report card'.",
      "coach-view":
        "The Coach provides personalized recommendations based on your decision profile, analyzing patterns and suggesting improvements.",
      complete:
        "You've completed the demo! Try adjusting the sliders yourself to see how different values affect your decision profile.",
    };

    return {
      side,
      content:
        tooltips[currentStep.id] || "This step will guide you through using D-NAV effectively.",
    };
  };

  return (
    <TooltipProvider>
      {/* Overlay backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" />

      {/* Highlighted element overlay */}
      {demoState.highlightedElement && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            // This will be positioned by the target element
            border: "3px solid #3b82f6",
            borderRadius: "8px",
            boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.3)",
            animation: "pulse 2s infinite",
          }}
        />
      )}

      {/* Demo control panel */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10001">
        <Card className="w-96 shadow-xl">
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-sm">Interactive Demo</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
                        <Info className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={getTooltipInfo().side} className="max-w-xs p-2 z-10000">
                      <p className="text-sm">{getTooltipInfo().content}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Button variant="ghost" size="sm" onClick={stopDemo} className="h-6 w-6 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Step {demoState.currentStepIndex + 1} of 10</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Current step content */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">{currentStep.title}</h3>
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  disabled={demoState.currentStepIndex === 0}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopDemo}
                    className="flex items-center gap-1"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>

                  <Button size="sm" onClick={nextStep} className="flex items-center gap-1">
                    {demoState.currentStepIndex === 9 ? (
                      "Finish"
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </TooltipProvider>
  );
}
