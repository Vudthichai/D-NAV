"use client";

import { useState } from "react";
import type { DecisionCandidate } from "@/components/stress-test/decision-intake-types";
import { EvidencePopover } from "@/components/stress-test/EvidencePopover";
import { EditDecisionModal } from "@/components/stress-test/EditDecisionModal";
import { ScoreStepper } from "@/components/stress-test/ScoreStepper";
import { Badge } from "@/components/ui/badge";
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
  const timeBadge = candidate.timeAnchor?.raw;
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm transition",
        candidate.keep ? "opacity-100" : "opacity-70",
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={candidate.keep}
              onCheckedChange={(checked) => onCandidateChange({ ...candidate, keep: Boolean(checked) })}
            />
            <span className="text-[11px] font-semibold text-muted-foreground">Keep</span>
          </div>
          <p className="min-w-[180px] flex-1 truncate text-sm font-semibold text-foreground">
            {candidate.decisionTitle}
          </p>
          {timeBadge ? (
            <Badge variant="secondary" className="text-[10px]">
              {timeBadge}
            </Badge>
          ) : null}
          <Select
            value={candidate.category}
            onValueChange={(value) => onCandidateChange({ ...candidate, category: value })}
          >
            <SelectTrigger className="h-8 min-w-[150px] text-xs">
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
          {candidate.bin === "MaybeDecision" ? (
            <Badge variant="secondary" className="text-[10px]">
              Maybe
            </Badge>
          ) : null}
          {candidate.titleStatus === "NeedsRewrite" ? (
            <Badge variant="destructive" className="text-[10px]">
              Needs rewrite
            </Badge>
          ) : null}
          {candidate.duplicateOf ? (
            <Badge variant="secondary" className="text-[10px]">
              Duplicate
            </Badge>
          ) : null}
          {!candidate.duplicateOf && candidate.tableNoise ? (
            <Badge variant="secondary" className="text-[10px]">
              Likely table noise
            </Badge>
          ) : null}
          {mergedCount > 1 ? (
            <Badge variant="secondary" className="text-[10px]">
              Merged
            </Badge>
          ) : null}
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

        <div className="flex flex-wrap items-center gap-2">
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

      <EditDecisionModal
        candidate={candidate}
        open={isEditOpen}
        onOpenChange={onEditOpenChange}
        onCandidateChange={onCandidateChange}
      />
    </div>
  );
}
