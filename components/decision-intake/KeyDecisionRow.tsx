"use client";

import { cn } from "@/lib/utils";
import type { DecisionCandidate, DecisionCategory } from "@/lib/intake/decisionExtractLocal";
import { computeRpsDnav } from "@/lib/intake/decisionMetrics";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MetricStepperPill from "@/components/decision-intake/MetricStepperPill";

const METRICS = [
  { key: "impact", label: "I", name: "Impact" },
  { key: "cost", label: "C", name: "Cost" },
  { key: "risk", label: "R", name: "Risk" },
  { key: "urgency", label: "U", name: "Urgency" },
  { key: "confidence", label: "CF", name: "Confidence" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

interface KeyDecisionRowProps {
  candidate: DecisionCandidate;
  categoryOptions: DecisionCategory[];
  isAdded: boolean;
  pdfUrl?: string | null;
  onAdd: (candidate: DecisionCandidate) => void;
  onDismiss: (id: string) => void;
  onCategoryChange: (id: string, category: DecisionCategory) => void;
  onMetricChange: (id: string, key: MetricKey, value: number) => void;
  onStrengthChange: (id: string, strength: DecisionCandidate["strength"]) => void;
}

export default function KeyDecisionRow({
  candidate,
  categoryOptions,
  isAdded,
  pdfUrl,
  onAdd,
  onDismiss,
  onCategoryChange,
  onMetricChange,
  onStrengthChange,
}: KeyDecisionRowProps) {
  const pageLabel = candidate.evidence.page ? `Source p.${candidate.evidence.page}` : "Source p.n/a";
  const metrics = computeRpsDnav(candidate.sliders);
  const statusLabel = candidate.strength === "committed" ? "Committed" : "Indicative";
  const statusBadgeClass =
    candidate.strength === "committed"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
      : "border-amber-500/40 bg-amber-500/10 text-amber-700";
  const formatSignal = (value: number) => {
    if (!Number.isFinite(value)) return "0";
    const formatted = value.toFixed(1).replace(/\.0$/, "");
    return value > 0 ? `+${formatted}` : formatted;
  };
  const formatCompact = (value: number) => {
    if (!Number.isFinite(value)) return "0";
    return value.toFixed(1).replace(/\.0$/, "");
  };
  const cleanDecisionText = (value: string) =>
    value.replace(/^(?:the\s+)?company\s+commits?\s+to\s+/i, "").trim();
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
  const metadata = [candidate.category, pageLabel, timeframe].filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl border border-border/60 bg-white/70 px-5 py-5 text-xs text-muted-foreground shadow-sm dark:bg-white/10">
      <div className="flex flex-col gap-5">
        <div className="rounded-lg border border-border/50 border-l-4 border-l-primary/30 bg-muted/5 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className={cn("rounded-full border px-2 py-0.5", statusBadgeClass)}>{statusLabel}</span>
            <span>{metadata}</span>
          </div>
          <p className="mt-2 line-clamp-3 text-base font-semibold leading-relaxed text-foreground sm:text-lg">
            {cleanDecisionText(candidate.decision)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/10 p-0.5">
              <button
                type="button"
                onClick={() => onStrengthChange(candidate.id, "committed")}
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                  candidate.strength === "committed"
                    ? "border border-foreground bg-foreground text-background shadow-sm"
                    : "border border-transparent text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={candidate.strength === "committed"}
              >
                COMMITTED
              </button>
              <button
                type="button"
                onClick={() => onStrengthChange(candidate.id, "indicative")}
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                  candidate.strength === "indicative"
                    ? "border border-foreground bg-foreground text-background shadow-sm"
                    : "border border-transparent text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={candidate.strength === "indicative"}
              >
                INDICATIVE
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="grid h-6 w-6 place-items-center rounded-full border border-border/60 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
                    aria-label="Committed versus indicative definitions"
                  >
                    ?
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 rounded-xl border border-border/60 bg-background/95 p-3 text-xs">
                  <p className="font-semibold text-foreground">Committed</p>
                  <p className="text-[11px] text-muted-foreground">
                    Explicit promise, plan, or irreversible direction.
                  </p>
                  <p className="mt-2 font-semibold text-foreground">Indicative</p>
                  <p className="text-[11px] text-muted-foreground">
                    Signal, expectation, or forecast &mdash; less binding.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <Select
              value={candidate.category}
              onValueChange={(value) => onCategoryChange(candidate.id, value as DecisionCategory)}
            >
              <SelectTrigger size="sm" className="h-7 rounded-full border-border/60 bg-background/70 px-3 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {categoryOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
              className="grid h-8 w-8 place-items-center rounded-full border border-border/60 bg-transparent text-[14px] font-semibold text-muted-foreground transition hover:border-border/80 hover:text-foreground"
              onClick={() => onDismiss(candidate.id)}
              aria-label="Dismiss decision"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Outcome Load</p>
            <div className="flex flex-wrap items-center gap-2">
              {METRICS.slice(0, 3).map((metric) => (
                <MetricStepperPill
                  key={metric.key}
                  label={metric.label}
                  value={candidate.sliders[metric.key]}
                  onChange={(value) => onMetricChange(candidate.id, metric.key, value)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Urgency &amp; Confidence
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {METRICS.slice(3).map((metric) => (
                <MetricStepperPill
                  key={metric.key}
                  label={metric.label}
                  value={candidate.sliders[metric.key]}
                  onChange={(value) => onMetricChange(candidate.id, metric.key, value)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">RPS + D-NAV</p>
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-border/60 bg-muted/10 px-3 py-2 text-[11px]">
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">R</span>
              <span className="font-semibold text-foreground tabular-nums">{formatSignal(metrics.r)}</span>
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">P</span>
              <span className="font-semibold text-foreground tabular-nums">{formatSignal(metrics.p)}</span>
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">S</span>
              <span className="font-semibold text-foreground tabular-nums">{formatSignal(metrics.s)}</span>
              <span className="ml-1 font-semibold uppercase tracking-wide text-muted-foreground">D-NAV</span>
              <span className="font-semibold text-foreground tabular-nums">{formatCompact(metrics.dnav)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
