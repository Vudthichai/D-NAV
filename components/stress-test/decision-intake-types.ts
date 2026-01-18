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
  timeAnchor?: {
    raw: string;
    type: "ExactDate" | "Quarter" | "FiscalYear" | "Dependency";
    verified: "Explicit" | "Unverified";
  };
  source: SourceRef;
  keep: boolean;
}
