export interface UploadedDoc {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: number;
  pages: Array<{ pageNumber: number; text: string }>;
}

export interface SourceRef {
  docId: string;
  fileName: string;
  pageNumber: number;
  excerpt: string;
  chunkId: string;
}

export interface DecisionCandidate {
  id: string;
  decisionText: string;
  category: string;
  scores: {
    impact?: number;
    cost?: number;
    risk?: number;
    urgency?: number;
    confidence?: number;
  };
  candidateScore: number;
  isMetric: boolean;
  hasCommitment: boolean;
  hasConstraint: boolean;
  hasExposure: boolean;
  hasTimeAnchor: boolean;
  timeAnchor?: {
    raw: string;
    type: "ExactDate" | "Quarter" | "FiscalYear" | "HalfYear" | "Dependency";
    verified: "Explicit" | "Unverified";
  };
  source: SourceRef;
  keep: boolean;
}
