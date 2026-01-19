"use client";

import { Button } from "@/components/ui/button";
import { Portal } from "@/components/ui/Portal";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import type { SourceRef } from "@/components/stress-test/decision-intake-types";

interface SourceCollapseProps {
  source: SourceRef;
  className?: string;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
}

const excerptClampStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
};

export function SourceCollapse({ source, className, isOpen, onOpenChange }: SourceCollapseProps) {
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShowFullExcerpt(false);
    } else {
      const rect = buttonRef.current?.getBoundingClientRect();
      const popoverWidth = 300;
      const margin = 12;
      const nextLeft = rect ? rect.left : margin;
      const maxLeft = window.innerWidth - popoverWidth - margin;
      const clampedLeft = Math.min(Math.max(nextLeft, margin), Math.max(maxLeft, margin));
      const nextTop = rect ? rect.bottom + 8 : margin;
      setPopoverPosition({ top: nextTop, left: clampedLeft });
    }

    onOpenChange(nextOpen);
  };

  const pageLabel = source.pageNumber ?? "?";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px] font-semibold"
        onClick={() => handleOpenChange(!isOpen)}
      >
        <span>Evidence</span>
        <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition", isOpen ? "rotate-180" : "")} />
      </Button>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span className="max-w-[120px] truncate">{source.fileName}</span>
        <span aria-hidden="true">·</span>
        <span>p.{pageLabel}</span>
      </div>
      {isOpen && popoverPosition ? (
        <Portal>
          <div className="fixed inset-0 z-40" onClick={() => handleOpenChange(false)} />
          <div
            className="fixed z-50 w-[300px] rounded-lg border border-border/60 bg-background p-3 text-[11px] text-foreground shadow-lg"
            style={{ top: popoverPosition.top, left: popoverPosition.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold">{source.fileName}</span>
              <span className="text-muted-foreground">Page {pageLabel}</span>
            </div>
            <div className="mt-2 rounded-md bg-muted/20 p-2 font-mono text-[11px] text-muted-foreground">
              <div
                style={showFullExcerpt ? undefined : excerptClampStyle}
                className={cn("whitespace-pre-wrap", showFullExcerpt ? "max-h-40 overflow-auto pr-1" : "")}
              >
                {source.excerpt}
              </div>
              <button
                type="button"
                className="mt-2 text-[11px] font-semibold text-primary"
                onClick={() => setShowFullExcerpt((prev) => !prev)}
              >
                {showFullExcerpt ? "Show less" : "Show more"}
              </button>
            </div>
          </div>
        </Portal>
      ) : null}
    </div>
  );
}
