"use client";

import { ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import Portal from "@/components/ui/Portal";
import { cn } from "@/lib/utils";

const VIEWPORT_PADDING = 8;

type TooltipSide = "top" | "right";

interface GlassyTooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  offset?: number;
  className?: string;
  triggerClassName?: string;
}

function hasOverflowAncestor(element: HTMLElement | null) {
  let node = element?.parentElement ?? null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowValues = [style.overflow, style.overflowX, style.overflowY];
    if (overflowValues.some((value) => ["auto", "scroll", "hidden", "clip"].includes(value))) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function GlassyTooltip({
  content,
  children,
  side = "top",
  offset = 8,
  className,
  triggerClassName,
}: GlassyTooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [shouldPortal, setShouldPortal] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: side as TooltipSide });

  const close = useCallback(() => setOpen(false), []);
  const openTooltip = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  useLayoutEffect(() => {
    if (!open) {
      setIsPositioned(false);
      return;
    }

    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    setIsPositioned(false);
    const portalNeeded = hasOverflowAncestor(trigger);
    setShouldPortal(portalNeeded);

    const updatePosition = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const spaceAbove = triggerRect.top;
      const spaceRight = window.innerWidth - triggerRect.right;
      const fitsTop = spaceAbove >= tooltipRect.height + offset + VIEWPORT_PADDING;
      const fitsRight = spaceRight >= tooltipRect.width + offset + VIEWPORT_PADDING;

      let placement: TooltipSide = side;
      if (side === "top" && !fitsTop && fitsRight) {
        placement = "right";
      } else if (side === "right" && !fitsRight && fitsTop) {
        placement = "top";
      }

      let top = 0;
      let left = 0;
      if (placement === "top") {
        top = triggerRect.top - tooltipRect.height - offset;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      } else {
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.right + offset;
      }

      left = clamp(left, VIEWPORT_PADDING, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING);
      top = clamp(top, VIEWPORT_PADDING, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING);

      setCoords({ top, left, placement });
      setIsPositioned(true);
    };

    const frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [open, offset, side]);

  const tooltipBody = (
    <div
      ref={tooltipRef}
      role="tooltip"
      id={id}
      className={cn(
        "pointer-events-none fixed z-50 max-w-[240px] rounded-xl border border-border/50 bg-background/80 px-3 py-2 text-xs text-foreground shadow-[0_20px_50px_-30px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-opacity",
        isPositioned ? "opacity-100" : "opacity-0",
        className,
      )}
      style={{ top: coords.top, left: coords.left }}
    >
      {content}
    </div>
  );

  return (
    <span
      ref={triggerRef}
      className={cn("relative inline-flex items-center", triggerClassName)}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={openTooltip}
      onMouseLeave={close}
      onFocus={openTooltip}
      onBlur={close}
    >
      {children}
      {open ? (shouldPortal ? <Portal>{tooltipBody}</Portal> : tooltipBody) : null}
    </span>
  );
}
