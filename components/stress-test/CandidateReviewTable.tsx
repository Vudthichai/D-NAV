"use client";

import { DecisionRowCard } from "@/components/decision-intake/DecisionRowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import type { DecisionCandidate } from "@/components/stress-test/decision-intake-types";

interface CandidateReviewTableProps {
  candidates: DecisionCandidate[];
  categories: string[];
  onCandidatesChange: (candidates: DecisionCandidate[]) => void;
  showDecisionDebug?: boolean;
}

interface BulkScoreState {
  value: string;
}

const clampScore = (value: number) => Math.min(10, Math.max(1, value));

export function CandidateReviewTable({
  candidates,
  categories,
  onCandidatesChange,
  showDecisionDebug = false,
}: CandidateReviewTableProps) {
  const [bulkCategory, setBulkCategory] = useState<string>("Uncategorized");
  const [bulkScore, setBulkScore] = useState<BulkScoreState>({ value: "" });
  const [showMaybes, setShowMaybes] = useState(false);

  const keptCount = useMemo(() => candidates.filter((candidate) => candidate.keep).length, [candidates]);
  const visibleCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) => candidate.bin !== "MaybeDecision" || showMaybes,
      ),
    [candidates, showMaybes],
  );

  const applyToKept = (updater: (candidate: DecisionCandidate) => DecisionCandidate) => {
    onCandidatesChange(candidates.map((candidate) => (candidate.keep ? updater(candidate) : candidate)));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Do these match real commitments?</h3>
        <p className="text-xs text-muted-foreground">
          Keep only statements that reduce optionality (money, time, talent, public promise).
        </p>
      </div>

      <div className="sticky top-3 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bulk actions</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onCandidatesChange(candidates.map((candidate) => ({ ...candidate, keep: true })))}
        >
          Keep selected
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onCandidatesChange(candidates.map((candidate) => ({ ...candidate, keep: false })))}
        >
          Reject selected
        </Button>
        <div className="flex items-center gap-2">
          <Select value={bulkCategory} onValueChange={setBulkCategory}>
            <SelectTrigger className="h-7 w-[150px] text-[11px]">
              <SelectValue placeholder="Set category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category} className="text-xs">
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => applyToKept((candidate) => ({ ...candidate, category: bulkCategory }))}
          >
            Set category for selected
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={10}
            value={bulkScore.value}
            onChange={(event) => setBulkScore({ value: event.target.value })}
            placeholder="Score"
            className="h-7 w-16 px-2 text-[11px]"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              const value = Number(bulkScore.value);
              if (!Number.isFinite(value)) return;
              const nextScore = clampScore(value);
              applyToKept((candidate) => ({
                ...candidate,
                scores: {
                  impact: nextScore,
                  cost: nextScore,
                  risk: nextScore,
                  urgency: nextScore,
                  confidence: nextScore,
                },
              }));
            }}
          >
            Set scores for selected
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="show-maybes"
            type="checkbox"
            checked={showMaybes}
            onChange={(event) => setShowMaybes(event.target.checked)}
            className="h-3 w-3 rounded border-border text-primary"
          />
          <label htmlFor="show-maybes" className="text-[11px] font-semibold text-muted-foreground">
            Show Maybes
          </label>
        </div>
        <span className="text-[11px] text-muted-foreground">Kept: {keptCount}</span>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/20 p-3">
        {visibleCandidates.map((candidate) => (
          <DecisionRowCard
            key={candidate.id}
            candidate={candidate}
            categories={categories}
            showDecisionDebug={showDecisionDebug}
            onCandidateChange={(nextCandidate) =>
              onCandidatesChange(
                candidates.map((item) => (item.id === candidate.id ? nextCandidate : item)),
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
