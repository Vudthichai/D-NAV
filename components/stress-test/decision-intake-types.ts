export interface UploadedDoc {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: number;
  pages: Array<{ pageNumber: number; text: string }>;
}

export interface SourceRef {
  docId: string;
  docName: string;
  pageNumber?: number | null;
  excerpt: string;
}

export const DECISION_DOMAINS = [
  "Strategy",
  "Capital",
  "Ops",
  "Product",
  "People",
  "Risk",
  "Real Estate",
  "Other",
  "Uncategorized",
] as const;

export type DecisionDomain = (typeof DECISION_DOMAINS)[number];

export interface ExtractedDecisionCandidate {
  id: string;
  docId: string;
  docName: string;
  page?: number | null;
  excerpt: string;
  decisionText: string;
  keep: boolean;
  domain: DecisionDomain;
  scores: {
    impact: number;
    cost: number;
    risk: number;
    urgency: number;
    confidence: number;
  };
  createdAt: string;
}
