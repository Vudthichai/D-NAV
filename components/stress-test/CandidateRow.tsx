"use client";

import { useState } from "react";
import type { DecisionCandidate } from "@/components/stress-test/decision-intake-types";
import { EvidencePopover } from "@/components/stress-test/EvidencePopover";
import { EditDecisionModal } from "@/components/stress-test/EditDecisionModal";
import { ScoreStepper } from "@/components/stress-test/ScoreStepper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

interface CandidateRowProps {
  candidate: DecisionCandidate;
  categories: string[];
  onCandidateChange: (candidate: DecisionCandidate) => void;
  isEvidenceOpen: boolean;
  onEvidenceOpenChange: (nextOpen: boolean) => void;
  isEditOpen: boolean;
  onEditOpenChange: (nextOpen: boolean) => void;
}

const scoreLabels: Array<{ key: keyof DecisionCandidate["scores"]; label: string }> = [
  { key: "impact", label: "Impact" },
  { key: "cost", label: "Cost" },
  { key: "risk", label: "Risk" },
  { key: "urgency", label: "Urgency" },
  { key: "confidence", label: "Confidence" },
];

export function CandidateRow({
  candidate,
  categories,
  onCandidateChange,
  isEvidenceOpen,
  onEvidenceOpenChange,
  isEditOpen,
  onEditOpenChange,
}: CandidateRowProps) {
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const evidenceAnchors = candidate.evidenceAnchors ?? [];
  const mergedCount = candidate.sources?.candidateIds.length ?? 1;
  const pageLabels = Array.from(new Set(evidenceAnchors.map((anchor) => anchor.page)))
    .sort((a, b) => a - b)
    .slice(0, 2)
    .map((page) => `p. ${page}`)
    .join(", ");
  const evidenceLabel = evidenceAnchors.length > 2 ? `${pageLabels}…` : pageLabels;
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm transition",
        candidate.keep ? "opacity-100" : "opacity-70",
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2 pt-0.5">
              <Checkbox
                checked={candidate.keep}
                onCheckedChange={(checked) => onCandidateChange({ ...candidate, keep: Boolean(checked) })}
              />
              <span className="text-[11px] font-semibold text-muted-foreground">Keep</span>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {candidate.rawText || candidate.decisionTitle}
              </p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {candidate.decisionDetail || candidate.decisionTitle || "No excerpt available."}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {candidate.duplicateOf ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Duplicate
                  </span>
                ) : null}
                {mergedCount > 1 ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Merged
                  </span>
                ) : null}
                {!candidate.duplicateOf && candidate.tableNoise ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Likely table noise
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={candidate.category}
              onValueChange={(value) => onCandidateChange({ ...candidate, category: value })}
            >
              <SelectTrigger className="h-8 min-w-[160px] text-xs">
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
            {evidenceAnchors.length > 0 ? (
              <EvidencePopover
                evidenceAnchors={evidenceAnchors}
                isOpen={isEvidenceOpen}
                onOpenChange={onEvidenceOpenChange}
              />
            ) : null}
            {evidenceLabel ? <span className="text-[11px] text-muted-foreground">{evidenceLabel}</span> : null}
            {mergedCount > 1 ? (
              <Dialog open={isMergeOpen} onOpenChange={setIsMergeOpen}>
                <DialogTrigger asChild>
                  <button type="button" className="text-[11px] font-semibold text-primary">
                    View merges
                  </button>
                </DialogTrigger>
                <DialogContent className="left-auto right-0 top-0 h-full w-full max-w-lg translate-x-0 translate-y-0 overflow-y-auto rounded-none sm:rounded-none">
                  <DialogHeader className="text-left">
                    <DialogTitle className="text-base">Merged decision</DialogTitle>
                    <p className="text-xs text-muted-foreground">{candidate.decisionTitle}</p>
                  </DialogHeader>
                  <div className="space-y-4 text-xs">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Merge details
                      </p>
                      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                        <p>Sources merged: {mergedCount}</p>
                        {candidate.sources?.mergeReason.length ? (
                          <p>Reason: {candidate.sources.mergeReason.join(", ")}</p>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Evidence anchors
                      </p>
                      <div className="mt-2 space-y-2">
                        {evidenceAnchors.map((anchor) => (
                          <div key={`${anchor.docId}-${anchor.page}-${anchor.excerpt.slice(0, 12)}`}>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{anchor.fileName}</span>
                              <span className="text-[10px] text-muted-foreground">p. {anchor.page}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-muted-foreground">{anchor.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {candidate.sourceCandidates && candidate.sourceCandidates.length > 0 ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Raw candidates
                        </p>
                        <div className="mt-2 space-y-2">
                          {candidate.sourceCandidates.map((source) => (
                            <details key={source.id} className="rounded-md border border-border/60 px-3 py-2">
                              <summary className="cursor-pointer text-[11px] font-semibold text-foreground">
                                {source.fileName} · p. {source.page}
                              </summary>
                              <p className="mt-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
                                {source.rawText}
                              </p>
                            </details>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scores</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {scoreLabels.map(({ key, label }) => (
              <ScoreStepper
                key={`${candidate.id}-${key}`}
                label={label}
                value={candidate.scores[key]}
                onChange={(next) =>
                  onCandidateChange({
                    ...candidate,
                    scores: {
                      ...candidate.scores,
                      [key]: next,
                    },
                  })
                }
              />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-[11px] font-semibold"
            onClick={() => onEditOpenChange(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>

      <EditDecisionModal
        candidate={candidate}
        open={isEditOpen}
        onOpenChange={onEditOpenChange}
        onCandidateChange={onCandidateChange}
      />
    </div>
  );
}
