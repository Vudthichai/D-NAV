"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface DemoStep {
  id: string;
  title: string;
  description: string;
  targetElement: string | null;
  action: () => void;
}

interface DemoContextType {
  demoState: {
    isActive: boolean;
    currentStepIndex: number;
    currentStep: DemoStep | null;
    highlightedElement: string | null;
    progress: number;
  };
  startDemo: (steps: DemoStep[]) => void;
  stopDemo: () => void;
  nextStep: () => void;
  prevStep: () => void;
  registerAction: (stepId: string, action: () => void) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const registeredActions = useRef<Map<string, () => void>>(new Map());
  const originalScrollPosition = useRef<number>(0);
  const originalOverflow = useRef<string>("");

  const currentStep = steps[currentStepIndex] || null;
  const progress = steps.length > 0 ? (currentStepIndex / (steps.length - 1)) * 100 : 0;

  const startDemo = useCallback((demoSteps: DemoStep[]) => {
    // Save current position but don't lock scroll during demo
    originalScrollPosition.current = window.scrollY;
    originalOverflow.current = document.body.style.overflow;

    // Add a scroll prevention handler instead of CSS lock
    const preventScroll = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Store the handler for cleanup
    (window as any).demoScrollPrevention = preventScroll;

    // Prevent scroll via wheel and touch events
    document.addEventListener("wheel", preventScroll, { passive: false });
    document.addEventListener("touchmove", preventScroll, { passive: false });
    document.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) {
        e.preventDefault();
      }
    });

    setSteps(demoSteps);
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const stopDemo = useCallback(() => {
    // Remove scroll prevention handlers
    const preventScroll = (window as any).demoScrollPrevention;
    if (preventScroll) {
      document.removeEventListener("wheel", preventScroll);
      document.removeEventListener("touchmove", preventScroll);
      document.removeEventListener("keydown", preventScroll);
      delete (window as any).demoScrollPrevention;
    }

    // Restore original scroll state
    document.body.style.overflow = originalOverflow.current;
    document.body.classList.remove("no-scroll");
    window.scrollTo(0, originalScrollPosition.current);

    // Clean up any highlighted elements
    const highlightedElements = document.querySelectorAll('[class*="ring-4"]');
    highlightedElements.forEach((el) => {
      el.classList.remove("ring-4", "ring-blue-500/50", "ring-offset-2", "demo-highlighted");
      (el as HTMLElement).style.zIndex = "";
      (el as HTMLElement).style.position = "";
    });

    setIsActive(false);
    setCurrentStepIndex(0);
    setSteps([]);
    registeredActions.current.clear();
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep) {
      const action = registeredActions.current.get(currentStep.id) || currentStep.action;
      action();
    }

    setCurrentStepIndex((prev) => {
      if (prev < steps.length - 1) {
        return prev + 1;
      }
      stopDemo();
      return prev;
    });
  }, [currentStep, steps.length, stopDemo]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  const registerAction = useCallback((stepId: string, action: () => void) => {
    registeredActions.current.set(stepId, action);
  }, []);

  // Removed auto-progression - users will manually advance steps

  const demoState = {
    isActive,
    currentStepIndex,
    currentStep,
    highlightedElement: currentStep?.targetElement || null,
    progress,
  };

  return (
    <DemoContext.Provider
      value={{ demoState, startDemo, stopDemo, nextStep, prevStep, registerAction }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used within a DemoProvider");
  }
  return context;
}
