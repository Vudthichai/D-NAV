"use client";

import { useState } from "react";
import type { EvidenceRef } from "@/components/stress-test/decision-intake-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EvidencePopoverProps {
  evidence: EvidenceRef;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  className?: string;
}

export function EvidencePopover({ evidence, isOpen, onOpenChange, className }: EvidencePopoverProps) {
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const pageLabel = evidence.pageNumber ?? "?";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShowFullExcerpt(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 px-3 text-[11px] font-semibold uppercase tracking-wide", className)}
        >
          Evidence
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-[min(520px,80vw)] p-3 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-[320px] truncate text-xs font-semibold text-foreground">{evidence.docName}</span>
          {evidence.pageNumber ? (
            <Badge variant="secondary" className="text-[10px]">
              p. {pageLabel}
            </Badge>
          ) : null}
        </div>
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Excerpt</div>
        <div className="mt-2 rounded-md bg-muted/20 p-2 font-mono text-[11px] text-muted-foreground">
          <div
            className={cn(
              "whitespace-pre-wrap",
              showFullExcerpt ? "max-h-40 overflow-auto pr-1" : "line-clamp-3",
            )}
          >
            {evidence.rawExcerpt}
          </div>
          <button
            type="button"
            className="mt-2 text-[11px] font-semibold text-primary"
            onClick={() => setShowFullExcerpt((prev) => !prev)}
          >
            {showFullExcerpt ? "Show less" : "View more"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
