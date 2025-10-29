"use client";

import { useCallback, useRef } from "react";
import { useDemo } from "./use-demo";

export interface DemoController {
  startDemo: () => void;
  stopDemo: () => void;
  isActive: boolean;
  registerSliderAction: (sliderId: string, action: (value: number) => void) => void;
}

export function useDemoController() {
  const { startDemo: startDemoHook, stopDemo, demoState } = useDemo();
  const sliderActions = useRef<Map<string, (value: number) => void>>(new Map());

  const registerSliderAction = useCallback((sliderId: string, action: (value: number) => void) => {
    sliderActions.current.set(sliderId, action);
  }, []);

  const startDemo = useCallback(() => {
    const demoSteps = [
      {
        id: "welcome",
        title: "Welcome to D-NAV Demo",
        description: "Let's walk through how to use the Decision Navigator. This demo will show you how to rate decision variables and see real-time insights.",
        targetElement: "variables-section",
        action: () => {},
      },
      {
        id: "impact-slider",
        title: "Rate Impact (8/10)",
        description: "First, let's rate the Impact of this decision. Impact represents the expected benefit or upside. We'll set this to 8 for a high-impact decision.",
        targetElement: "impact-slider",
        action: () => {
          const action = sliderActions.current.get("impact");
          if (action) action(8);
        },
      },
      {
        id: "cost-slider",
        title: "Rate Cost (3/10)",
        description: "Next, we'll rate the Cost - the money, time, or effort required. We'll set this to 3, indicating moderate cost.",
        targetElement: "cost-slider",
        action: () => {
          const action = sliderActions.current.get("cost");
          if (action) action(3);
        },
      },
      {
        id: "risk-slider",
        title: "Rate Risk (4/10)",
        description: "Now let's assess the Risk - what could go wrong. We'll set this to 4, showing some risk but not excessive.",
        targetElement: "risk-slider",
        action: () => {
          const action = sliderActions.current.get("risk");
          if (action) action(4);
        },
      },
      {
        id: "urgency-slider",
        title: "Rate Urgency (7/10)",
        description: "Urgency measures how soon action is needed. We'll set this to 7, indicating high urgency.",
        targetElement: "urgency-slider",
        action: () => {
          const action = sliderActions.current.get("urgency");
          if (action) action(7);
        },
      },
      {
        id: "confidence-slider",
        title: "Rate Confidence (6/10)",
        description: "Finally, let's rate Confidence - your evidence, readiness, and conviction. We'll set this to 6, showing good confidence.",
        targetElement: "confidence-slider",
        action: () => {
          const action = sliderActions.current.get("confidence");
          if (action) action(6);
        },
      },
      {
        id: "metrics-view",
        title: "View Key Metrics",
        description: "Watch how the Key Metrics update in real-time as you adjust the variables. These show Return, Stability, and Pressure.",
        targetElement: "metrics-section",
        action: () => {},
      },
      {
        id: "summary-view",
        title: "Decision Summary",
        description: "The Decision Summary shows your composite D-NAV score, archetype, and key insights. This is your decision's 'report card'.",
        targetElement: "summary-section",
        action: () => {},
      },
      {
        id: "coach-view",
        title: "Coach Insight",
        description: "The Coach provides personalized recommendations based on your decision profile. It analyzes patterns and suggests improvements.",
        targetElement: "coach-section",
        action: () => {},
      },
      {
        id: "complete",
        title: "Demo Complete!",
        description: "You've seen how D-NAV works! Try adjusting the sliders yourself to see how different values affect your decision profile.",
        targetElement: null,
        action: () => {},
      },
    ];

    startDemoHook(demoSteps);
  }, [startDemoHook]);

  return {
    startDemo,
    stopDemo,
    isActive: demoState.isActive,
    registerSliderAction,
  };
}
