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
  fileName: string;
  pageNumber?: number | null;
  excerpt: string;
  rawText?: string;
  chunkId: string;
}

export interface TimingNormalized {
  start?: string;
  end?: string;
  precision?: TimingPrecision;
  [key: string]: unknown;
}

export interface DecisionCandidate {
  id: string;
  title: string;
  detail?: string;
  source: EvidenceRef;
  flags: {
    likelyTableNoise: boolean;
    lowSignal: boolean;
    duplicateOf?: string;
  };
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
  keep: boolean;
}
