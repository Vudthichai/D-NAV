"use client";

import { useEffect, useRef } from "react";
import { useDemo } from "./use-demo";

export function useHighlight(elementId: string) {
  const elementRef = useRef<HTMLDivElement>(null);
  const originalStyles = useRef<{ boxShadow: string; borderRadius: string; transform: string }>({
    boxShadow: "",
    borderRadius: "",
    transform: "",
  });
  const { demoState } = useDemo();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const isHighlighted = demoState.highlightedElement === elementId;

    if (isHighlighted) {
      if (!element.classList.contains("demo-highlighted")) {
        originalStyles.current = {
          boxShadow: element.style.boxShadow,
          borderRadius: element.style.borderRadius,
          transform: element.style.transform,
        };
      }

      element.style.position = "relative";
      element.style.zIndex = "9999";
      element.style.transition = "transform 0.3s ease, box-shadow 0.3s ease";
      element.style.boxShadow = "0 0 0 10px rgba(59, 130, 246, 0.25)";
      element.style.borderRadius = "24px";
      element.style.transform = "scale(1.02)";

      const shouldScroll = !element.classList.contains("demo-highlighted");
      element.classList.add("demo-highlighted");

      if (shouldScroll) {
        window.setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }, 100);
      }
    } else {
      element.classList.remove("demo-highlighted");
      element.style.zIndex = "";
      element.style.position = "";
      element.style.boxShadow = originalStyles.current.boxShadow;
      element.style.borderRadius = originalStyles.current.borderRadius;
      element.style.transform = originalStyles.current.transform;
    }
  }, [demoState.highlightedElement, elementId]);

  useEffect(() => {
    return () => {
      const element = elementRef.current;
      if (!element) return;

      element.classList.remove("demo-highlighted");
      element.style.zIndex = "";
      element.style.position = "";
      element.style.boxShadow = originalStyles.current.boxShadow;
      element.style.borderRadius = originalStyles.current.borderRadius;
      element.style.transform = originalStyles.current.transform;
    };
  }, []);

  return elementRef;
}
