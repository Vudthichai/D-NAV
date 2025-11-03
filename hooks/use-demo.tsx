"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface DemoStep {
  id: string;
  title: string;
  description: string;
  targetElement: string | null;
  action: () => void;
  duration: number;
}

interface DemoContextType {
  demoState: {
    isActive: boolean;
    currentStepIndex: number;
    currentStep: DemoStep | null;
    highlightedElement: string | null;
    progress: number;
    elapsed: number;
    totalDuration: number;
    stepsCount: number;
  };
  startDemo: (steps: DemoStep[]) => void;
  stopDemo: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const DEFAULT_STEP_DURATION = 3000;

const getStepDuration = (step?: DemoStep) => step?.duration ?? DEFAULT_STEP_DURATION;

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const stepsRef = useRef<DemoStep[]>([]);
  const totalDurationRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const stepStartRef = useRef(0);
  const accumulatedRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const sumDurationsUntil = useCallback((index: number) => {
    let total = 0;
    for (let i = 0; i < index; i += 1) {
      total += getStepDuration(stepsRef.current[i]);
    }
    return total;
  }, []);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const startDemo = useCallback(
    (demoSteps: DemoStep[]) => {
      clearTimers();
      stepsRef.current = demoSteps;
      totalDurationRef.current = demoSteps.reduce(
        (total, step) => total + getStepDuration(step),
        0,
      );
      setSteps(demoSteps);
      setElapsed(0);
      setCurrentStepIndex(0);
      setIsActive(true);
    },
    [clearTimers],
  );

  const stopDemo = useCallback(() => {
    clearTimers();
    setIsActive(false);
    setCurrentStepIndex(0);
    setSteps([]);
    stepsRef.current = [];
    totalDurationRef.current = 0;
    setElapsed(0);
  }, [clearTimers]);

  const nextStep = useCallback(() => {
    if (!stepsRef.current.length) return;
    clearTimers();
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next >= stepsRef.current.length) {
        stopDemo();
        return prev;
      }
      return next;
    });
  }, [clearTimers, stopDemo]);

  const prevStep = useCallback(() => {
    if (!stepsRef.current.length) return;
    clearTimers();
    setCurrentStepIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }, [clearTimers]);

  useEffect(() => {
    if (!isActive) {
      clearTimers();
      return;
    }

    const currentStep = stepsRef.current[currentStepIndex];
    if (!currentStep) {
      stopDemo();
      return;
    }

    clearTimers();

    accumulatedRef.current = sumDurationsUntil(currentStepIndex);
    setElapsed(accumulatedRef.current);

    currentStep.action();

    const duration = getStepDuration(currentStep);
    stepStartRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const delta = now - stepStartRef.current;
      const stepProgress = Math.min(delta / duration, 1);
      setElapsed(accumulatedRef.current + stepProgress * duration);
      if (stepProgress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    timerRef.current = window.setTimeout(() => {
      setCurrentStepIndex((prev) => {
        const next = prev + 1;
        if (next >= stepsRef.current.length) {
          stopDemo();
          return prev;
        }
        return next;
      });
    }, duration);

    return () => {
      clearTimers();
    };
  }, [currentStepIndex, isActive, clearTimers, stopDemo, sumDurationsUntil]);

  const currentStep = steps[currentStepIndex] || null;
  const totalDuration = totalDurationRef.current;
  const progress = totalDuration
    ? Math.min(100, (elapsed / totalDuration) * 100)
    : 0;

  const demoState = {
    isActive,
    currentStepIndex,
    currentStep,
    highlightedElement: currentStep?.targetElement || null,
    progress,
    elapsed,
    totalDuration,
    stepsCount: steps.length,
  };

  return (
    <DemoContext.Provider value={{ demoState, startDemo, stopDemo, nextStep, prevStep }}>
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
