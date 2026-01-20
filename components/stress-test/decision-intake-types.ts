import type { TimingPrecision } from "@/utils/timingPrecision";

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
  keep: boolean;
  tableNoise?: boolean;
  duplicateOf?: string;
}
