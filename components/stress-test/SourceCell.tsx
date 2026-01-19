"use client";

import { useState } from "react";
import type { EvidenceRef } from "@/components/stress-test/decision-intake-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SourceCellProps {
  source: EvidenceRef;
  className?: string;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
}

export function SourceCell({ source, className, isOpen, onOpenChange }: SourceCellProps) {
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const pageLabel = source.pageNumber ?? "?";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShowFullExcerpt(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] font-semibold"
          >
            <span>Evidence</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          className="w-[min(520px,80vw)] p-3 text-[11px]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="max-w-[320px] truncate text-xs font-semibold">{source.fileName}</span>
            {source.pageNumber ? (
              <Badge variant="secondary" className="text-[10px]">
                Page {pageLabel}
              </Badge>
            ) : null}
          </div>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Excerpt
          </div>
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
              {showFullExcerpt ? "Show less" : "View more"}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span className="max-w-[120px] truncate">{source.fileName}</span>
        <span aria-hidden="true">·</span>
        <span>p.{pageLabel}</span>
      </div>
    </div>
  );
}
