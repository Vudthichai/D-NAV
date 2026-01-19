"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface SourceCellProps {
  rowId: string;
  source: { docName: string; page?: number | null; excerpt: string };
  openRowId: string | null;
  setOpenRowId: (id: string | null) => void;
}

const EXCERPT_TOGGLE_THRESHOLD = 160;

export function SourceCell({ rowId, source, openRowId, setOpenRowId }: SourceCellProps) {
  const isOpen = openRowId === rowId;
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const excerpt = source.excerpt?.trim() ?? "";
  const hasExcerpt = excerpt.length > 0;
  const showToggle = hasExcerpt && excerpt.length > EXCERPT_TOGGLE_THRESHOLD;

  useEffect(() => {
    if (!isOpen) {
      setShowFullExcerpt(false);
    }
  }, [isOpen]);

  const pageLabel = source.page ? `Page ${source.page}` : "Page —";
  const excerptText = hasExcerpt ? excerpt : "No excerpt captured.";

  const excerptClasses = useMemo(
    () =>
      cn(
        "mt-1 text-[11px] text-muted-foreground",
        showFullExcerpt ? "max-h-[160px] overflow-auto whitespace-pre-wrap pr-1" : "line-clamp-2",
      ),
    [showFullExcerpt],
  );

  const handleCopy = () => {
    if (!hasExcerpt) return;
    void navigator.clipboard?.writeText(excerpt);
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px] font-semibold"
        onClick={() => setOpenRowId(isOpen ? null : rowId)}
        aria-expanded={isOpen}
      >
        <span>Source {isOpen ? "▾" : "▸"}</span>
      </Button>
      {isOpen ? (
        <div className="max-h-[200px] space-y-1 rounded-md border border-border/60 bg-muted/10 p-2 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-foreground" title={source.docName}>
              {source.docName}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
              title={hasExcerpt ? "Copy excerpt" : "No excerpt to copy"}
              aria-label="Copy excerpt"
              disabled={!hasExcerpt}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground">{pageLabel}</div>
          <div className={excerptClasses}>{excerptText}</div>
          {showToggle ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1 text-[11px] font-medium text-muted-foreground"
              onClick={() => setShowFullExcerpt((prev) => !prev)}
            >
              {showFullExcerpt ? "View less" : "View more"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
