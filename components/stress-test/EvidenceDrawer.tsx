"use client";

import { useMemo } from "react";
import type { EvidenceAnchor } from "@/components/stress-test/decision-intake-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface EvidenceDrawerProps {
  evidenceAnchors: EvidenceAnchor[];
  decisionTitle: string;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  className?: string;
}

const pickBestEvidence = (anchors: EvidenceAnchor[]) =>
  anchors
    .slice()
    .sort((a, b) => (b.excerpt?.length ?? 0) - (a.excerpt?.length ?? 0))[0];

export function EvidenceDrawer({
  evidenceAnchors,
  decisionTitle,
  isOpen,
  onOpenChange,
  className,
}: EvidenceDrawerProps) {
  const evidenceCount = evidenceAnchors.length;
  const primaryEvidence = useMemo(() => pickBestEvidence(evidenceAnchors), [evidenceAnchors]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-8 px-3 text-[11px] font-semibold uppercase tracking-wide", className)}
            onClick={() => onOpenChange(true)}
          >
            Evidence ({evidenceCount})
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className="max-w-[320px] text-xs leading-snug">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
              <span>{primaryEvidence?.fileName ?? "Evidence"}</span>
              {primaryEvidence?.page ? <span>p. {primaryEvidence.page}</span> : null}
            </div>
            <p className="line-clamp-3 text-[11px] text-foreground">{primaryEvidence?.excerpt}</p>
          </div>
        </TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="left-auto right-0 top-0 h-full w-full max-w-lg translate-x-0 translate-y-0 overflow-y-auto rounded-none sm:rounded-none">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base">Evidence</DialogTitle>
            <p className="text-xs text-muted-foreground">{decisionTitle}</p>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            {evidenceAnchors.map((anchor) => (
              <div
                key={`${anchor.docId}-${anchor.page}-${anchor.excerpt.slice(0, 12)}`}
                className="rounded-md border border-border/60 bg-muted/5 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-foreground">{anchor.fileName}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    p. {anchor.page}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-3 text-[11px] text-muted-foreground">{anchor.excerpt}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
