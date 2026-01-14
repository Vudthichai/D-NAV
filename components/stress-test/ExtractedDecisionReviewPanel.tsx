"use client";

import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ExtractedDecisionCandidate = {
  id: string;
  text: string;
  source?: string;
  confidence?: "high" | "med" | "low";
  confirmed: boolean;
  discarded: boolean;
  category?: string;
};

interface ExtractedDecisionReviewPanelProps {
  candidates: ExtractedDecisionCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<ExtractedDecisionCandidate[]>>;
  categories: string[];
  hasExtracted: boolean;
  onAddConfirmed: (candidates: ExtractedDecisionCandidate[]) => void;
}

const CONFIDENCE_LABELS: Record<NonNullable<ExtractedDecisionCandidate["confidence"]>, string> = {
  high: "High",
  med: "Med",
  low: "Low",
};

const confidenceBadgeClasses: Record<NonNullable<ExtractedDecisionCandidate["confidence"]>, string> = {
  high: "border-emerald-500/40 text-emerald-500",
  med: "border-amber-500/40 text-amber-500",
  low: "border-rose-500/40 text-rose-500",
};

export default function ExtractedDecisionReviewPanel({
  candidates,
  setCandidates,
  categories,
  hasExtracted,
  onAddConfirmed,
}: ExtractedDecisionReviewPanelProps) {
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState<string | undefined>(undefined);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => candidates.some((candidate) => candidate.id === id)));
  }, [candidates]);

  const visibleCandidates = useMemo(
    () => (showDiscarded ? candidates : candidates.filter((candidate) => !candidate.discarded)),
    [candidates, showDiscarded],
  );

  const confirmedCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.confirmed && !candidate.discarded),
    [candidates],
  );

  const hasDiscarded = useMemo(() => candidates.some((candidate) => candidate.discarded), [candidates]);

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(visibleCandidates.map((candidate) => candidate.id));
  };

  const handleBulkCategoryApply = () => {
    if (!bulkCategory || selectedIds.length === 0) return;
    setCandidates((prev) =>
      prev.map((candidate) =>
        selectedIds.includes(candidate.id) ? { ...candidate, category: bulkCategory } : candidate,
      ),
    );
  };

  if (!hasExtracted) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border/40 bg-muted/5 px-3 py-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          Review extracted decisions (confirm / discard / categorize)
        </h3>
        <p className="text-xs text-muted-foreground">
          Confirm what belongs, discard noise, and tune the category before scoring.
        </p>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">No decisions found.</p>
          <p className="mt-1">
            Try shorter bullets and verbs like “decide”, “commit”, or “approve” for clearer signals.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
                onClick={() =>
                  setCandidates((prev) =>
                    prev.map((candidate) => ({
                      ...candidate,
                      confirmed: true,
                      discarded: false,
                    })),
                  )
                }
              >
                Confirm all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
                onClick={() =>
                  setCandidates((prev) =>
                    prev.map((candidate) => ({
                      ...candidate,
                      confirmed: false,
                      discarded: true,
                    })),
                  )
                }
              >
                Discard all
              </Button>
              <div className="flex items-center gap-2">
                <Select value={bulkCategory} onValueChange={setBulkCategory}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="Set category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
                  onClick={handleBulkCategoryApply}
                  disabled={!bulkCategory || selectedIds.length === 0}
                >
                  Set category for selected
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {hasDiscarded ? (
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox checked={showDiscarded} onCheckedChange={(value) => setShowDiscarded(value === true)} />
                  <span>Show discarded</span>
                </label>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[auto_auto_minmax(200px,1fr)_minmax(140px,0.6fr)_auto_auto] items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Checkbox
                checked={selectedIds.length > 0 && selectedIds.length === visibleCandidates.length}
                onCheckedChange={(value) => handleSelectAll(value === true)}
                aria-label="Select all"
              />
              <span className="text-center">Confirm</span>
              <span>Decision</span>
              <span>Category</span>
              <span>Confidence</span>
              <span className="text-right">Actions</span>
            </div>

            {visibleCandidates.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/50 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                All decisions are discarded. Toggle “Show discarded” to review or restore.
              </div>
            ) : null}

            {visibleCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className="grid grid-cols-[auto_auto_minmax(200px,1fr)_minmax(140px,0.6fr)_auto_auto] items-start gap-2 rounded-md border border-border/40 bg-muted/10 px-2 py-2 text-xs text-muted-foreground"
              >
                <Checkbox
                  checked={selectedIds.includes(candidate.id)}
                  onCheckedChange={(value) => {
                    setSelectedIds((prev) =>
                      value === true
                        ? [...new Set([...prev, candidate.id])]
                        : prev.filter((id) => id !== candidate.id),
                    );
                  }}
                  aria-label="Select decision"
                />
                <Checkbox
                  checked={candidate.confirmed && !candidate.discarded}
                  onCheckedChange={(value) => {
                    const isConfirmed = value === true;
                    setCandidates((prev) =>
                      prev.map((item) =>
                        item.id === candidate.id
                          ? { ...item, confirmed: isConfirmed, discarded: !isConfirmed ? item.discarded : false }
                          : item,
                      ),
                    );
                  }}
                  aria-label="Confirm decision"
                />
                <Textarea
                  value={candidate.text}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setCandidates((prev) =>
                      prev.map((item) => (item.id === candidate.id ? { ...item, text: nextValue } : item)),
                    );
                  }}
                  className="min-h-[44px] resize-none text-xs leading-relaxed focus:min-h-[72px]"
                />
                <Select
                  value={candidate.category ?? "Uncategorized"}
                  onValueChange={(value) => {
                    setCandidates((prev) =>
                      prev.map((item) => (item.id === candidate.id ? { ...item, category: value } : item)),
                    );
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center">
                  {candidate.confidence ? (
                    <Badge
                      variant="outline"
                      className={`px-2 py-0 text-[10px] font-semibold ${confidenceBadgeClasses[candidate.confidence]}`}
                    >
                      {CONFIDENCE_LABELS[candidate.confidence]}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-[11px] font-semibold"
                    onClick={() =>
                      setCandidates((prev) =>
                        prev.map((item) =>
                          item.id === candidate.id
                            ? {
                                ...item,
                                discarded: !item.discarded,
                                confirmed: item.discarded ? true : false,
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    {candidate.discarded ? "Restore" : "Discard"}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-[11px] text-muted-foreground">
              {confirmedCandidates.length} confirmed · {candidates.length} total
            </div>
            <Button
              type="button"
              className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
              onClick={() => onAddConfirmed(confirmedCandidates)}
              disabled={confirmedCandidates.length === 0}
            >
              Add confirmed decisions to Log ({confirmedCandidates.length})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
