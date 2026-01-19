import type { TimingPrecision } from "@/utils/timingPrecision";

export interface UploadedDoc {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: number;
  pages: Array<{ pageNumber: number; text: string }>;
}

export enum IntakeFileStatus {
  Idle = "idle",
  Uploaded = "uploaded",
  Extracting = "extracting",
  Extracted = "extracted",
}

export enum DecisionDomain {
  Strategy = "Strategy",
  Capital = "Capital",
  Ops = "Ops",
  Product = "Product",
  People = "People",
  Risk = "Risk",
  RealEstate = "Real Estate",
  Other = "Other",
  Uncategorized = "Uncategorized",
}

export interface SourceRef {
  docId: string;
  docName: string;
  page?: number | null;
  excerpt: string;
  chunkId: string;
}

export interface TimingNormalized {
  start?: string;
  end?: string;
  precision: TimingPrecision;
}

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
  timingNormalized?: TimingNormalized;
  createdAt: string;
}
