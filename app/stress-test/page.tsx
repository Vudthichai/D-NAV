"use client";

import StressTestCalculator, {
  StressTestCalculatorHandle,
  type StressTestDecisionSnapshot,
} from "@/components/stress-test/StressTestCalculator";
import { useDefinitionsPanel } from "@/components/definitions/DefinitionsPanelProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCallback, useEffect, useRef, useState } from "react";

interface SessionDecision {
  id: string;
  decisionTitle: string;
  decisionDetail?: string;
  category: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
  r: number;
  p: number;
  s: number;
  dnav: number;
  createdAt: number;
}

const SESSION_DECISIONS_KEY = "dnav:stressTest:sessionDecisions";

const isSessionDecisionSnapshot = (value: unknown): value is SessionDecision => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SessionDecision>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.decisionTitle === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.r === "number" &&
    typeof candidate.p === "number" &&
    typeof candidate.s === "number" &&
    typeof candidate.dnav === "number"
  );
};

export default function StressTestPage() {
  const [sessionDecisions, setSessionDecisions] = useState<SessionDecision[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.sessionStorage.getItem(SESSION_DECISIONS_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      return Array.isArray(parsed) ? parsed.filter(isSessionDecisionSnapshot) : [];
    } catch (error) {
      console.error("Failed to load stress test session decisions.", error);
      return [];
    }
  });
  const calculatorRef = useRef<StressTestCalculatorHandle>(null);

  const { openDefinitions } = useDefinitionsPanel();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionDecisions.length === 0) {
        window.sessionStorage.removeItem(SESSION_DECISIONS_KEY);
      } else {
        window.sessionStorage.setItem(SESSION_DECISIONS_KEY, JSON.stringify(sessionDecisions));
      }
    } catch (error) {
      console.error("Failed to persist stress test session decisions.", error);
    }
  }, [sessionDecisions]);

  const handleSaveSessionDecision = useCallback((decision: StressTestDecisionSnapshot) => {
    const title = decision.name?.trim() || "Untitled decision";
    const sessionDecision: SessionDecision = {
      id: decision.id,
      decisionTitle: title,
      decisionDetail: "",
      category: decision.category,
      impact: decision.impact,
      cost: decision.cost,
      risk: decision.risk,
      urgency: decision.urgency,
      confidence: decision.confidence,
      r: decision.return,
      p: decision.pressure,
      s: decision.stability,
      dnav: decision.dnav,
      createdAt: decision.createdAt,
    };
    setSessionDecisions((prev) => [sessionDecision, ...prev]);
  }, []);

  const decisionCount = sessionDecisions.length;
  const progressCount = Math.min(decisionCount, 10);
  const canOpenSessionAnalysis = decisionCount >= 10;

  const formatCompact = useCallback((value: number, digits = 0) => {
    if (!Number.isFinite(value)) return "0";
    return value.toFixed(digits);
  }, []);

  const formatSignal = useCallback((value: number) => {
    if (!Number.isFinite(value)) return "0";
    const formatted = value.toFixed(1).replace(/\.0$/, "");
    if (value > 0) return `+${formatted}`;
    return formatted;
  }, []);

  const handleClearSession = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.confirm("Clear saved session decisions?")) return;
    setSessionDecisions([]);
    calculatorRef.current?.resetSavedState();
    try {
      window.sessionStorage.removeItem(SESSION_DECISIONS_KEY);
    } catch (error) {
      console.error("Failed to clear stress test session decisions.", error);
    }
  }, []);

  // TODO: Rebuild Decision Intake v2
  // Intake will be redesigned around the Decision Atom:
  // Actor + Action + Object + Constraint

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#f6f3ee] text-slate-900 dark:bg-[#050608] dark:text-white">
        <section className="bg-gradient-to-b from-[#f8f5f1] via-white to-[#f3efe8] dark:from-[#050608] dark:via-black/40 dark:to-[#050608]">
          <div className="mx-auto max-w-6xl space-y-3 px-4 pb-4 pt-3 md:px-6">
            <div className="flex flex-col gap-2 border-b border-border/60 pb-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold text-foreground">Stress Test</h1>
                  <p className="text-sm font-semibold text-foreground">See the shape of your decision in review.</p>
                  <p className="text-sm text-muted-foreground">Run a guided diagnostic on a decision and capture the signal.</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => openDefinitions(event.currentTarget)}
                      className="font-semibold"
                    >
                      Definitions
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <StressTestCalculator ref={calculatorRef} saveLabel="Save decision" onSaveDecision={handleSaveSessionDecision} />

            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-foreground">
                <span>
                  {decisionCount >= 10
                    ? "10/10 decisions logged — signal unlocked"
                    : `${decisionCount}/10 decisions logged`}
                </span>
                <div className="flex flex-col items-end gap-1 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Session progress</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-semibold uppercase tracking-wide"
                      onClick={handleClearSession}
                      disabled={decisionCount === 0}
                    >
                      Clear session
                    </Button>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer text-[11px] font-medium text-muted-foreground underline underline-offset-2">
                        What does this mean?
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[240px]">
                      Session Analysis shows how your decisions behave under pressure during review, before hindsight distorts them.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all"
                  style={{ width: `${progressCount * 10}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {decisionCount >= 10
                  ? `Session insight is based on these ${decisionCount} decisions. More decisions sharpen the signal.`
                  : "Insight unlocks at 10 decisions. More decisions sharpen the signal."}
              </p>
              <p className="text-[11px] text-muted-foreground">Session-only. Nothing is saved.</p>

              {decisionCount > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[720px] space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      These are live decisions captured in-the-moment for review — before outcomes rewrite the story.
                    </p>
                    <div className="grid grid-cols-[minmax(180px,1.6fr)_repeat(5,minmax(48px,0.5fr))_repeat(3,minmax(40px,0.4fr))_minmax(56px,0.5fr)] items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Decision</span>
                      <span className="text-center">Impact</span>
                      <span className="text-center">Cost</span>
                      <span className="text-center">Risk</span>
                      <span className="text-center">Urgency</span>
                      <span className="text-center">Confidence</span>
                      <span className="text-center">R</span>
                      <span className="text-center">P</span>
                      <span className="text-center">S</span>
                      <span className="text-right">D-NAV</span>
                    </div>
                    {sessionDecisions.map((decision) => (
                      <div
                        key={decision.id}
                        className="grid grid-cols-[minmax(180px,1.6fr)_repeat(5,minmax(48px,0.5fr))_repeat(3,minmax(40px,0.4fr))_minmax(56px,0.5fr)] items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-1 text-[11px] text-muted-foreground"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{decision.decisionTitle}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{decision.category}</p>
                        </div>
                        <span className="text-center tabular-nums">{formatCompact(decision.impact)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.cost)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.risk)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.urgency)}</span>
                        <span className="text-center tabular-nums">{formatCompact(decision.confidence)}</span>
                        <span className="text-center tabular-nums">{formatSignal(decision.r)}</span>
                        <span className="text-center tabular-nums">{formatSignal(decision.p)}</span>
                        <span className="text-center tabular-nums">{formatSignal(decision.s)}</span>
                        <span className="text-right font-semibold text-foreground tabular-nums">
                          {formatCompact(decision.dnav, 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button
                className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                disabled={!canOpenSessionAnalysis}
              >
                OPEN SESSION ANALYSIS
              </Button>
            </div>

            <section id="session-gated-area" className="mt-8">
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                <strong>Session-gated area cleared</strong>
                <p className="mt-2">
                  All post-session UI has been intentionally removed. This space will be rebuilt once session-level
                  analysis is redesigned.
                </p>
              </div>
            </section>
          </div>
        </section>
      </main>
    </TooltipProvider>
  );
}
