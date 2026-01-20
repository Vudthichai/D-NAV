"use client";

import type { DecisionCandidate } from "@/components/stress-test/decision-intake-types";
import { EvidencePopover } from "@/components/stress-test/EvidencePopover";
import { EditDecisionModal } from "@/components/stress-test/EditDecisionModal";
import { ScoreStepper } from "@/components/stress-test/ScoreStepper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
            <EvidencePopover
              evidence={candidate.evidence}
              isOpen={isEvidenceOpen}
              onOpenChange={onEvidenceOpenChange}
            />
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
