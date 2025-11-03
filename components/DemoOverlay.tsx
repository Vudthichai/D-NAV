"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDemo } from "@/hooks/use-demo";
import { ChevronLeft, ChevronRight, Info, Pause, Play, X } from "lucide-react";

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
  const totalSeconds = Math.round(demoState.totalDuration / 1000);
  const remainingSeconds = Math.max(
    0,
    Math.ceil((demoState.totalDuration - demoState.elapsed) / 1000),
  );

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
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" />

      <div className="fixed left-1/2 top-6 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2">
        <Card className="shadow-2xl border border-primary/15 bg-background/95 backdrop-blur">
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  <Play className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight text-foreground">
                    Auto demo in progress
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Step {demoState.currentStepIndex + 1} of {demoState.stepsCount || 1}
                    {totalSeconds ? ` · ${remainingSeconds}s left` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Explain this step"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side={getTooltipInfo().side}
                    className="max-w-sm text-xs leading-relaxed"
                  >
                    {getTooltipInfo().content}
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={stopDemo}
                  className="h-8 w-8"
                  aria-label="Stop demo"
                >
                  <Pause className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={stopDemo}
                  className="h-8 w-8"
                  aria-label="Close demo"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress)}% complete</span>
                {totalSeconds > 0 && (
                  <span>
                    {totalSeconds}s tour · {remainingSeconds}s remaining
                  </span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">{currentStep.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {currentStep.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  disabled={demoState.currentStepIndex === 0}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextStep}
                  disabled={demoState.currentStepIndex >= demoState.stepsCount - 1}
                  className="flex items-center gap-1"
                >
                  Skip
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={stopDemo} className="flex items-center gap-2">
                <Pause className="h-4 w-4" />
                Stop demo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
