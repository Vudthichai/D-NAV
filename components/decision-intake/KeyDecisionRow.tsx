"use client";

import { type ChangeEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [useTextarea, setUseTextarea] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pageLabel = candidate.evidence.page ? `p${candidate.evidence.page}` : "p.n/a";
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
  const metadata = [pageLabel, timeframe].filter(Boolean).join(" · ");
  const decisionText = candidate.decision;
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleExpanded();
      }
    },
    [toggleExpanded],
  );
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
    <div className="rounded-lg border border-border/60 bg-white/70 text-xs text-muted-foreground shadow-sm dark:bg-white/10">
      <div
        className="flex cursor-pointer items-start justify-between gap-3 px-3 py-2 transition hover:bg-muted/10"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
      >
        <div className="min-w-0 flex-1 space-y-1">
          {useTextarea ? (
            <textarea
              ref={textareaRef}
              value={decisionText}
              placeholder="Edit decision..."
              rows={3}
              className="w-full resize-none rounded-md border border-border/60 bg-white/80 px-2 py-1 text-sm font-normal leading-relaxed text-foreground shadow-sm focus:border-primary focus:outline-none dark:bg-white/10"
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
              className="w-full truncate rounded-md border border-border/60 bg-white/80 px-2 py-1 text-sm font-normal leading-snug text-foreground shadow-sm focus:border-primary focus:outline-none dark:bg-white/10"
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
          <p className="text-[11px] text-muted-foreground">{metadata}</p>
        </div>
        <div className="shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-full px-3 text-[10px] font-semibold uppercase tracking-wide"
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded();
            }}
          >
            Rate
          </Button>
        </div>
      </div>

      {isExpanded ? (
        <div className="border-t border-border/50 px-3 py-3" onClick={(event) => event.stopPropagation()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline"
                >
                  View PDF
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
      ) : null}
    </div>
  );
}
