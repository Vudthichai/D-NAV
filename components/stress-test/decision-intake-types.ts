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
  decisionSummary: string;
  decisionText: string;
  category: string;
  scores: {
    impact?: number;
    cost?: number;
    risk?: number;
    urgency?: number;
    confidence?: number;
  };
  timingText: string | null;
  timingNormalized?: {
    start?: string;
    end?: string;
    precision: "day" | "month" | "quarter" | "year" | "relative" | "unknown";
  };
  source: SourceRef;
  keep: boolean;
}
