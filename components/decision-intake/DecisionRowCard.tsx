"use client";

import { useMemo, useState } from "react";
import type { DecisionCandidate, EvidenceAnchor } from "@/components/stress-test/decision-intake-types";
import { EditDecisionModal } from "@/components/stress-test/EditDecisionModal";
import { ScoreControl } from "@/components/decision-intake/ScoreControl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

interface DecisionRowCardProps {
  candidate: DecisionCandidate;
  categories: string[];
  onCandidateChange: (candidate: DecisionCandidate) => void;
  showDecisionDebug?: boolean;
}

const scoreLabels: Array<{ key: keyof DecisionCandidate["scores"]; label: string }> = [
  { key: "impact", label: "Impact" },
  { key: "cost", label: "Cost" },
  { key: "risk", label: "Risk" },
  { key: "urgency", label: "Urgency" },
  { key: "confidence", label: "Confidence" },
];

const getAnchorId = (anchor: EvidenceAnchor) => `${anchor.docId}-${anchor.page}-${anchor.excerpt.slice(0, 12)}`;

const buildSnippet = (anchor?: EvidenceAnchor) => {
  if (!anchor) return "";
  const sourceText = anchor.contextText ?? anchor.excerpt;
  const lines = sourceText.split(/\r?\n/).filter(Boolean);
  return lines.slice(0, 3).join(" ");
};

const buildEvidenceViewUrl = (anchor?: EvidenceAnchor) => {
  if (!anchor?.fileName) return null;
  const isPdf = anchor.fileName.toLowerCase().endsWith(".pdf");
  if (!isPdf) return null;
  return `/mockups/${encodeURIComponent(anchor.fileName)}#page=${anchor.page}`;
};

export function DecisionRowCard({
  candidate,
  categories,
  onCandidateChange,
  showDecisionDebug = false,
}: DecisionRowCardProps) {
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);

  const evidenceAnchors = useMemo(() => candidate.evidenceAnchors ?? [], [candidate.evidenceAnchors]);
  const evidenceCount = evidenceAnchors.length;
  const mergedCount = candidate.sources?.candidateIds.length ?? 1;
  const timeBadge = candidate.timeAnchor?.raw;

  const primaryAnchor = evidenceAnchors[0];
  const resolvedAnchorId = activeAnchorId ?? (primaryAnchor ? getAnchorId(primaryAnchor) : null);

  const activeAnchor = useMemo(
    () => evidenceAnchors.find((anchor) => getAnchorId(anchor) === resolvedAnchorId) ?? primaryAnchor,
    [evidenceAnchors, primaryAnchor, resolvedAnchorId],
  );

  const pageBadges = useMemo(() => {
    const pages = Array.from(new Set(evidenceAnchors.map((anchor) => anchor.page))).sort((a, b) => a - b);
    return pages.map((page) => `p. ${page}`);
  }, [evidenceAnchors]);

  const snippet = buildSnippet(activeAnchor);
  const viewUrl = buildEvidenceViewUrl(activeAnchor ?? undefined);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition",
        candidate.keep ? "opacity-100" : "opacity-70",
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={candidate.keep}
              onCheckedChange={(checked) => onCandidateChange({ ...candidate, keep: Boolean(checked) })}
            />
            <span className="text-[11px] font-semibold text-muted-foreground">Keep</span>
          </div>
          <p className="min-w-[160px] flex-1 truncate text-sm font-semibold text-foreground">
            {candidate.decisionTitle}
          </p>
          <div className="flex flex-wrap items-center gap-2">
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
            {evidenceCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[11px] font-semibold"
                aria-expanded={isEvidenceOpen}
                onClick={() => setIsEvidenceOpen((prev) => !prev)}
              >
                Evidence ({evidenceCount})
              </Button>
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
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </div>

        <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1">
          {scoreLabels.map(({ key, label }) => (
            <ScoreControl
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

        {evidenceCount > 0 ? (
          <div
            className={cn(
              "overflow-hidden rounded-xl border border-border/50 bg-muted/10 transition-[max-height,opacity] duration-300",
              isEvidenceOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="space-y-3 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="max-w-[280px] truncate text-xs font-semibold text-foreground">
                    {activeAnchor?.fileName ?? "Uploaded PDF"}
                  </span>
                  {pageBadges.map((badge) => (
                    <Badge key={badge} variant="secondary" className="text-[10px]">
                      {badge}
                    </Badge>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  disabled={!viewUrl}
                  onClick={() => {
                    if (!viewUrl) return;
                    window.open(viewUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  View
                </Button>
              </div>
              {evidenceAnchors.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {evidenceAnchors.map((anchor) => {
                    const anchorId = getAnchorId(anchor);
                    const isActive = anchorId === resolvedAnchorId;
                    return (
                      <button
                        type="button"
                        key={anchorId}
                        onClick={() => setActiveAnchorId(anchorId)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[10px] font-semibold",
                          isActive
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-border/60 bg-white/70 text-muted-foreground",
                        )}
                      >
                        {anchor.fileName} · p. {anchor.page}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="rounded-lg border border-border/50 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Snippet</span>
                  {activeAnchor?.page ? (
                    <Badge variant="secondary" className="text-[10px]">
                      p. {activeAnchor.page}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {snippet || activeAnchor?.excerpt || ""}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {showDecisionDebug && candidate.gate ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-[11px] text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {candidate.gate.bin}
              </Badge>
              {candidate.gate.reasonsIncluded.map((reason) => (
                <Badge key={`include-${candidate.id}-${reason}`} variant="secondary" className="text-[10px]">
                  {reason}
                </Badge>
              ))}
              {candidate.gate.reasonsExcluded.map((reason) => (
                <Badge key={`exclude-${candidate.id}-${reason}`} variant="destructive" className="text-[10px]">
                  {reason}
                </Badge>
              ))}
            </div>
            {candidate.rawText ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-foreground">
                  Original extracted sentence
                </summary>
                <p className="mt-2 whitespace-pre-wrap">{candidate.rawText}</p>
                {candidate.sectionHint ? (
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Section: {candidate.sectionHint}
                  </p>
                ) : null}
              </details>
            ) : null}
          </div>
        ) : null}
      </div>

      <EditDecisionModal
        candidate={candidate}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onCandidateChange={onCandidateChange}
      />
    </div>
  );
}
