"use client";

import { useState } from "react";
import type { EvidenceAnchor } from "@/components/stress-test/decision-intake-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EvidencePopoverProps {
  evidenceAnchors: EvidenceAnchor[];
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  className?: string;
}

const buildPageLabel = (anchors: EvidenceAnchor[]) => {
  const pages = Array.from(new Set(anchors.map((anchor) => anchor.page))).sort((a, b) => a - b);
  if (pages.length === 0) return "";
  if (pages.length <= 2) return pages.map((page) => `p. ${page}`).join(", ");
  return `${pages.slice(0, 2).map((page) => `p. ${page}`).join(", ")}…`;
};

export function EvidencePopover({ evidenceAnchors, isOpen, onOpenChange, className }: EvidencePopoverProps) {
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const primaryEvidence = evidenceAnchors[0];
  const contextText = primaryEvidence?.excerpt ?? "No excerpt available.";
  const pageLabel = buildPageLabel(evidenceAnchors);
  const evidenceCount = evidenceAnchors.length;

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
          Evidence ({evidenceCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-[min(520px,80vw)] p-3 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-[320px] truncate text-xs font-semibold text-foreground">
            {primaryEvidence?.fileName ?? "Uploaded PDF"}
          </span>
          {pageLabel ? (
            <Badge variant="secondary" className="text-[10px]">
              {pageLabel}
            </Badge>
          ) : null}
        </div>
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Context</div>
        <div className="mt-2 rounded-md bg-muted/20 p-2 font-mono text-[11px] text-muted-foreground">
          <div
            className={cn(
              "whitespace-pre-wrap",
              showFullExcerpt ? "max-h-40 overflow-auto pr-1" : "line-clamp-3",
            )}
          >
            {contextText}
          </div>
          <button
            type="button"
            className="mt-2 text-[11px] font-semibold text-primary"
            onClick={() => setShowFullExcerpt((prev) => !prev)}
          >
            {showFullExcerpt ? "Show less" : "View more"}
          </button>
        </div>
        {evidenceAnchors.length > 1 ? (
          <div className="mt-3 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Evidence list</div>
            <div className="space-y-2">
              {evidenceAnchors.map((anchor) => (
                <div key={`${anchor.docId}-${anchor.page}-${anchor.excerpt.slice(0, 12)}`} className="text-[11px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{anchor.fileName}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      p. {anchor.page}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-muted-foreground">{anchor.excerpt}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
