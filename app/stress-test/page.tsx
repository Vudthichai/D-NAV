"use client";

import StressTestCalculator, {
  StressTestCalculatorHandle,
  type StressTestDecisionSnapshot,
} from "@/components/stress-test/StressTestCalculator";
import DecisionCandidateIntake from "@/components/stress-test/DecisionCandidateIntake";
import { useDefinitionsPanel } from "@/components/definitions/DefinitionsPanelProvider";
import { Button } from "@/components/ui/button";
import { AccentSliver } from "@/components/ui/AccentSliver";
import { Callout } from "@/components/ui/Callout";
import Term from "@/components/ui/Term";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MetricDistribution, type MetricDistributionSegment } from "@/components/reports/MetricDistribution";
import { getSessionActionInsight } from "@/lib/sessionActionInsight";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [isSessionAnalysisOpen, setIsSessionAnalysisOpen] = useState(false);
  const calculatorRef = useRef<StressTestCalculatorHandle>(null);
  const sessionAnalysisRef = useRef<HTMLDivElement>(null);

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

  const sessionStats = useMemo(() => {
    if (sessionDecisions.length === 0) {
      return {
        avgImpact: 0,
        avgCost: 0,
        avgRisk: 0,
        avgUrgency: 0,
        avgConfidence: 0,
        avgReturn: 0,
        avgPressure: 0,
        avgStability: 0,
        avgDnav: 0,
      };
    }

    const totals = sessionDecisions.reduce(
      (acc, decision) => {
        acc.impact += decision.impact;
        acc.cost += decision.cost;
        acc.risk += decision.risk;
        acc.urgency += decision.urgency;
        acc.confidence += decision.confidence;
        acc.return += decision.r;
        acc.pressure += decision.p;
        acc.stability += decision.s;
        acc.dnav += decision.dnav;
        return acc;
      },
      { impact: 0, cost: 0, risk: 0, urgency: 0, confidence: 0, return: 0, pressure: 0, stability: 0, dnav: 0 },
    );

    const count = sessionDecisions.length;
    return {
      avgImpact: totals.impact / count,
      avgCost: totals.cost / count,
      avgRisk: totals.risk / count,
      avgUrgency: totals.urgency / count,
      avgConfidence: totals.confidence / count,
      avgReturn: totals.return / count,
      avgPressure: totals.pressure / count,
      avgStability: totals.stability / count,
      avgDnav: totals.dnav / count,
    };
  }, [sessionDecisions]);

  const sessionBuckets = useMemo(() => {
    const buckets = {
      return: { Positive: 0, Neutral: 0, Negative: 0 },
      pressure: { Pressured: 0, Neutral: 0, Calm: 0 },
      stability: { Stable: 0, Neutral: 0, Fragile: 0 },
    };

    sessionDecisions.forEach((decision) => {
      if (decision.r > 0) buckets.return.Positive += 1;
      else if (decision.r < 0) buckets.return.Negative += 1;
      else buckets.return.Neutral += 1;

      if (decision.p > 0) buckets.pressure.Pressured += 1;
      else if (decision.p < 0) buckets.pressure.Calm += 1;
      else buckets.pressure.Neutral += 1;

      if (decision.s > 0) buckets.stability.Stable += 1;
      else if (decision.s < 0) buckets.stability.Fragile += 1;
      else buckets.stability.Neutral += 1;
    });

    return buckets;
  }, [sessionDecisions]);

  const sessionDistributions = useMemo(() => {
    const total = sessionDecisions.length;
    const toPct = (value: number) => (total > 0 ? (value / total) * 100 : 0);

    const returnSegments: MetricDistributionSegment[] = [
      { label: "Positive", value: toPct(sessionBuckets.return.Positive), colorClass: "bg-emerald-500" },
      { label: "Neutral", value: toPct(sessionBuckets.return.Neutral), colorClass: "bg-muted" },
      { label: "Negative", value: toPct(sessionBuckets.return.Negative), colorClass: "bg-rose-500" },
    ];

    const pressureSegments: MetricDistributionSegment[] = [
      { label: "Pressured", value: toPct(sessionBuckets.pressure.Pressured), colorClass: "bg-amber-500" },
      { label: "Neutral", value: toPct(sessionBuckets.pressure.Neutral), colorClass: "bg-muted" },
      { label: "Calm", value: toPct(sessionBuckets.pressure.Calm), colorClass: "bg-sky-500" },
    ];

    const stabilitySegments: MetricDistributionSegment[] = [
      { label: "Stable", value: toPct(sessionBuckets.stability.Stable), colorClass: "bg-emerald-600" },
      { label: "Neutral", value: toPct(sessionBuckets.stability.Neutral), colorClass: "bg-muted" },
      { label: "Fragile", value: toPct(sessionBuckets.stability.Fragile), colorClass: "bg-rose-500" },
    ];

    return {
      returnSegments,
      pressureSegments,
      stabilitySegments,
      pressurePressuredPct: toPct(sessionBuckets.pressure.Pressured),
      stabilityFragilePct: toPct(sessionBuckets.stability.Fragile),
    };
  }, [sessionBuckets, sessionDecisions.length]);

  const sessionDirective = useMemo(
    () =>
      getSessionActionInsight({
        avgReturn: sessionStats.avgReturn,
        avgPressure: sessionStats.avgPressure,
        avgStability: sessionStats.avgStability,
        avgRisk: sessionStats.avgRisk,
        avgConfidence: sessionStats.avgConfidence,
      }),
    [
      sessionStats.avgConfidence,
      sessionStats.avgPressure,
      sessionStats.avgReturn,
      sessionStats.avgRisk,
      sessionStats.avgStability,
    ],
  );

  const sessionActionOutput = useMemo(() => {
    if (sessionDecisions.length === 0) {
      return {
        callout: "Action Insight will appear once a few decisions are logged.",
        invitation: "Log one decision to surface a pressure pattern.",
        note: null,
      };
    }

    if (sessionStats.avgUrgency - sessionStats.avgConfidence >= 1) {
      return {
        callout: "Urgency is leading confidence across the session.",
        invitation: "Left unchecked, this pattern scales risk faster than impact.",
        note: null,
      };
    }

    if (sessionStats.avgReturn > 0 && sessionStats.avgStability < 0.5) {
      return {
        callout: "Returns lead, but stability is lagging across the session.",
        invitation: "Left unchecked, this pattern compounds risk faster than resilience.",
        note: null,
      };
    }

    if (sessionStats.avgImpact - sessionStats.avgConfidence >= 1) {
      return {
        callout: "Impact is leading, while confidence is lagging across the session.",
        invitation: "Left unchecked, this pattern stretches execution beyond evidence.",
        note: null,
      };
    }

    if (sessionStats.avgReturn <= 0 || sessionStats.avgPressure > 1) {
      return {
        callout: "Pressure is rising while return is muted across the session.",
        invitation: "Left unchecked, this pattern limits upside while drag compounds.",
        note: null,
      };
    }

    return {
      callout: "Confidence, pressure, and return are aligned across the session.",
      invitation: "Left unchecked, this pattern can drift if urgency spikes.",
      note: "Aligned signals can still hide emerging pressure without guided review.",
    };
  }, [
    sessionDecisions.length,
    sessionStats.avgConfidence,
    sessionStats.avgImpact,
    sessionStats.avgPressure,
    sessionStats.avgReturn,
    sessionStats.avgStability,
    sessionStats.avgUrgency,
  ]);

  const handleSessionAnalysisToggle = useCallback(() => {
    const nextOpen = !isSessionAnalysisOpen;
    setIsSessionAnalysisOpen(nextOpen);
    if (nextOpen) {
      requestAnimationFrame(() => {
        sessionAnalysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [isSessionAnalysisOpen]);

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
    setIsSessionAnalysisOpen(false);
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

            <DecisionCandidateIntake />

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

              {canOpenSessionAnalysis ? (
                <Button
                  className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                  onClick={handleSessionAnalysisToggle}
                >
                  OPEN SESSION ANALYSIS
                </Button>
              ) : (
                <Button className="h-9 px-4 text-xs font-semibold uppercase tracking-wide" disabled>
                  OPEN SESSION ANALYSIS
                </Button>
              )}
            </div>

            {canOpenSessionAnalysis && isSessionAnalysisOpen ? (
              <div
                ref={sessionAnalysisRef}
                className="dnav-dark-glass-surface space-y-4 rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">
                      Session Analysis — Your Judgment Under Pressure
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      A pattern-level readout of how you make decisions before outcomes intervene.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      In guided consulting sessions, we review many decisions to surface the real variables — and
                      understand the physics of judgment under pressure.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs font-semibold uppercase tracking-wide"
                    onClick={() => setIsSessionAnalysisOpen(false)}
                  >
                    Collapse
                  </Button>
                </div>
                <Callout
                  label={
                    <>
                      <AccentSliver />
                      <span>Session Insight</span>
                    </>
                  }
                  labelClassName="flex items-center gap-2 text-muted-foreground"
                  bodyClassName="text-foreground"
                  className="dnav-dark-glass-surface dnav-insight-callout dnav-session-insight-callout"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">{sessionActionOutput.callout}</p>
                      <p className="text-[11px] text-muted-foreground">{sessionDirective}</p>
                    </div>
                    <div className="flex flex-col gap-2 text-[11px] text-muted-foreground md:max-w-[220px] md:items-end md:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Next step</p>
                      <p>Review 10–20 decisions live and tune the variables.</p>
                      <Button asChild size="sm" className="h-8 px-3 text-[11px]">
                        <Link href="/contact">Book a Decision Review</Link>
                      </Button>
                    </div>
                  </div>
                </Callout>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Decisions", value: decisionCount.toString() },
                    { label: "D-NAV", value: sessionStats.avgDnav.toFixed(1) },
                    { label: "Return", value: sessionStats.avgReturn.toFixed(1) },
                    { label: "Pressure", value: sessionStats.avgPressure.toFixed(1) },
                    { label: "Stability", value: sessionStats.avgStability.toFixed(1) },
                  ].map((pill) => (
                    <div
                      key={pill.label}
                      className="flex h-9 w-full items-center justify-between gap-3 rounded-full border border-border/40 bg-muted/10 px-3 text-[11px] sm:w-auto"
                    >
                      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{pill.label}</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">{pill.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Decision posture distribution (this is what repeats when stakes rise)
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-1.5">
                    <MetricDistribution metricLabel="Return distribution" segments={sessionDistributions.returnSegments} />
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-1.5">
                    <MetricDistribution
                      metricLabel="Pressure distribution"
                      segments={sessionDistributions.pressureSegments}
                    />
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-1.5">
                    <MetricDistribution
                      metricLabel="Stability distribution"
                      segments={sessionDistributions.stabilitySegments}
                    />
                  </div>
                </div>
                <a
                  href="/mockups/John-Smith%27s-Company.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block rounded-md text-left transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:-translate-y-0.5 focus-visible:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="text-sm font-semibold text-foreground">Download Sample Decision Brief →</div>
                  <p className="text-[11px] text-muted-foreground">
                    A real pre-commitment consulting deliverable (PDF).
                  </p>
                </a>
                <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">WANT TO GO DEEPER?</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Live decisions tell the truth. In guided sessions, teams use D-NAV to surface blind spots before
                    outcomes create hindsight bias.
                  </p>
                  <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0 text-[11px]">
                    <Link href="/scenarios">Explore Scenarios →</Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {process.env.NODE_ENV === "development" ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Tooltip demo: <Term termKey="impact" /> · <Term termKey="cost" /> · <Term termKey="risk" /> ·{" "}
                <Term termKey="urgency" /> · <Term termKey="confidence" /> · <Term termKey="return" /> ·{" "}
                <Term termKey="pressure" /> · <Term termKey="stability" /> · <Term termKey="dnav">D-NAV</Term>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </TooltipProvider>
  );
}
