"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { EvidenceRef } from "@/components/stress-test/decision-intake-types";

interface EvidencePopoverProps {
  source: EvidenceRef;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
}

export function EvidencePopover({ source, isOpen, onOpenChange }: EvidencePopoverProps) {
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const pageLabel = source.pageNumber ?? "?";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setShowFullExcerpt(false);
    onOpenChange(nextOpen);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]">
          <span>Evidence</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-[min(520px,80vw)] p-3 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-[320px] truncate text-xs font-semibold">{source.fileName}</span>
          {source.pageNumber ? (
            <Badge variant="secondary" className="text-[10px]">
              p.{pageLabel}
            </Badge>
          ) : null}
        </div>
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Excerpt</div>
        <div className="mt-2 rounded-md bg-muted/20 p-2 font-mono text-[11px] text-muted-foreground">
          <div
            className={cn(
              "whitespace-pre-wrap",
              showFullExcerpt ? "max-h-40 overflow-auto pr-1" : "line-clamp-2",
            )}
          >
            {source.excerpt}
          </div>
          <button
            type="button"
            className="mt-2 text-[11px] font-semibold text-primary"
            onClick={() => setShowFullExcerpt((prev) => !prev)}
          >
            {showFullExcerpt ? "View less" : "View more"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
