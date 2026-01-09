"use client";

import Portal from "@/components/ui/Portal";
import { cn } from "@/lib/utils";
import { KeyboardEvent, ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type GlassyTooltipProps = {
  label: string;
  definition: string;
  note?: string;
  children: ReactNode;
  className?: string;
  delayMs?: number;
};

type TooltipPosition = {
  top: number;
  left: number;
  placement: "top" | "right" | "bottom";
};

const VIEWPORT_PADDING = 8;

export default function GlassyTooltip({
  label,
  definition,
  note,
  children,
  className,
  delayMs = 180,
}: GlassyTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const showTooltip = useCallback(() => {
    clearHoverTimeout();
    setOpen(true);
  }, [clearHoverTimeout]);

  const hideTooltip = useCallback(() => {
    clearHoverTimeout();
    setOpen(false);
  }, [clearHoverTimeout]);

  const handleMouseEnter = useCallback(() => {
    clearHoverTimeout();
    hoverTimeoutRef.current = window.setTimeout(() => {
      setOpen(true);
    }, delayMs);
  }, [clearHoverTimeout, delayMs]);

  const handleMouseLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === "Escape") {
        hideTooltip();
      }
    },
    [hideTooltip],
  );

  const updatePosition = useCallback(() => {
    if (!open || !triggerRef.current || !tooltipRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const offset = 10;

    let top = triggerRect.top - tooltipRect.height - offset;
    let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    let placement: TooltipPosition["placement"] = "top";

    if (top < VIEWPORT_PADDING) {
      placement = "right";
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      left = triggerRect.right + offset;

      if (left + tooltipRect.width > viewportWidth - VIEWPORT_PADDING) {
        placement = "bottom";
        top = triggerRect.bottom + offset;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      }
    }

    left = Math.min(Math.max(VIEWPORT_PADDING, left), viewportWidth - tooltipRect.width - VIEWPORT_PADDING);
    top = Math.min(Math.max(VIEWPORT_PADDING, top), viewportHeight - tooltipRect.height - VIEWPORT_PADDING);

    setPosition({ top, left, placement });
  }, [open]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, open, label, definition, note]);

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={showTooltip}
      onBlur={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onPointerDown={showTooltip}
      aria-describedby={tooltipId}
    >
      {children}
      {open ? (
        <Portal>
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className={cn(
              "pointer-events-none fixed z-50 w-max max-w-[240px] rounded-xl border border-border/50 bg-background/70 px-3 py-2 text-xs text-foreground shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)] backdrop-blur-xl",
              "supports-[backdrop-filter]:bg-background/60",
            )}
            style={
              position
                ? {
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                  }
                : undefined
            }
            data-placement={position?.placement}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
              {note ? <span className="text-muted-foreground/70">{` (${note})`}</span> : null}
            </div>
            <div className="mt-1 text-[11px] leading-snug text-foreground/90">{definition}</div>
          </div>
        </Portal>
      ) : null}
    </span>
  );
}
