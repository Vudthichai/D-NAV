import { computeMetrics } from "@/src/lib/dnav/compute";
import type { DecisionCandidate } from "@/lib/intake/decisionExtractLocal";

export interface SessionDecision {
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
  sourceFile?: string;
  sourcePage?: number;
  excerpt?: string;
  sourceType?: "manual" | "intake";
  createdAt: number;
}

export type DecisionSessionState = {
  extractedDecisions: DecisionCandidate[];
  sessionDecisions: SessionDecision[];
};

export type DecisionCandidatePatch = Partial<Omit<DecisionCandidate, "sliders">> & {
  sliders?: Partial<DecisionCandidate["sliders"]>;
};

export type SessionDecisionPatch = Partial<
  Pick<SessionDecision, "decisionTitle" | "category" | "impact" | "cost" | "risk" | "urgency" | "confidence">
>;

const clamp = (value: number) => Math.max(1, Math.min(10, value));

export const buildSessionDecisionFromCandidate = (
  candidate: DecisionCandidate,
  sourceFileName?: string,
  createdAt: number = Date.now(),
): SessionDecision => {
  const vars = {
    impact: clamp(candidate.sliders.impact),
    cost: clamp(candidate.sliders.cost),
    risk: clamp(candidate.sliders.risk),
    urgency: clamp(candidate.sliders.urgency),
    confidence: clamp(candidate.sliders.confidence),
  };
  const metrics = computeMetrics(vars);

  return {
    id: `extract-${candidate.id}`,
    decisionTitle: candidate.decision,
    decisionDetail: candidate.decision,
    category: candidate.category || "Strategy",
    impact: vars.impact,
    cost: vars.cost,
    risk: vars.risk,
    urgency: vars.urgency,
    confidence: vars.confidence,
    r: metrics.return,
    p: metrics.pressure,
    s: metrics.stability,
    dnav: metrics.dnav,
    sourceFile: sourceFileName ?? undefined,
    sourcePage: candidate.evidence.page || undefined,
    excerpt: candidate.evidence.quote || undefined,
    sourceType: "intake",
    createdAt,
  };
};

const applyCandidateToSessionDecision = (decision: SessionDecision, candidate: DecisionCandidate): SessionDecision => {
  const vars = {
    impact: clamp(candidate.sliders.impact),
    cost: clamp(candidate.sliders.cost),
    risk: clamp(candidate.sliders.risk),
    urgency: clamp(candidate.sliders.urgency),
    confidence: clamp(candidate.sliders.confidence),
  };
  const metrics = computeMetrics(vars);

  return {
    ...decision,
    decisionTitle: candidate.decision,
    decisionDetail: candidate.decision,
    category: candidate.category || decision.category,
    impact: vars.impact,
    cost: vars.cost,
    risk: vars.risk,
    urgency: vars.urgency,
    confidence: vars.confidence,
    r: metrics.return,
    p: metrics.pressure,
    s: metrics.stability,
    dnav: metrics.dnav,
  };
};

export const updateDecisionInState = (
  state: DecisionSessionState,
  decisionId: string,
  patch: DecisionCandidatePatch,
): DecisionSessionState => {
  let updatedCandidate: DecisionCandidate | null = null;
  const extractedDecisions = state.extractedDecisions.map((candidate) => {
    if (candidate.id !== decisionId) return candidate;
    const next = {
      ...candidate,
      ...patch,
      sliders: patch.sliders ? { ...candidate.sliders, ...patch.sliders } : candidate.sliders,
    };
    updatedCandidate = next;
    return next;
  });

  if (!updatedCandidate) return state;

  const sessionId = `extract-${updatedCandidate.id}`;
  const sessionDecisions = state.sessionDecisions.map((decision) =>
    decision.id === sessionId ? applyCandidateToSessionDecision(decision, updatedCandidate) : decision,
  );

  return { extractedDecisions, sessionDecisions };
};

export const updateSessionDecisionInState = (
  state: DecisionSessionState,
  decisionId: string,
  patch: SessionDecisionPatch,
): DecisionSessionState => {
  const sessionDecisions = state.sessionDecisions.map((decision) => {
    if (decision.id !== decisionId) return decision;
    const next = {
      ...decision,
      decisionTitle: patch.decisionTitle ?? decision.decisionTitle,
      category: patch.category ?? decision.category,
      impact: patch.impact ?? decision.impact,
      cost: patch.cost ?? decision.cost,
      risk: patch.risk ?? decision.risk,
      urgency: patch.urgency ?? decision.urgency,
      confidence: patch.confidence ?? decision.confidence,
    };
    const metrics = computeMetrics({
      impact: clamp(next.impact),
      cost: clamp(next.cost),
      risk: clamp(next.risk),
      urgency: clamp(next.urgency),
      confidence: clamp(next.confidence),
    });
    return {
      ...next,
      r: metrics.return,
      p: metrics.pressure,
      s: metrics.stability,
      dnav: metrics.dnav,
    };
  });

  return { ...state, sessionDecisions };
};
