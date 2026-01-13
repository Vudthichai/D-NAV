"use client";

import SliderRow from "@/components/SliderRow";
import SummaryCard from "@/components/SummaryCard";
import { useDataset } from "@/components/DatasetProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle, GlassCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Term from "@/components/ui/Term";
import {
  DecisionEntry,
  DecisionMetrics,
  DecisionVariables,
  computeMetrics,
  detectJudgmentSignal,
  getArchetype,
} from "@/lib/calculations";
import { Check, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNetlifyIdentity } from "@/hooks/use-netlify-identity";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

const DEFAULT_VARIABLES: DecisionVariables = {
  impact: 1,
  cost: 1,
  risk: 1,
  urgency: 1,
  confidence: 1,
};

export interface StressTestCalculatorHandle {
  selectDecision: (decision: { name: string; category: string }) => void;
  resetSavedState: () => void;
}

export interface StressTestDecisionSnapshot extends DecisionVariables, DecisionMetrics {
  id: string;
  name: string;
  category: string;
  archetype: string;
  createdAt: number;
}

interface StressTestCalculatorProps {
  saveLabel?: string;
  requireLoginForSave?: boolean;
  onSaveDecision?: (decision: StressTestDecisionSnapshot) => void;
}

const StressTestCalculator = forwardRef<StressTestCalculatorHandle, StressTestCalculatorProps>(
  ({ saveLabel = "Log this decision", requireLoginForSave = false, onSaveDecision }, ref) => {
    const [decisionName, setDecisionName] = useState("");
    const [decisionCategory, setDecisionCategory] = useState("");
    const [variables, setVariables] = useState<DecisionVariables>(() => ({ ...DEFAULT_VARIABLES }));
    const [metrics, setMetrics] = useState<DecisionMetrics>(() => computeMetrics(DEFAULT_VARIABLES));
    const [isSaved, setIsSaved] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const decisionNameRef = useRef<HTMLInputElement>(null);
    const decisionCategoryRef = useRef<HTMLInputElement>(null);
    const decisionFrameRef = useRef<HTMLDivElement>(null);
    const { setDecisions } = useDataset();
    const { isLoggedIn, openLogin } = useNetlifyIdentity();

    const updateVariable = useCallback((key: keyof DecisionVariables, value: number) => {
      setVariables((prev) => {
        const updated = { ...prev, [key]: value };
        setMetrics(computeMetrics(updated));
        return updated;
      });
      setIsSaved(false);
    }, []);

    const handleSaveDecision = useCallback(() => {
      if (requireLoginForSave && !isLoggedIn) {
        setShowLoginPrompt(true);
        return;
      }

      if (!decisionName.trim()) {
        decisionNameRef.current?.focus();
        alert("Please enter both a decision name and category before saving.");
        return;
      }

      if (!decisionCategory.trim()) {
        decisionCategoryRef.current?.focus();
        alert("Please enter both a decision name and category before saving.");
        return;
      }

      const decisionEntry: DecisionEntry = {
        ...variables,
        ...metrics,
        ts: Date.now(),
        name: decisionName.trim(),
        category: decisionCategory.trim(),
      };

      if (onSaveDecision) {
        const createdAt = Date.now();
        const archetype = getArchetype(metrics);
        onSaveDecision({
          id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt,
          name: decisionEntry.name,
          category: decisionEntry.category,
          archetype: archetype.name,
          ...variables,
          ...metrics,
        });
      } else {
        setDecisions((prev) => [decisionEntry, ...prev]);
      }
      setIsSaved(true);

      setTimeout(() => setIsSaved(false), 3000);
    }, [
      decisionCategory,
      decisionName,
      isLoggedIn,
      metrics,
      onSaveDecision,
      requireLoginForSave,
      setDecisions,
      variables,
    ]);

    const handleReset = () => {
      setDecisionName("");
      setDecisionCategory("");
      setVariables({ ...DEFAULT_VARIABLES });
      setMetrics(computeMetrics(DEFAULT_VARIABLES));
      setIsSaved(false);
    };

    const judgmentSignal = useMemo(() => detectJudgmentSignal(variables, metrics), [metrics, variables]);

    const getPillColor = useCallback(
      (value: number, type: "return" | "stability" | "pressure") => {
        if (type === "pressure") {
          if (value > 0) return { text: "Pressured", color: "red" as const };
          if (value < 0) return { text: "Calm", color: "green" as const };
          return { text: "Balanced", color: "amber" as const };
        }

        if (value > 0) {
          return { text: type === "return" ? "Positive" : "Stable", color: "green" as const };
        }
        if (value < 0) {
          return { text: type === "return" ? "Negative" : "Fragile", color: "red" as const };
        }
        return { text: type === "return" ? "Neutral" : "Uncertain", color: "amber" as const };
      },
      [],
    );

    const pillVariants: Record<"green" | "amber" | "red" | "blue", string> = {
      green: "bg-green-500/18 text-green-400 border-green-500/40",
      amber: "bg-amber-500/18 text-amber-400 border-amber-500/35",
      red: "bg-red-500/18 text-red-400 border-red-500/40",
      blue: "bg-blue-500/18 text-blue-400 border-blue-500/35",
    };

    const formatStatValue = useCallback((value: number) => {
      if (value > 0) return `+${value}`;
      if (value < 0) return value.toString();
      return "0";
    }, []);

    useImperativeHandle(ref, () => ({
      selectDecision: (decision) => {
        setDecisionName(decision.name);
        setDecisionCategory(decision.category);
        setIsSaved(false);
        decisionFrameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        decisionNameRef.current?.focus();
      },
      resetSavedState: () => {
        setIsSaved(false);
      },
    }));

    return (
      <section className="space-y-2">
        <Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Log in to save decisions.</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>Your inputs are safe here, but saving requires a login.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    openLogin();
                    setShowLoginPrompt(false);
                  }}
                  className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                >
                  Log in
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowLoginPrompt(false)}
                  className="h-9 px-4 text-xs"
                >
                  Not now
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <div className="grid grid-cols-1 items-stretch gap-2 lg:auto-rows-fr lg:grid-cols-3">
          <div ref={decisionFrameRef} className="scroll-mt-4">
            <GlassCard className="flex h-full flex-col gap-6 py-6">
              <CardHeader className="space-y-0 px-4 pb-1 pt-3">
                <CardTitle className="text-sm font-semibold">Decision Frame</CardTitle>
                <p className="text-sm text-muted-foreground">Name it and set the five levers.</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2 px-4 pb-2">
                <div className="space-y-2">
                  <div className="grid gap-1 sm:grid-cols-2">
                    <Input
                      ref={decisionNameRef}
                      type="text"
                      placeholder="Decision title"
                      value={decisionName}
                      onChange={(e) => {
                        setDecisionName(e.target.value);
                      }}
                      className="h-8 text-sm"
                    />
                    <Input
                      ref={decisionCategoryRef}
                      type="text"
                      placeholder="Category"
                      value={decisionCategory}
                      onChange={(e) => {
                        setDecisionCategory(e.target.value);
                      }}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Decision variables
                      </span>
                      <Badge variant="outline" className="text-[11px] font-medium">
                        1 = low · 10 = high
                      </Badge>
                    </div>
                    <div className="dnav-glass-panel space-y-0.5 px-2 py-0">
                      <SliderRow
                        id="impact"
                        label={<Term termKey="impact" />}
                        value={variables.impact}
                        onChange={(value) => updateVariable("impact", value)}
                        compact
                      />
                      <SliderRow
                        id="cost"
                        label={<Term termKey="cost" />}
                        value={variables.cost}
                        onChange={(value) => updateVariable("cost", value)}
                        compact
                      />
                      <SliderRow
                        id="risk"
                        label={<Term termKey="risk" />}
                        value={variables.risk}
                        onChange={(value) => updateVariable("risk", value)}
                        compact
                      />
                      <SliderRow
                        id="urgency"
                        label={<Term termKey="urgency" />}
                        value={variables.urgency}
                        onChange={(value) => updateVariable("urgency", value)}
                        compact
                      />
                      <SliderRow
                        id="confidence"
                        label={<Term termKey="confidence" />}
                        value={variables.confidence}
                        onChange={(value) => updateVariable("confidence", value)}
                        compact
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    onClick={handleSaveDecision}
                    variant="secondary"
                    className="h-9 px-4 text-xs font-semibold uppercase tracking-wide"
                  >
                    {isSaved ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {saveLabel}
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" onClick={handleReset} className="h-8 px-3 text-xs">
                    Reset
                  </Button>
                </div>
              </CardContent>
            </GlassCard>
          </div>

          <GlassCard className="flex h-full flex-col gap-4 py-4">
            <CardHeader className="space-y-0 px-4 pb-1 pt-2">
              <CardTitle className="text-sm font-semibold">RPS</CardTitle>
              <p className="text-sm text-muted-foreground">Signals derived from your inputs.</p>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid gap-3">
                <div className="dnav-glass-panel px-2 py-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-2xl font-black text-foreground">{formatStatValue(metrics.return)}</div>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        <Term termKey="return">Return</Term>
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${pillVariants[getPillColor(metrics.return, "return").color]}`}
                    >
                      {getPillColor(metrics.return, "return").text}
                    </Badge>
                  </div>
                </div>
                <div className="dnav-glass-panel px-2 py-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-2xl font-black text-foreground">{formatStatValue(metrics.pressure)}</div>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        <Term termKey="pressure">Pressure</Term>
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${pillVariants[getPillColor(metrics.pressure, "pressure").color]}`}
                    >
                      {getPillColor(metrics.pressure, "pressure").text}
                    </Badge>
                  </div>
                </div>
                <div className="dnav-glass-panel px-2 py-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-2xl font-black text-foreground">{formatStatValue(metrics.stability)}</div>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        <Term termKey="stability">Stability</Term>
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${pillVariants[getPillColor(metrics.stability, "stability").color]}`}
                    >
                      {getPillColor(metrics.stability, "stability").text}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </GlassCard>

          <GlassCard className="flex h-full flex-col gap-6 py-6">
            <CardHeader className="space-y-0 px-4 pb-2 pt-4">
              <CardTitle className="text-sm font-semibold">
                <Term termKey="dnav">D-NAV</Term> Readout
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 px-3 pb-3 pt-1">
              <div className="flex h-full flex-col gap-2">
                <SummaryCard
                  metrics={metrics}
                  judgmentSignal={judgmentSignal}
                  className="flex flex-1"
                  compact
                  showMagnitudeCue={false}
                  showDefinitionLink={false}
                />
              </div>
            </CardContent>
          </GlassCard>
        </div>
      </section>
    );
});

StressTestCalculator.displayName = "StressTestCalculator";

export default StressTestCalculator;
