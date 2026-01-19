"use client";

import { useMemo, useState } from "react";
import type { DecisionCandidate } from "@/components/stress-test/decision-intake-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CandidateCard } from "@/components/stress-test/CandidateCard";
import { EditDecisionModal } from "@/components/stress-test/EditDecisionModal";

interface CandidateReviewTableProps {
  candidates: DecisionCandidate[];
  categories: string[];
  onCandidatesChange: (candidates: DecisionCandidate[]) => void;
}

interface BulkScoreState {
  value: string;
}

const clampScore = (value: number) => Math.min(10, Math.max(1, value));

export function CandidateReviewTable({ candidates, categories, onCandidatesChange }: CandidateReviewTableProps) {
  const [bulkCategory, setBulkCategory] = useState<string>("Uncategorized");
  const [bulkScore, setBulkScore] = useState<BulkScoreState>({ value: "" });
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const [openEditId, setOpenEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; detail: string }>({ title: "", detail: "" });
  const [showDuplicates, setShowDuplicates] = useState(false);

  const keptCount = useMemo(() => candidates.filter((candidate) => candidate.keep).length, [candidates]);
  const duplicateCount = useMemo(
    () => candidates.filter((candidate) => candidate.flags.duplicateOf).length,
    [candidates],
  );
  const editingCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === openEditId),
    [candidates, openEditId],
  );

  const visibleCandidates = useMemo(
    () => (showDuplicates ? candidates : candidates.filter((candidate) => !candidate.flags.duplicateOf)),
    [candidates, showDuplicates],
  );

  const updateCandidate = (id: string, updater: (candidate: DecisionCandidate) => DecisionCandidate) => {
    onCandidatesChange(candidates.map((candidate) => (candidate.id === id ? updater(candidate) : candidate)));
  };

  const applyToKept = (updater: (candidate: DecisionCandidate) => DecisionCandidate) => {
    onCandidatesChange(candidates.map((candidate) => (candidate.keep ? updater(candidate) : candidate)));
  };

  const handleEditOpen = (candidate: DecisionCandidate) => {
    setOpenEditId(candidate.id);
    setEditDraft({ title: candidate.title, detail: candidate.detail ?? "" });
  };

  const handleEditSave = () => {
    if (!openEditId) return;
    updateCandidate(openEditId, (candidate) => ({
      ...candidate,
      title: editDraft.title,
      detail: editDraft.detail,
    }));
    setOpenEditId(null);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Do these match real commitments?</h3>
        <p className="text-xs text-muted-foreground">
          Keep only statements that reduce optionality (money, time, talent, public promise).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/90 px-3 py-2 text-xs">
        <span className="text-[11px] font-semibold text-muted-foreground">Bulk actions</span>
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
        {duplicateCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setShowDuplicates((prev) => !prev)}
          >
            {showDuplicates ? "Hide duplicates" : `Show duplicates (${duplicateCount})`}
          </Button>
        ) : null}
        <span className="text-[11px] text-muted-foreground">Kept: {keptCount}</span>
      </div>

      <div className="space-y-3">
        {visibleCandidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            categories={categories}
            isEvidenceOpen={openEvidenceId === candidate.id}
            onEvidenceOpenChange={(nextOpen) => setOpenEvidenceId(nextOpen ? candidate.id : null)}
            onEdit={() => handleEditOpen(candidate)}
            onKeepChange={(keep) => updateCandidate(candidate.id, (item) => ({ ...item, keep }))}
            onCategoryChange={(value) => updateCandidate(candidate.id, (item) => ({ ...item, category: value }))}
            onScoreChange={(key, value) =>
              updateCandidate(candidate.id, (item) => ({
                ...item,
                scores: {
                  ...item.scores,
                  [key]: value,
                },
              }))
            }
          />
        ))}
      </div>

      {openEditId && editingCandidate ? (
        <EditDecisionModal
          open={Boolean(openEditId)}
          title={editDraft.title}
          detail={editDraft.detail}
          evidence={editingCandidate.source}
          onTitleChange={(value) => setEditDraft((prev) => ({ ...prev, title: value }))}
          onDetailChange={(value) => setEditDraft((prev) => ({ ...prev, detail: value }))}
          onSave={handleEditSave}
          onClose={() => setOpenEditId(null)}
        />
      ) : null}
    </div>
  );
}
