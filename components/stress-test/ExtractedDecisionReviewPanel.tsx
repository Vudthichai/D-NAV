"use client";

import { useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  onCandidatesChange: React.Dispatch<React.SetStateAction<ExtractedDecisionCandidate[]>>;
  categories: string[];
  onAddToLog: (candidates: ExtractedDecisionCandidate[]) => number;
}

const confidenceStyles: Record<NonNullable<ExtractedDecisionCandidate["confidence"]>, string> = {
  high: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  med: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  low: "border-rose-500/40 bg-rose-500/10 text-rose-600",
};

export default function ExtractedDecisionReviewPanel({
  candidates,
  onCandidatesChange,
  categories,
  onAddToLog,
}: ExtractedDecisionReviewPanelProps) {
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const categoryListId = useId();

  const categoryOptions = useMemo(() => {
    const base = categories.map((category) => category.trim()).filter(Boolean);
    const fromCandidates = candidates
      .map((candidate) => candidate.category?.trim())
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set([...base, ...fromCandidates]));
  }, [categories, candidates]);

  const visibleCandidates = useMemo(
    () => (showDiscarded ? candidates : candidates.filter((candidate) => !candidate.discarded)),
    [candidates, showDiscarded],
  );

  const visibleActiveCandidates = useMemo(
    () => visibleCandidates.filter((candidate) => !candidate.discarded),
    [visibleCandidates],
  );

  const confirmedCount = useMemo(
    () => candidates.filter((candidate) => candidate.confirmed && !candidate.discarded).length,
    [candidates],
  );

  const discardedCount = useMemo(
    () => candidates.filter((candidate) => candidate.discarded).length,
    [candidates],
  );

  const validSelectedIds = useMemo(
    () => selectedIds.filter((id) => candidates.some((candidate) => candidate.id === id)),
    [selectedIds, candidates],
  );

  const selectedVisibleIds = useMemo(
    () => validSelectedIds.filter((id) => visibleCandidates.some((candidate) => candidate.id === id)),
    [validSelectedIds, visibleCandidates],
  );

  const handleCandidateUpdate = (id: string, update: Partial<ExtractedDecisionCandidate>) => {
    onCandidatesChange((prev) =>
      prev.map((candidate) => (candidate.id === id ? { ...candidate, ...update } : candidate)),
    );
  };

  const handleConfirmAll = () => {
    if (visibleActiveCandidates.length === 0) return;
    const visibleIds = new Set(visibleActiveCandidates.map((candidate) => candidate.id));
    onCandidatesChange((prev) =>
      prev.map((candidate) =>
        visibleIds.has(candidate.id) ? { ...candidate, confirmed: true } : candidate,
      ),
    );
  };

  const handleDiscardAll = () => {
    if (visibleCandidates.length === 0) return;
    const visibleIds = new Set(visibleCandidates.map((candidate) => candidate.id));
    onCandidatesChange((prev) =>
      prev.map((candidate) =>
        visibleIds.has(candidate.id) ? { ...candidate, discarded: true } : candidate,
      ),
    );
    setShowDiscarded(true);
  };

  const handleBulkCategory = () => {
    const trimmedCategory = bulkCategory.trim();
    if (!trimmedCategory || selectedVisibleIds.length === 0) return;
    const ids = new Set(selectedVisibleIds);
    onCandidatesChange((prev) =>
      prev.map((candidate) =>
        ids.has(candidate.id) && candidate.confirmed && !candidate.discarded
          ? { ...candidate, category: trimmedCategory }
          : candidate,
      ),
    );
  };

  const handleAddConfirmed = () => {
    const confirmedCandidates = candidates.filter((candidate) => candidate.confirmed && !candidate.discarded);
    if (confirmedCandidates.length === 0) return;
    const addedCount = onAddToLog(confirmedCandidates);
    if (addedCount > 0) {
      setStatusMessage(`Added ${addedCount} decisions to log.`);
      window.setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Review extracted decisions (confirm / discard / categorize)</h3>
        <p className="text-xs text-muted-foreground">
          Confirm what belongs, discard noise, and set a category before scoring.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button
          variant="secondary"
          size="sm"
          className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
          onClick={handleConfirmAll}
          disabled={visibleActiveCandidates.length === 0}
        >
          Confirm all
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide"
          onClick={handleDiscardAll}
          disabled={visibleCandidates.length === 0}
        >
          Discard all
        </Button>
        <div className="flex items-center gap-2">
          <Input
            value={bulkCategory}
            onChange={(event) => setBulkCategory(event.target.value)}
            placeholder="Category"
            list={`${categoryListId}-bulk`}
            className="h-8 w-32 text-xs"
          />
          <datalist id={`${categoryListId}-bulk`}>
            {categoryOptions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[11px] font-semibold uppercase tracking-wide"
            onClick={handleBulkCategory}
            disabled={selectedVisibleIds.length === 0 || !bulkCategory.trim()}
          >
            Set category for selected
          </Button>
        </div>
        <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <Checkbox
            checked={showDiscarded}
            onCheckedChange={(value) => setShowDiscarded(value === true)}
          />
          Show discarded{discardedCount > 0 ? ` (${discardedCount})` : ""}
        </label>
      </div>

      {statusMessage ? <p className="text-xs font-semibold text-emerald-600">{statusMessage}</p> : null}

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          No decisions found. Try shorter bullets and include verbs like decide / approve / commit / choose / hire /
          pause.
        </div>
      ) : (
        <div className="space-y-2">
          {visibleCandidates.map((candidate) => {
            const selected = validSelectedIds.includes(candidate.id);
            return (
              <div
                key={candidate.id}
                className={`flex flex-col gap-2 rounded-lg border border-border/40 bg-white/70 px-3 py-2 text-xs shadow-sm dark:bg-black/20 ${
                  candidate.discarded ? "opacity-70" : ""
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(value) => {
                        setSelectedIds((prev) =>
                          value === true ? [...prev, candidate.id] : prev.filter((id) => id !== candidate.id),
                        );
                      }}
                      aria-label="Select decision"
                    />
                    <Checkbox
                      checked={candidate.confirmed}
                      onCheckedChange={(value) => {
                        handleCandidateUpdate(candidate.id, { confirmed: value === true });
                      }}
                      aria-label="Confirm decision"
                    />
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <Textarea
                      value={candidate.text}
                      onChange={(event) => handleCandidateUpdate(candidate.id, { text: event.target.value })}
                      rows={1}
                      className="min-h-[32px] resize-none text-xs focus:min-h-[60px]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={candidate.category ?? ""}
                      onChange={(event) => handleCandidateUpdate(candidate.id, { category: event.target.value })}
                      placeholder="Category"
                      list={`${categoryListId}-${candidate.id}`}
                      className="h-8 w-32 text-xs"
                    />
                    <datalist id={`${categoryListId}-${candidate.id}`}>
                      {categoryOptions.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                    {candidate.confidence ? (
                      <Badge className={`border text-[10px] uppercase ${confidenceStyles[candidate.confidence]}`}>
                        {candidate.confidence} confidence
                      </Badge>
                    ) : null}
                    {candidate.discarded ? (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        Discarded
                      </Badge>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[11px] font-semibold uppercase tracking-wide"
                      onClick={() =>
                        handleCandidateUpdate(candidate.id, { discarded: !candidate.discarded })
                      }
                    >
                      {candidate.discarded ? "Undo" : "Discard"}
                    </Button>
                  </div>
                </div>
                {candidate.source ? (
                  <p className="text-[11px] text-muted-foreground">Source: {candidate.source}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {confirmedCount} confirmed • {candidates.length} total
        </span>
        <Button
          className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
          onClick={handleAddConfirmed}
          disabled={confirmedCount === 0}
        >
          Add confirmed decisions to Log ({confirmedCount})
        </Button>
      </div>
    </div>
  );
}
