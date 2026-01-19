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
  excerpt: string;
  chunkId: string;
}

export interface TimingNormalized {
  precision: TimingPrecision;
  [key: string]: unknown;
}

export interface DecisionCandidate {
  id: string;
  decisionTitle: string;
  decisionStatement: string;
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
}
