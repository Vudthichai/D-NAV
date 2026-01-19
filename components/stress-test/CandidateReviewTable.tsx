"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { DecisionDomain, ExtractedDecisionCandidate, SourceRef } from "@/components/stress-test/decision-intake-types";
import { SourceCollapse } from "@/components/stress-test/SourceCollapse";

interface CandidateReviewTableProps {
  candidates: ExtractedDecisionCandidate[];
  domains: DecisionDomain[];
  onCandidatesChange: (candidates: ExtractedDecisionCandidate[]) => void;
}

const scoreKeys = ["impact", "cost", "risk", "urgency", "confidence"] as const;

type ScoreKey = (typeof scoreKeys)[number];

type BulkScores = Record<ScoreKey, number>;

type DraftTextMap = Record<string, string>;

const scoreLabels: Record<ScoreKey, string> = {
  impact: "Impact",
  cost: "Cost",
  risk: "Risk",
  urgency: "Urgency",
  confidence: "Confidence",
};

const clampScore = (value: number) => Math.min(10, Math.max(1, value));

function ScoreStepper({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-6 w-6"
        onClick={() => onChange(clampScore(value - 1))}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <Input
        type="number"
        min={1}
        max={10}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          onChange(clampScore(next));
        }}
        className="h-6 w-10 px-1 text-center text-xs"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-6 w-6"
        onClick={() => onChange(clampScore(value + 1))}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

const buildSourceRef = (candidate: ExtractedDecisionCandidate): SourceRef => ({
  docId: candidate.docId,
  docName: candidate.docName,
  page: candidate.page,
  excerpt: candidate.excerpt,
  chunkId: candidate.id,
});

export function CandidateReviewTable({ candidates, domains, onCandidatesChange }: CandidateReviewTableProps) {
  const [bulkDomain, setBulkDomain] = useState<DecisionDomain>(DecisionDomain.Uncategorized);
  const [bulkScores, setBulkScores] = useState<BulkScores>({
    impact: 5,
    cost: 5,
    risk: 5,
    urgency: 5,
    confidence: 5,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draftTexts, setDraftTexts] = useState<DraftTextMap>({});
  const [openSourceId, setOpenSourceId] = useState<string | null>(null);
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);

  const keptCount = useMemo(() => candidates.filter((candidate) => candidate.keep).length, [candidates]);
  const selectedCount = selectedIds.size;

  const applyCandidatesUpdate = (nextCandidates: ExtractedDecisionCandidate[]) => {
    const nextIds = new Set(nextCandidates.map((candidate) => candidate.id));
    setSelectedIds((prev) => new Set([...prev].filter((id) => nextIds.has(id))));
    onCandidatesChange(nextCandidates);
  };

  const applyToSelected = (updater: (candidate: ExtractedDecisionCandidate) => ExtractedDecisionCandidate) => {
    if (selectedIds.size === 0) return;
    applyCandidatesUpdate(candidates.map((candidate) => (selectedIds.has(candidate.id) ? updater(candidate) : candidate)));
  };

  const handleTextBlur = (candidateId: string) => {
    const nextText = draftTexts[candidateId];
    if (typeof nextText !== "string") return;
    applyCandidatesUpdate(
      candidates.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, decisionText: nextText } : candidate,
      ),
    );
    setDraftTexts((prev) => {
      const { [candidateId]: _, ...rest } = prev;
      return rest;
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Review Queue — {candidates.length} candidates</h3>
          <span className="text-xs text-muted-foreground">Kept: {keptCount}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Keep only commitments that reduce future optionality (money, time, talent, or public promise).
        </p>
        <div className="text-[11px] text-muted-foreground">
          <p>All variables start neutral (5). Adjust only when evidence justifies deviation.</p>
          <p>Score as if outcomes are unknown — this system breaks if hindsight enters.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/90 px-3 py-2 text-xs">
        <span className="text-[11px] font-semibold text-muted-foreground">Bulk actions</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => applyToSelected((candidate) => ({ ...candidate, keep: true }))}
          disabled={selectedCount === 0}
        >
          Keep selected
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => applyToSelected((candidate) => ({ ...candidate, keep: false }))}
          disabled={selectedCount === 0}
        >
          Reject selected
        </Button>
        <div className="flex items-center gap-2">
          <Select value={bulkDomain} onValueChange={(value) => setBulkDomain(value as DecisionDomain)}>
            <SelectTrigger className="h-7 w-[160px] text-[11px]">
              <SelectValue placeholder="Set domain" />
            </SelectTrigger>
            <SelectContent>
              {domains.map((domain) => (
                <SelectItem key={domain} value={domain} className="text-xs">
                  {domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => applyToSelected((candidate) => ({ ...candidate, domain: bulkDomain }))}
            disabled={selectedCount === 0}
          >
            Set domain for selected
          </Button>
        </div>
        <Dialog open={isScoreDialogOpen} onOpenChange={setIsScoreDialogOpen}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setIsScoreDialogOpen(true)}
            disabled={selectedCount === 0}
          >
            Set scores for selected
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set scores for selected</DialogTitle>
              <DialogDescription className="text-xs">
                Apply calibrated scores across the selected decisions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {scoreKeys.map((key) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{scoreLabels[key]}</span>
                  <ScoreStepper
                    value={bulkScores[key]}
                    onChange={(next) => setBulkScores((prev) => ({ ...prev, [key]: next }))}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScoreDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  applyToSelected((candidate) => ({
                    ...candidate,
                    scores: {
                      ...candidate.scores,
                      ...bulkScores,
                    },
                  }));
                  setIsScoreDialogOpen(false);
                }}
              >
                Apply scores
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => setSelectedIds(new Set())}
          disabled={selectedCount === 0}
        >
          Clear selection
        </Button>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/90">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Select / Keep</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead className="w-[180px]">Decision Domain</TableHead>
              <TableHead className="text-center">Impact</TableHead>
              <TableHead className="text-center">Cost</TableHead>
              <TableHead className="text-center">Risk</TableHead>
              <TableHead className="text-center">Urgency</TableHead>
              <TableHead className="text-center">Confidence</TableHead>
              <TableHead className="w-[140px]">Source ▸</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate) => (
              <TableRow key={candidate.id} className={`text-xs ${candidate.keep ? "" : "opacity-60"}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(candidate.id)}
                      onCheckedChange={(checked) =>
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (checked === true) {
                            next.add(candidate.id);
                          } else {
                            next.delete(candidate.id);
                          }
                          return next;
                        })
                      }
                      aria-label="Select decision"
                    />
                    <Checkbox
                      checked={candidate.keep}
                      onCheckedChange={(checked) =>
                        applyCandidatesUpdate(
                          candidates.map((item) =>
                            item.id === candidate.id ? { ...item, keep: checked === true } : item,
                          ),
                        )
                      }
                      aria-label="Keep decision"
                    />
                    <span className="text-[11px] text-muted-foreground">Keep</span>
                  </div>
                </TableCell>
                <TableCell className="min-w-[240px]">
                  <Input
                    value={draftTexts[candidate.id] ?? candidate.decisionText}
                    onChange={(event) =>
                      setDraftTexts((prev) => ({
                        ...prev,
                        [candidate.id]: event.target.value,
                      }))
                    }
                    onBlur={() => handleTextBlur(candidate.id)}
                    className="h-7 text-xs"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={candidate.domain}
                    onValueChange={(value) =>
                      applyCandidatesUpdate(
                        candidates.map((item) =>
                          item.id === candidate.id ? { ...item, domain: value as DecisionDomain } : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map((domain) => (
                        <SelectItem key={domain} value={domain} className="text-xs">
                          {domain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                {scoreKeys.map((key) => (
                  <TableCell key={`${candidate.id}-${key}`} className="text-center">
                    <ScoreStepper
                      value={candidate.scores[key]}
                      onChange={(next) =>
                        applyCandidatesUpdate(
                          candidates.map((item) =>
                            item.id === candidate.id
                              ? {
                                  ...item,
                                  scores: {
                                    ...item.scores,
                                    [key]: next,
                                  },
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <SourceCollapse
                    source={buildSourceRef(candidate)}
                    isOpen={openSourceId === candidate.id}
                    onToggle={() =>
                      setOpenSourceId((prev) => (prev === candidate.id ? null : candidate.id))
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {keptCount < 10 ? (
        <p className="text-xs text-muted-foreground">
          Add more documents to reach 10–20 commitments for a clearer signal.
        </p>
      ) : null}
    </div>
  );
}
