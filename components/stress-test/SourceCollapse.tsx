"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { SourceRef } from "@/components/stress-test/decision-intake-types";

interface SourceCollapseProps {
  source: SourceRef;
  isOpen: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleExpanded: () => void;
  className?: string;
}

export function SourceCollapse({
  source,
  isOpen,
  isExpanded,
  onToggle,
  onToggleExpanded,
  className,
}: SourceCollapseProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px] font-semibold"
        onClick={onToggle}
      >
        <span>Source ▸</span>
        <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition", isOpen ? "rotate-180" : "")} />
      </Button>
      {isOpen ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-[11px] text-foreground">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">{source.docName}</span>
            {source.pageNumber ? <span className="text-muted-foreground">Page {source.pageNumber}</span> : null}
          </div>
          <div
            className={cn(
              "mt-2 rounded-md bg-background/80 p-2 font-mono text-[11px] text-muted-foreground",
              isExpanded ? "max-h-40 overflow-y-auto" : "line-clamp-2",
            )}
          >
            {source.excerpt}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-6 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            onClick={onToggleExpanded}
          >
            {isExpanded ? "View less" : "View more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
