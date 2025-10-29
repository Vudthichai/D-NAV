"use client";

import { useEffect, useRef } from "react";
import { useDemo } from "./use-demo";

export function useHighlight(elementId: string) {
  const elementRef = useRef<HTMLDivElement>(null);
  const { demoState } = useDemo();

  useEffect(() => {
    if (elementRef.current) {
      if (demoState.highlightedElement === elementId) {
        // Add highlight styles
        elementRef.current.style.position = "relative";
        elementRef.current.style.zIndex = "9999";
        elementRef.current.style.transition = "all 0.3s ease";

        // Add a pulsing border effect
        elementRef.current.classList.add("ring-4", "ring-blue-500/50", "ring-offset-2");

        // Only scroll if this is a new highlight (not a re-render)
        const shouldScroll = !elementRef.current.classList.contains("demo-highlighted");
        elementRef.current.classList.add("demo-highlighted");

        if (shouldScroll) {
          // Scroll to element smoothly (scroll is already unlocked during demo)
          setTimeout(() => {
            if (elementRef.current) {
              elementRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "center",
              });
            }
          }, 100);
        }
      } else {
        // Remove highlight styles
        elementRef.current.classList.remove(
          "ring-4",
          "ring-blue-500/50",
          "ring-offset-2",
          "demo-highlighted"
        );
        elementRef.current.style.zIndex = "";
        elementRef.current.style.position = "";
      }
    }
  }, [demoState.highlightedElement, elementId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (elementRef.current) {
        elementRef.current.classList.remove(
          "ring-4",
          "ring-blue-500/50",
          "ring-offset-2",
          "demo-highlighted"
        );
        elementRef.current.style.zIndex = "";
        elementRef.current.style.position = "";
      }
    };
  }, []);

  return elementRef;
}
