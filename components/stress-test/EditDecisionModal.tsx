"use client";

import type { DecisionCandidate } from "@/components/stress-test/decision-intake-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EditDecisionModalProps {
  candidate: DecisionCandidate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCandidateChange: (candidate: DecisionCandidate) => void;
}

const TITLE_MAX_LENGTH = 120;

export function EditDecisionModal({ candidate, open, onOpenChange, onCandidateChange }: EditDecisionModalProps) {
  const titleCount = candidate.decisionTitle?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Decision</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>Decision title</span>
              <span>
                {titleCount}/{TITLE_MAX_LENGTH}
              </span>
            </div>
            <Input
              value={candidate.decisionTitle}
              maxLength={TITLE_MAX_LENGTH}
              onChange={(event) => onCandidateChange({ ...candidate, decisionTitle: event.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground">Decision detail</label>
            <Textarea
              value={candidate.decisionDetail}
              onChange={(event) => onCandidateChange({ ...candidate, decisionDetail: event.target.value })}
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
                  p. {candidate.evidence.pageNumber}
                </span>
              ) : null}
            </div>
            <div className="mt-2 line-clamp-4 whitespace-pre-wrap">{candidate.evidence.rawExcerpt}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
