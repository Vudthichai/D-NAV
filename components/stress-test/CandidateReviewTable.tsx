"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { DecisionCandidate } from "@/components/stress-test/decision-intake-types";
import { SourceCell } from "@/components/stress-test/SourceCell";

interface CandidateReviewTableProps {
  candidates: DecisionCandidate[];
  categories: string[];
  onCandidatesChange: (candidates: DecisionCandidate[]) => void;
}

interface BulkScoreState {
  value: string;
}

const scoreKeys = ["impact", "cost", "risk", "urgency", "confidence"] as const;

type ScoreKey = (typeof scoreKeys)[number];

const clampScore = (value: number) => Math.min(10, Math.max(1, value));

function ScoreStepper({
  value,
  onChange,
}: {
  value?: number;
  onChange: (next: number | undefined) => void;
}) {
  const numeric = typeof value === "number" ? value : 5;

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange(clampScore(numeric - 1))}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <Input
        type="number"
        min={1}
        max={10}
        value={numeric}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) ? clampScore(next) : undefined);
        }}
        className="h-7 w-12 px-1 text-center text-xs"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange(clampScore(numeric + 1))}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function CandidateReviewTable({ candidates, categories, onCandidatesChange }: CandidateReviewTableProps) {
  const [bulkCategory, setBulkCategory] = useState<string>("Uncategorized");
  const [bulkScore, setBulkScore] = useState<BulkScoreState>({ value: "" });
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);

  const keptCount = useMemo(() => candidates.filter((candidate) => candidate.keep).length, [candidates]);

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
        <span className="text-[11px] text-muted-foreground">Kept: {keptCount}</span>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/90">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Keep?</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead className="w-[160px]">Category</TableHead>
              <TableHead className="text-center">Impact</TableHead>
              <TableHead className="text-center">Cost</TableHead>
              <TableHead className="text-center">Risk</TableHead>
              <TableHead className="text-center">Urgency</TableHead>
              <TableHead className="text-center">Confidence</TableHead>
              <TableHead className="w-[140px]">Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate) => (
              <TableRow key={candidate.id} className={candidate.keep ? "" : "opacity-60"}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={candidate.keep}
                      onCheckedChange={(checked) =>
                        onCandidatesChange(
                          candidates.map((item) =>
                            item.id === candidate.id ? { ...item, keep: Boolean(checked) } : item,
                          ),
                        )
                      }
                    />
                    <span className="text-[11px] text-muted-foreground">Keep</span>
                  </div>
                </TableCell>
                <TableCell className="min-w-[260px]">
                  <Input
                    value={candidate.decisionText}
                    onChange={(event) =>
                      onCandidatesChange(
                        candidates.map((item) =>
                          item.id === candidate.id ? { ...item, decisionText: event.target.value } : item,
                        ),
                      )
                    }
                    className="h-8 text-xs"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={candidate.category}
                    onValueChange={(value) =>
                      onCandidatesChange(
                        candidates.map((item) =>
                          item.id === candidate.id ? { ...item, category: value } : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category} className="text-xs">
                          {category}
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
                        onCandidatesChange(
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
                  <SourceCell
                    source={candidate.source}
                    isOpen={openEvidenceId === candidate.id}
                    onOpenChange={(nextOpen) => setOpenEvidenceId(nextOpen ? candidate.id : null)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
