"use client";

import { useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import type { SourceRef } from "@/components/stress-test/decision-intake-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SourceCellProps {
  source: SourceRef;
  duplicates?: SourceRef[];
  className?: string;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
}

export function SourceCell({ source, duplicates = [], className, isOpen, onOpenChange }: SourceCellProps) {
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const pageLabel = source.pageNumber ?? "?";
  const duplicatesCount = duplicates.length;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShowFullExcerpt(false);
      setShowDuplicates(false);
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
            <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition", isOpen ? "rotate-180" : "")} />
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
            Primary excerpt
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
          {duplicatesCount > 0 ? (
            <div className="mt-3">
              <button
                type="button"
                className="flex items-center gap-2 text-[11px] font-semibold text-primary"
                onClick={() => setShowDuplicates((prev) => !prev)}
              >
                <Layers className="h-3.5 w-3.5" />
                Also appears in ({duplicatesCount})
              </button>
              {showDuplicates ? (
                <div className="mt-2 space-y-2">
                  {duplicates.map((duplicate) => (
                    <div key={duplicate.chunkId} className="rounded-md border border-border/60 bg-background/60 p-2">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                        <span className="max-w-[240px] truncate">{duplicate.fileName}</span>
                        <Badge variant="outline" className="text-[9px]">
                          Page {duplicate.pageNumber ?? "?"}
                        </Badge>
                      </div>
                      <div className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">
                        {duplicate.excerpt}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <span className="max-w-[120px] truncate">{source.fileName}</span>
        <span aria-hidden="true">·</span>
        <span>p.{pageLabel}</span>
        {duplicatesCount > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span>Duplicates ({duplicatesCount})</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
