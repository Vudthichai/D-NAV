"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpCircle, Minus, Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DecisionDomain, ExtractedDecisionCandidate } from "@/components/stress-test/decision-intake-types";
import { SourceCollapse } from "@/components/stress-test/SourceCollapse";

interface CandidateReviewTableProps {
  candidates: ExtractedDecisionCandidate[];
  domains: DecisionDomain[];
  onCandidatesChange: (candidates: ExtractedDecisionCandidate[]) => void;
}

interface BulkScoreState {
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
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

export function CandidateReviewTable({ candidates, domains, onCandidatesChange }: CandidateReviewTableProps) {
  const [bulkDomain, setBulkDomain] = useState<DecisionDomain>("Uncategorized");
  const [bulkScore, setBulkScore] = useState<BulkScoreState>({
    impact: 5,
    cost: 5,
    risk: 5,
    urgency: 5,
    confidence: 5,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openSourceId, setOpenSourceId] = useState<string | null>(null);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [draftText, setDraftText] = useState<Record<string, string>>({});

  const keptCount = useMemo(() => candidates.filter((candidate) => candidate.keep).length, [candidates]);
  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);
  const allSelected = useMemo(
    () => candidates.length > 0 && selectedIds.length === candidates.length,
    [candidates.length, selectedIds.length],
  );

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => candidates.some((candidate) => candidate.id === id)));
  }, [candidates]);

  const applyToSelected = (updater: (candidate: ExtractedDecisionCandidate) => ExtractedDecisionCandidate) => {
    if (selectedIds.length === 0) return;
    const selected = new Set(selectedIds);
    onCandidatesChange(candidates.map((candidate) => (selected.has(candidate.id) ? updater(candidate) : candidate)));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Review Queue — {candidates.length} candidates</h3>
        <p className="text-xs text-muted-foreground">
          Keep only commitments that reduce future optionality (money, time, talent, or public promise).
        </p>
        <div className="space-y-0.5 text-[11px] text-muted-foreground">
          <p>All variables start neutral (5). Adjust only when evidence justifies deviation.</p>
          <p>Score as if outcomes are unknown — this breaks if hindsight enters.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/90 px-3 py-2 text-xs">
        <span className="text-[11px] font-semibold text-muted-foreground">Bulk actions</span>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected ? true : selectedCount > 0 ? "indeterminate" : false}
            onCheckedChange={(checked) => {
              setSelectedIds(checked === true ? candidates.map((candidate) => candidate.id) : []);
            }}
            aria-label="Select all candidates"
          />
          <span className="text-[11px] text-muted-foreground">Select all</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => applyToSelected((candidate) => ({ ...candidate, keep: true }))}
          disabled={selectedIds.length === 0}
        >
          Keep selected
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => applyToSelected((candidate) => ({ ...candidate, keep: false }))}
          disabled={selectedIds.length === 0}
        >
          Reject selected
        </Button>
        <div className="flex items-center gap-2">
          <Select value={bulkDomain} onValueChange={(value) => setBulkDomain(value as DecisionDomain)}>
            <SelectTrigger className="h-7 w-[150px] text-[11px]">
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
            disabled={selectedIds.length === 0}
          >
            Set domain for selected
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setIsScoreModalOpen(true)}
            disabled={selectedIds.length === 0}
          >
            Set scores for selected
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => setSelectedIds([])}
          disabled={selectedIds.length === 0}
        >
          Clear selection
        </Button>
        <span className="text-[11px] text-muted-foreground">Selected: {selectedCount}</span>
        <span className="text-[11px] text-muted-foreground">Kept: {keptCount}</span>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/90">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Keep?</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead className="w-[170px]">
                <div className="flex items-center gap-1">
                  <span>Decision Domain</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">
                      Stable lens — not AI generated.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead className="text-center">Impact</TableHead>
              <TableHead className="text-center">Cost</TableHead>
              <TableHead className="text-center">Risk</TableHead>
              <TableHead className="text-center">Urgency</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span>Confidence</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px] text-xs">
                      Confidence = clarity at decision time, not probability of success.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead className="w-[140px]">Source ▸</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate) => (
              <TableRow key={candidate.id} className={candidate.keep ? "" : "opacity-60"}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Checkbox
                        checked={candidate.keep}
                        onCheckedChange={(checked) =>
                          onCandidatesChange(
                            candidates.map((item) =>
                              item.id === candidate.id ? { ...item, keep: checked === true } : item,
                            ),
                          )
                        }
                      />
                      Keep
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Checkbox
                        checked={selectedIds.includes(candidate.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) =>
                            checked === true ? [...prev, candidate.id] : prev.filter((id) => id !== candidate.id),
                          );
                        }}
                      />
                      Select
                    </label>
                  </div>
                </TableCell>
                <TableCell className="min-w-[260px]">
                  <div className="relative">
                    <Input
                      value={draftText[candidate.id] ?? candidate.decisionText}
                      onChange={(event) =>
                        setDraftText((prev) => ({ ...prev, [candidate.id]: event.target.value }))
                      }
                      onBlur={(event) => {
                        const value = event.target.value;
                        onCandidatesChange(
                          candidates.map((item) =>
                            item.id === candidate.id ? { ...item, decisionText: value } : item,
                          ),
                        );
                      }}
                      className="h-7 pr-7 text-xs"
                    />
                    <Pencil className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={candidate.domain}
                    onValueChange={(value) =>
                      onCandidatesChange(
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
                  <SourceCollapse
                    source={{
                      docId: candidate.docId,
                      docName: candidate.docName,
                      pageNumber: candidate.page ?? null,
                      excerpt: candidate.excerpt,
                    }}
                    isOpen={openSourceId === candidate.id}
                    isExpanded={expandedSourceId === candidate.id}
                    onToggle={() => {
                      setExpandedSourceId(null);
                      setOpenSourceId((prev) => (prev === candidate.id ? null : candidate.id));
                    }}
                    onToggleExpanded={() =>
                      setExpandedSourceId((prev) => (prev === candidate.id ? null : candidate.id))
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isScoreModalOpen} onOpenChange={setIsScoreModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set scores for selected</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 text-xs">
            {scoreKeys.map((key) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="capitalize text-muted-foreground">{key}</span>
                <ScoreStepper
                  value={bulkScore[key]}
                  onChange={(next) =>
                    setBulkScore((prev) => ({
                      ...prev,
                      [key]: next ?? 5,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                applyToSelected((candidate) => ({
                  ...candidate,
                  scores: {
                    impact: clampScore(bulkScore.impact),
                    cost: clampScore(bulkScore.cost),
                    risk: clampScore(bulkScore.risk),
                    urgency: clampScore(bulkScore.urgency),
                    confidence: clampScore(bulkScore.confidence),
                  },
                }));
                setIsScoreModalOpen(false);
              }}
            >
              Apply scores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
