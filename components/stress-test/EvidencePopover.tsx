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
  const [openAnchorId, setOpenAnchorId] = useState<string | null>(null);
  const primaryEvidence = evidenceAnchors[0];
  const pageLabel = buildPageLabel(evidenceAnchors);
  const evidenceCount = evidenceAnchors.length;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setOpenAnchorId(null);
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
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Evidence list</div>
        <div className="mt-2 space-y-2">
          {evidenceAnchors.map((anchor) => {
            const anchorId = `${anchor.docId}-${anchor.page}-${anchor.excerpt.slice(0, 12)}`;
            const isOpenAnchor = openAnchorId === anchorId;
            return (
              <div key={anchorId} className="rounded-md border border-border/60 bg-muted/10">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                  onClick={() => setOpenAnchorId(isOpenAnchor ? null : anchorId)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-foreground">{anchor.fileName}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      p. {anchor.page}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{isOpenAnchor ? "Hide" : "View"}</span>
                </button>
                {isOpenAnchor ? (
                  <div className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                    <p className="line-clamp-2 whitespace-pre-wrap">{anchor.excerpt}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
