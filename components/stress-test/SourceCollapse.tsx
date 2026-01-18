"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { SourceRef } from "@/components/stress-test/decision-intake-types";

interface SourceCollapseProps {
  source: SourceRef;
  className?: string;
}

export function SourceCollapse({ source, className }: SourceCollapseProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px] font-semibold"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>Source</span>
        <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition", isOpen ? "rotate-180" : "")} />
      </Button>
      {isOpen ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-[11px] text-foreground">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">{source.fileName}</span>
            <span className="text-muted-foreground">Page {source.pageNumber}</span>
          </div>
          <div className="mt-2 rounded-md bg-background/80 p-2 font-mono text-[11px] text-muted-foreground">
            {source.excerpt}
          </div>
        </div>
      ) : null}
    </div>
  );
}
