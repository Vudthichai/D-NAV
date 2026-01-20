"use client";

import { useMemo, useState } from "react";
import type { EvidenceAnchor } from "@/components/stress-test/decision-intake-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EvidencePopoverProps {
  evidenceAnchors: EvidenceAnchor[];
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  className?: string;
}

const HIGHLIGHT_TERMS = [
  "will",
  "plan to",
  "plans to",
  "intend to",
  "launch",
  "begin",
  "start",
  "ramp",
  "build",
  "expand",
  "reduce",
  "invest",
  "deploy",
  "introduce",
  "roll out",
  "discontinue",
  "acquire",
  "open",
  "close",
  "schedule",
  "capex",
  "investment",
  "hiring",
  "production start",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "1H",
  "2H",
  "later this year",
  "by end of",
];

const HIGHLIGHT_PATTERN = HIGHLIGHT_TERMS.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const HIGHLIGHT_SPLIT_REGEX = new RegExp(`(${HIGHLIGHT_PATTERN})`, "gi");
const HIGHLIGHT_TEST_REGEX = new RegExp(`^(${HIGHLIGHT_PATTERN})$`, "i");

const buildPageLabel = (anchors: EvidenceAnchor[]) => {
  const pages = Array.from(new Set(anchors.map((anchor) => anchor.page))).sort((a, b) => a - b);
  if (pages.length === 0) return "";
  if (pages.length <= 2) return pages.map((page) => `p. ${page}`).join(", ");
  return `${pages.slice(0, 2).map((page) => `p. ${page}`).join(", ")}…`;
};

const getAnchorId = (anchor: EvidenceAnchor) => `${anchor.docId}-${anchor.page}-${anchor.excerpt.slice(0, 12)}`;

const buildSnippet = (anchor?: EvidenceAnchor) => {
  if (!anchor) return "";
  const sourceText = anchor.contextText ?? anchor.excerpt;
  const lines = sourceText.split(/\r?\n/).filter(Boolean);
  return lines.slice(0, 4).join("\n");
};

const renderHighlightedText = (text: string) =>
  text
    .split(HIGHLIGHT_SPLIT_REGEX)
    .filter(Boolean)
    .map((part, index) =>
      HIGHLIGHT_TEST_REGEX.test(part) ? (
        <mark key={`${part}-${index}`} className="rounded-sm bg-amber-200/60 px-0.5 text-foreground">
          {part}
        </mark>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      ),
    );

export function EvidencePopover({ evidenceAnchors, isOpen, onOpenChange, className }: EvidencePopoverProps) {
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const evidenceCount = evidenceAnchors.length;
  const pageLabel = buildPageLabel(evidenceAnchors);
  const primaryEvidence = evidenceAnchors[0];
  const primaryAnchorId = primaryEvidence ? getAnchorId(primaryEvidence) : null;

  const resolvedAnchorId = isOpen ? activeAnchorId ?? primaryAnchorId : null;
  const activeAnchor = useMemo(
    () => evidenceAnchors.find((anchor) => getAnchorId(anchor) === resolvedAnchorId) ?? primaryEvidence,
    [evidenceAnchors, primaryEvidence, resolvedAnchorId],
  );

  const snippet = buildSnippet(activeAnchor);

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
        aria-expanded={isOpen}
        onClick={() => onOpenChange(!isOpen)}
      >
        Evidence ({evidenceCount})
      </Button>
      {isOpen ? (
        <div className="w-full rounded-lg border border-border/60 bg-background/95 p-3 text-[11px]">
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
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Evidence anchors
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {evidenceAnchors.map((anchor) => {
              const anchorId = getAnchorId(anchor);
              const isActive = anchorId === resolvedAnchorId || (!resolvedAnchorId && anchorId === primaryAnchorId);
              return (
                <button
                  type="button"
                  key={anchorId}
                  onClick={() => setActiveAnchorId(anchorId)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[10px] font-semibold",
                    isActive
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border/60 bg-muted/20 text-muted-foreground",
                  )}
                >
                  {anchor.fileName} · p. {anchor.page}
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-md border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Snippet</span>
              {activeAnchor?.page ? (
                <Badge variant="secondary" className="text-[10px]">
                  p. {activeAnchor.page}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-foreground">
              {renderHighlightedText(snippet || activeAnchor?.excerpt || "")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
