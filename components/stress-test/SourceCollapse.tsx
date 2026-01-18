"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SourceRef } from "@/components/stress-test/decision-intake-types";

interface SourceCollapseProps {
  source: SourceRef;
  className?: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function SourceCollapse({ source, className, isOpen, onToggle }: SourceCollapseProps) {
  const [showMore, setShowMore] = useState(false);
  const shouldTruncate = useMemo(() => source.excerpt.length > 220, [source.excerpt]);

  useEffect(() => {
    if (!isOpen) {
      setShowMore(false);
    }
  }, [isOpen]);

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px] font-semibold"
        onClick={onToggle}
      >
        <span>Source</span>
        <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition", isOpen ? "rotate-180" : "")} />
      </Button>
      {isOpen ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-[11px] text-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{source.fileName}</span>
              <span className="text-muted-foreground">• Page {source.pageNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Copy excerpt"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(source.excerpt);
                  } catch (error) {
                    console.error("Failed to copy excerpt.", error);
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="sr-only">Copy excerpt</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Copy source ref"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${source.fileName} • Page ${source.pageNumber}`);
                  } catch (error) {
                    console.error("Failed to copy source ref.", error);
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="sr-only">Copy source ref</span>
              </Button>
            </div>
          </div>
          <div className="mt-2 rounded-md bg-background/80 p-2 text-[11px] text-muted-foreground">
            <div
              className={cn(
                "whitespace-pre-wrap font-mono",
                showMore ? "max-h-32 overflow-y-auto" : "max-h-16 overflow-hidden",
              )}
            >
              {source.excerpt}
            </div>
            {shouldTruncate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-6 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                onClick={() => setShowMore((prev) => !prev)}
              >
                {showMore ? "Show less" : "Show more"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
