"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/Portal";

type TooltipSide = "top" | "right" | "bottom" | "left";

interface GlassyTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: TooltipSide;
  sideOffset?: number;
  className?: string;
  triggerClassName?: string;
}

export function GlassyTooltip({
  content,
  children,
  side = "top",
  sideOffset = 10,
  className,
  triggerClassName,
}: GlassyTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const tooltipId = React.useId();
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    const tooltip = tooltipRef.current;

    if (tooltip) {
      tooltip.removeAttribute("data-side");
    }

    setOpen(nextOpen);
  }, []);

  const positionNow = React.useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;

    if (!trigger || !tooltip) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerX = triggerRect.left + triggerRect.width / 2;
    const centerY = triggerRect.top + triggerRect.height / 2;
    const safePadding = 8;

    let nextSide: TooltipSide = side;
    let top = 0;
    let left = 0;

    if (side === "top" || side === "bottom") {
      const topPlacement = triggerRect.top - tooltipRect.height - sideOffset;
      const bottomPlacement = triggerRect.bottom + sideOffset;
      const shouldFlipToBottom = side === "top" && topPlacement < safePadding;
      const shouldFlipToTop = side === "bottom" && bottomPlacement + tooltipRect.height > viewportHeight - safePadding;

      if (shouldFlipToBottom) {
        nextSide = "bottom";
        top = bottomPlacement;
      } else if (shouldFlipToTop) {
        nextSide = "top";
        top = topPlacement;
      } else {
        top = side === "top" ? topPlacement : bottomPlacement;
      }

      left = centerX - tooltipRect.width / 2;
    } else {
      const rightPlacement = triggerRect.right + sideOffset;
      const leftPlacement = triggerRect.left - tooltipRect.width - sideOffset;
      const shouldFlipToLeft = side === "right" && rightPlacement + tooltipRect.width > viewportWidth - safePadding;
      const shouldFlipToRight = side === "left" && leftPlacement < safePadding;

      if (shouldFlipToLeft) {
        nextSide = "left";
        left = leftPlacement;
      } else if (shouldFlipToRight) {
        nextSide = "right";
        left = rightPlacement;
      } else {
        left = side === "right" ? rightPlacement : leftPlacement;
      }

      top = centerY - tooltipRect.height / 2;
    }

    top = Math.min(Math.max(safePadding, top), viewportHeight - tooltipRect.height - safePadding);
    left = Math.min(Math.max(safePadding, left), viewportWidth - tooltipRect.width - safePadding);

    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.setAttribute("data-side", nextSide);
  }, [side, sideOffset]);

  React.useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const tooltip = tooltipRef.current;
    if (tooltip) {
      tooltip.dataset.positioned = "false";
      tooltip.style.visibility = "hidden";
      tooltip.style.left = "0px";
      tooltip.style.top = "0px";
      tooltip.style.transform = "none";
    }

    positionNow();
    const raf = requestAnimationFrame(() => {
      if (tooltip) {
        tooltip.dataset.positioned = "true";
        tooltip.style.visibility = "visible";
      }
    });

    const handleResize = () => positionNow();
    const handleScroll = () => positionNow();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleOpenChange(false);
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("keydown", handleKeyDown);

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(handleResize);

    if (observer && triggerRef.current) {
      observer.observe(triggerRef.current);
    }

    if (observer && tooltipRef.current) {
      observer.observe(tooltipRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleKeyDown);
      observer?.disconnect();
    };
  }, [handleOpenChange, open, positionNow]);

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex items-center no-underline", triggerClassName)}
      onMouseEnter={() => handleOpenChange(true)}
      onMouseLeave={() => handleOpenChange(false)}
      onFocus={() => handleOpenChange(true)}
      onBlur={() => handleOpenChange(false)}
      aria-describedby={open ? tooltipId : undefined}
    >
      {children}
      {open ? (
        <Portal>
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            data-positioned="false"
            className={cn(
              "group pointer-events-none fixed left-0 top-0 z-50 max-w-xs scale-95 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white shadow-[0_24px_80px_-50px_rgba(0,0,0,0.8)] backdrop-blur-xl opacity-0 transition-all duration-150 ease-out data-[positioned=true]:scale-100 data-[positioned=true]:opacity-100",
              className
            )}
          >
            <span className="absolute size-3 rotate-45 border border-white/20 bg-white/20 backdrop-blur-xl group-data-[side=top]:-bottom-1.5 group-data-[side=top]:left-1/2 group-data-[side=top]:-translate-x-1/2 group-data-[side=bottom]:-top-1.5 group-data-[side=bottom]:left-1/2 group-data-[side=bottom]:-translate-x-1/2 group-data-[side=left]:-right-1.5 group-data-[side=left]:top-1/2 group-data-[side=left]:-translate-y-1/2 group-data-[side=right]:-left-1.5 group-data-[side=right]:top-1/2 group-data-[side=right]:-translate-y-1/2" />
            {content}
          </div>
        </Portal>
      ) : null}
    </span>
  );
}
