import type { DecisionCandidate } from "./decisionExtractLocal";
import { computeRpsDnav } from "./decisionMetrics";

export interface SessionDecision {
  id: string;
  decisionTitle: string;
  decisionDetail?: string;
  category: string;
  categoryGuess?: string;
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
  sourceCandidateId?: string;
  createdAt: number;
}

export const getSessionDecisionId = (candidateId: string) => `extract-${candidateId}`;

const cleanDecisionText = (value: string) =>
  value.replace(/^(?:the\s+)?company\s+commits?\s+to\s+/i, "").trim();

export const getCandidateIdFromSessionDecision = (decision: SessionDecision): string | null => {
  if (decision.sourceCandidateId) return decision.sourceCandidateId;
  if (decision.id.startsWith("extract-")) {
    return decision.id.replace(/^extract-/, "");
  }
  return null;
};

export const buildSessionDecisionFromCandidate = (
  candidate: DecisionCandidate,
  sourceFileName?: string,
  existing?: SessionDecision,
): SessionDecision => {
  const title = candidate.title.trim() || existing?.decisionTitle || "Untitled decision";
  const metrics = computeRpsDnav(candidate.sliders);
  const normalizedCategory = candidate.category?.trim() || existing?.category || "Uncategorized";
  const categoryGuess = candidate.categoryGuess ?? candidate.category ?? existing?.categoryGuess;
  return {
    id: existing?.id ?? getSessionDecisionId(candidate.id),
    decisionTitle: title,
    decisionDetail: cleanDecisionText(candidate.decision),
    category: normalizedCategory,
    categoryGuess,
    impact: candidate.sliders.impact,
    cost: candidate.sliders.cost,
    risk: candidate.sliders.risk,
    urgency: candidate.sliders.urgency,
    confidence: candidate.sliders.confidence,
    r: metrics.r,
    p: metrics.p,
    s: metrics.s,
    dnav: metrics.dnav,
    sourceFile: sourceFileName ?? existing?.sourceFile,
    sourcePage: candidate.evidence.page || existing?.sourcePage,
    excerpt: candidate.evidence.quote || existing?.excerpt,
    sourceType: existing?.sourceType ?? "intake",
    sourceCandidateId: candidate.id,
    createdAt: existing?.createdAt ?? Date.now(),
  };
};

export const syncSessionDecisionsFromCandidate = (
  decisions: SessionDecision[],
  candidate: DecisionCandidate,
  sourceFileName?: string,
): SessionDecision[] => {
  const matchId = getSessionDecisionId(candidate.id);
  let updated = false;
  const next = decisions.map((decision) => {
    if (decision.id !== matchId && decision.sourceCandidateId !== candidate.id) return decision;
    updated = true;
    return buildSessionDecisionFromCandidate(candidate, sourceFileName, decision);
  });
  return updated ? next : decisions;
};
