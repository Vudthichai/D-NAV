"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { DecisionCandidate } from "@/lib/intake/decisionExtractLocal";
import { Button } from "@/components/ui/button";
import MetricStepperPill from "@/components/decision-intake/MetricStepperPill";

const METRICS = [
  { key: "impact", label: "Impact" },
  { key: "cost", label: "Cost" },
  { key: "risk", label: "Risk" },
  { key: "urgency", label: "Urgency" },
  { key: "confidence", label: "Confidence" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

interface KeyDecisionRowProps {
  candidate: DecisionCandidate;
  isAdded: boolean;
  pdfUrl?: string | null;
  onAdd: (candidate: DecisionCandidate) => void;
  onDismiss: (id: string) => void;
  onMetricChange: (id: string, key: MetricKey, value: number) => void;
  onDecisionChange: (id: string, value: string) => void;
}

export default function KeyDecisionRow({
  candidate,
  isAdded,
  pdfUrl,
  onAdd,
  onDismiss,
  onMetricChange,
  onDecisionChange,
}: KeyDecisionRowProps) {
  const [useTextarea, setUseTextarea] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const candidatePage = candidate.page ?? candidate.evidence.page;
  const pageLabel = candidatePage ? `p${candidatePage}` : "p.n/a";
  const candidateCategory = [candidate.category, candidate.categoryGuess]
    .map((value) => value?.trim())
    .find((value) => value);
  const categoryLabel = candidateCategory || "Uncategorized";
  const findTimeframe = (value?: string) => {
    if (!value) return null;
    const patterns = [
      /\bQ[1-4]\b[^,.]*/i,
      /\bH[1-2]\b[^,.]*/i,
      /\b20\d{2}\b[^,.]*/i,
      /\bthis (year|quarter|month)\b/i,
      /\bnext (year|quarter|month)\b/i,
      /\bby [^,.]+/i,
      /\bwithin \d{1,2} months\b/i,
    ];
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match?.[0]) return match[0].trim();
    }
    return null;
  };
  const timeframe = findTimeframe(candidate.evidence.full ?? candidate.decision);
  const metadata = [categoryLabel, pageLabel, timeframe].filter(Boolean).join(" • ");
  const decisionText = candidate.decision;
  const handleDecisionChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onDecisionChange(candidate.id, event.target.value);
    },
    [candidate.id, onDecisionChange],
  );
  const handleDecisionFocus = useCallback(() => {
    if (decisionText.length > 120) {
      setUseTextarea(true);
    }
  }, [decisionText.length]);
  const handleDecisionBlur = useCallback(() => {
    setUseTextarea(false);
  }, []);

  useEffect(() => {
    if (useTextarea) {
      textareaRef.current?.focus();
    }
  }, [useTextarea]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white text-xs text-muted-foreground shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:border-neutral-700 dark:hover:bg-neutral-900/55">
      <div className="space-y-2 px-3 py-3">
        <div className="min-w-0 space-y-2">
          {useTextarea ? (
            <textarea
              ref={textareaRef}
              value={decisionText}
              placeholder="Edit decision..."
              rows={3}
              className="w-full resize-none rounded-md border border-border/60 bg-white/80 px-2 py-1 text-sm sm:text-[15px] font-medium leading-relaxed text-neutral-900 shadow-sm focus:border-primary focus:outline-none dark:bg-white/10 dark:text-neutral-100"
              onChange={handleDecisionChange}
              onFocus={(event) => {
                event.stopPropagation();
                handleDecisionFocus();
              }}
              onBlur={handleDecisionBlur}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            />
          ) : (
            <input
              type="text"
              value={decisionText}
              placeholder="Edit decision..."
              className="w-full truncate rounded-md border border-border/60 bg-white/80 px-2 py-1 text-sm sm:text-[15px] font-medium leading-relaxed text-neutral-900 shadow-sm focus:border-primary focus:outline-none dark:bg-white/10 dark:text-neutral-100"
              onChange={handleDecisionChange}
              onFocus={(event) => {
                event.stopPropagation();
                handleDecisionFocus();
              }}
              onBlur={handleDecisionBlur}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            />
          )}
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{metadata}</p>
        </div>

        <div className="border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline"
                >
                  View Source
                </a>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "rounded-full text-[10px] font-semibold uppercase tracking-wide",
                  isAdded
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15"
                    : "border-border/60 bg-foreground/5 text-foreground hover:bg-foreground/10",
                )}
                onClick={() => onAdd(candidate)}
                disabled={isAdded}
              >
                {isAdded ? "Added ✓" : "Add to Session"}
              </Button>
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-full border border-border/60 bg-transparent text-[14px] font-semibold text-muted-foreground transition hover:border-border/80 hover:text-foreground"
                onClick={() => onDismiss(candidate.id)}
                aria-label="Dismiss decision"
              >
                ×
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {METRICS.map((metric) => (
                <MetricStepperPill
                  key={metric.key}
                  label={metric.label}
                  value={candidate.sliders[metric.key]}
                  onChange={(value) => onMetricChange(candidate.id, metric.key, value)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
