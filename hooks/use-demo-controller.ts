"use client";

import { useCallback, useEffect, useRef } from "react";
import { DemoStep, useDemo } from "./use-demo";

export interface DemoController {
  startDemo: () => void;
  stopDemo: () => void;
  isActive: boolean;
  registerSliderAction: (sliderId: string, action: (value: number) => void) => void;
}

type SliderId = "impact" | "cost" | "risk" | "urgency" | "confidence";

const SLIDER_IDS: SliderId[] = ["impact", "cost", "risk", "urgency", "confidence"];

export function useDemoController(): DemoController {
  const { startDemo: startDemoHook, stopDemo: stopDemoHook, demoState } = useDemo();
  const sliderActions = useRef<Map<SliderId, (value: number) => void>>(new Map());
  const sliderValues = useRef<Record<SliderId, number>>({
    impact: 0,
    cost: 0,
    risk: 0,
    urgency: 0,
    confidence: 0,
  });
  const timeouts = useRef<number[]>([]);

  const clearScheduled = useCallback(() => {
    timeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeouts.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      timeouts.current = timeouts.current.filter((id) => id !== timeoutId);
      fn();
    }, delay);
    timeouts.current.push(timeoutId);
    return timeoutId;
  }, []);

  const setSliderValue = useCallback((sliderId: SliderId, value: number) => {
    const action = sliderActions.current.get(sliderId);
    if (!action) return;
    sliderValues.current[sliderId] = value;
    action(value);
  }, []);

  const animateSlider = useCallback(
    (sliderId: SliderId, target: number, duration = 1600) => {
      const action = sliderActions.current.get(sliderId);
      if (!action) return;

      const start = sliderValues.current[sliderId] ?? 0;
      const diff = target - start;
      const steps = Math.max(1, Math.abs(diff) * 6);
      const stepDuration = duration / steps;

      for (let i = 1; i <= steps; i += 1) {
        schedule(() => {
          const value = Math.round(start + (diff * i) / steps);
          sliderValues.current[sliderId] = value;
          action(value);
        }, stepDuration * i);
      }
    },
    [schedule],
  );

  const registerSliderAction = useCallback((sliderId: string, action: (value: number) => void) => {
    if (!SLIDER_IDS.includes(sliderId as SliderId)) return;
    const typedId = sliderId as SliderId;
    sliderActions.current.set(typedId, (value: number) => {
      sliderValues.current[typedId] = value;
      action(value);
    });
  }, []);

  const stopDemo = useCallback(() => {
    clearScheduled();
    stopDemoHook();
  }, [clearScheduled, stopDemoHook]);

  const startDemo = useCallback(() => {
    clearScheduled();

    SLIDER_IDS.forEach((id) => {
      sliderValues.current[id] = 0;
      setSliderValue(id, 0);
    });

    const demoSteps: DemoStep[] = [
      {
        id: "welcome",
        title: "30-second walkthrough",
        description: "We’ll zero everything out and show how D-NAV responds as each lever moves.",
        targetElement: "variables-section",
        duration: 2800,
        action: () => {
          SLIDER_IDS.forEach((id) => setSliderValue(id, 0));
        },
      },
      {
        id: "impact-slider",
        title: "Dial in the impact",
        description: "High potential upside drives the return story.",
        targetElement: "impact-slider",
        duration: 3600,
        action: () => {
          animateSlider("impact", 8, 3200);
        },
      },
      {
        id: "cost-slider",
        title: "Balance the cost",
        description: "Resource load stays light so the math works.",
        targetElement: "cost-slider",
        duration: 3600,
        action: () => {
          animateSlider("cost", 3, 2600);
        },
      },
      {
        id: "risk-slider",
        title: "Check the risk",
        description: "We keep downside contained to steady the footing.",
        targetElement: "risk-slider",
        duration: 3600,
        action: () => {
          animateSlider("risk", 4, 2600);
        },
      },
      {
        id: "urgency-slider",
        title: "Add urgency",
        description: "Time pressure builds the push to act.",
        targetElement: "urgency-slider",
        duration: 3600,
        action: () => {
          animateSlider("urgency", 7, 2600);
        },
      },
      {
        id: "confidence-slider",
        title: "Gauge confidence",
        description: "Evidence and conviction anchor stability.",
        targetElement: "confidence-slider",
        duration: 3600,
        action: () => {
          animateSlider("confidence", 6, 2600);
        },
      },
      {
        id: "metrics-view",
        title: "Metrics in motion",
        description: "Return, stability, and pressure flex as values shift.",
        targetElement: "metrics-section",
        duration: 3200,
        action: () => {
          schedule(() => animateSlider("impact", 9, 1200), 200);
          schedule(() => animateSlider("impact", 8, 1000), 1700);
          schedule(() => animateSlider("cost", 4, 900), 2100);
          schedule(() => animateSlider("cost", 3, 900), 2800);
        },
      },
      {
        id: "coach-view",
        title: "Coach insight",
        description: "Watch the narrative adapt with each adjustment.",
        targetElement: "coach-section",
        duration: 3200,
        action: () => {
          schedule(() => animateSlider("urgency", 8, 1100), 200);
          schedule(() => animateSlider("confidence", 7, 1200), 1400);
          schedule(() => animateSlider("risk", 3, 1000), 2400);
        },
      },
      {
        id: "complete",
        title: "You're in control",
        description: "Try your own inputs to craft the next decision profile.",
        targetElement: null,
        duration: 2800,
        action: () => {},
      },
    ];

    startDemoHook(demoSteps);
  }, [animateSlider, clearScheduled, schedule, setSliderValue, startDemoHook]);

  useEffect(() => {
    if (!demoState.isActive) {
      clearScheduled();
    }
  }, [demoState.isActive, clearScheduled]);

  return {
    startDemo,
    stopDemo,
    isActive: demoState.isActive,
    registerSliderAction,
  };
}
