"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DecisionCandidate } from "@/components/stress-test/decision-intake-types";
import { EvidencePopover } from "@/components/stress-test/EvidencePopover";
import { ScoreControls } from "@/components/stress-test/ScoreControls";
import { Pencil } from "lucide-react";

interface CandidateCardProps {
  candidate: DecisionCandidate;
  categories: string[];
  isEvidenceOpen: boolean;
  onEvidenceOpenChange: (nextOpen: boolean) => void;
  onEdit: () => void;
  onKeepChange: (keep: boolean) => void;
  onCategoryChange: (category: string) => void;
  onScoreChange: (key: keyof DecisionCandidate["scores"], value: number | undefined) => void;
}

export function CandidateCard({
  candidate,
  categories,
  isEvidenceOpen,
  onEvidenceOpenChange,
  onEdit,
  onKeepChange,
  onCategoryChange,
  onScoreChange,
}: CandidateCardProps) {
  const isDuplicate = Boolean(candidate.flags.duplicateOf);

  return (
    <div className="rounded-xl border border-border/60 bg-background/90 p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
        <div className="flex items-start gap-3 lg:flex-col lg:gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Checkbox checked={candidate.keep} onCheckedChange={(checked) => onKeepChange(Boolean(checked))} />
            <span>Keep</span>
          </label>
          <div className="flex flex-wrap gap-1">
            {candidate.flags.likelyTableNoise ? (
              <Badge variant="secondary" className="text-[10px] text-amber-700">
                Table noise
              </Badge>
            ) : null}
            {candidate.flags.lowSignal ? (
              <Badge variant="secondary" className="text-[10px] text-amber-700">
                Low signal
              </Badge>
            ) : null}
            {isDuplicate ? (
              <Badge variant="secondary" className="text-[10px] text-amber-700">
                Duplicate
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{candidate.title}</p>
              {candidate.detail ? (
                <p className="line-clamp-2 text-[11px] text-muted-foreground">{candidate.detail}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Edit decision"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <EvidencePopover source={candidate.source} isOpen={isEvidenceOpen} onOpenChange={onEvidenceOpenChange} />
            <Select value={candidate.category} onValueChange={onCategoryChange}>
              <SelectTrigger className="h-7 w-[150px] text-[11px]">
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
          </div>
        </div>

        <div className="w-full lg:w-[360px]">
          <ScoreControls
            scores={candidate.scores}
            onChange={(key, value) => onScoreChange(key, value)}
          />
        </div>
      </div>
    </div>
  );
}
