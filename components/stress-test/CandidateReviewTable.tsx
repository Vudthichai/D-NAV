"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [openEditId, setOpenEditId] = useState<string | null>(null);

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
              <TableHead className="w-[180px]">Decision Domain</TableHead>
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
                  <Dialog open={openEditId === candidate.id} onOpenChange={(open) => setOpenEditId(open ? candidate.id : null)}>
                    <DialogTrigger asChild>
                      <button type="button" className="w-full text-left">
                        <div className="space-y-1">
                          <p className="line-clamp-1 text-xs font-semibold text-foreground">
                            {candidate.decisionTitle}
                          </p>
                          <p className="line-clamp-1 text-[11px] text-muted-foreground">
                            {candidate.decisionStatement}
                          </p>
                          {candidate.tableNoise ? (
                            <span className="text-[10px] font-semibold text-amber-600">Likely table noise</span>
                          ) : null}
                        </div>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Edit Decision</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 text-xs">
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold text-muted-foreground">Decision title</label>
                          <Input
                            value={candidate.decisionTitle}
                            onChange={(event) =>
                              onCandidatesChange(
                                candidates.map((item) =>
                                  item.id === candidate.id
                                    ? { ...item, decisionTitle: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold text-muted-foreground">Decision statement</label>
                          <Textarea
                            value={candidate.decisionStatement}
                            onChange={(event) =>
                              onCandidatesChange(
                                candidates.map((item) =>
                                  item.id === candidate.id
                                    ? { ...item, decisionStatement: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            rows={3}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="max-w-[240px] truncate text-xs font-semibold text-foreground">
                              {candidate.evidence.docName}
                            </span>
                            {candidate.evidence.pageNumber ? (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                                Page {candidate.evidence.pageNumber}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 line-clamp-3 whitespace-pre-wrap">
                            {candidate.evidence.excerpt}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
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
                    source={candidate.evidence}
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
