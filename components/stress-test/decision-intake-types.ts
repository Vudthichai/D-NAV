import type { TimingPrecision } from "@/utils/timingPrecision";
import type { DecisionObject, DecisionTriage } from "@/types/decisionCompiler";

export interface UploadedDoc {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: number;
  pages: Array<{ pageNumber: number; text: string }>;
}

export interface EvidenceRef {
  docId: string;
  docName: string;
  pageNumber?: number | null;
  rawExcerpt: string;
  contextText?: string;
  chunkId: string;
}

export type EvidenceAnchor = {
  docId: string;
  fileName: string;
  page: number;
  excerpt: string;
  charStart?: number;
  charEnd?: number;
};

export type RawCandidate = {
  id: string;
  docId: string;
  page: number;
  rawText: string;
  contextText?: string;
  sectionHint?: string;
  knowsItIsTableNoise: boolean;
  extractionScore: number;
  dateMentions: string[];
  evidence: EvidenceAnchor[];
};

export type DecisionGateBin = "Decision" | "MaybeDecision" | "EvidenceOnly" | "Rejected";

export type ConstraintSignals = {
  time: number;
  capital: number;
  exposure: number;
  dependency: number;
  reversalCost: number;
  dateMentions: string[];
};

export type DecisionQualityGate = {
  bin: DecisionGateBin;
  optionalityScore: number;
  commitmentVerb: string | null;
  commitmentStrength: number;
  constraintSignals: ConstraintSignals;
  reasonsIncluded: string[];
  reasonsExcluded: string[];
  triage?: DecisionTriage;
  triageReason?: string;
};

export type CanonicalDecision = {
  id: string;
  docId: string;
  title: string;
  decision: DecisionObject;
  titleStatus?: "Ok" | "NeedsRewrite";
  timeHintRaw?: string | null;
  timingNormalized?: TimingNormalized;
  gate?: DecisionQualityGate;
  summary?: string;
  domain?: string;
  date?: {
    raw?: string;
    normalized?: string;
    confidence: number;
  };
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
  evidence: EvidenceAnchor[];
  sources: {
    candidateIds: string[];
    mergeConfidence: number;
    mergeReason: string[];
    suggestedMergeIds?: string[];
  };
  tags?: string[];
};

export type SourceCandidate = {
  id: string;
  docId: string;
  fileName: string;
  page: number;
  rawText: string;
  contextText?: string;
  extractionScore: number;
  dateMentions: string[];
};

export interface TimingNormalized {
  precision: TimingPrecision;
  [key: string]: unknown;
}

export interface DecisionCandidate {
  id: string;
  decisionTitle: string;
  decisionDetail: string;
  rawText?: string;
  contextText?: string;
  sectionHint?: string;
  extractionScore?: number;
  dateMentions?: string[];
  bin?: DecisionGateBin;
  gate?: DecisionQualityGate;
  titleStatus?: "Ok" | "NeedsRewrite";
  category: string;
  scores: {
    impact?: number;
    cost?: number;
    risk?: number;
    urgency?: number;
    confidence?: number;
  };
  timeAnchor?: {
    raw: string;
    type: "ExactDate" | "Quarter" | "FiscalYear" | "Dependency";
    verified: "Explicit" | "Unverified";
  };
  timingNormalized?: TimingNormalized;
  evidence: EvidenceRef;
  evidenceAnchors?: EvidenceAnchor[];
  sources?: CanonicalDecision["sources"];
  sourceCandidates?: SourceCandidate[];
  keep: boolean;
  tableNoise?: boolean;
  duplicateOf?: string;
}

export type DecisionGateDiagnostics = {
  total: number;
  byBin: Record<DecisionGateBin, number>;
  candidates: Array<{
    id: string;
    rawText: string;
    bin: DecisionGateBin;
    optionalityScore: number;
    reasonsIncluded: string[];
    reasonsExcluded: string[];
  }>;
  evidenceOnlySamples: Array<{
    id: string;
    rawText: string;
    reasonsExcluded: string[];
  }>;
};
