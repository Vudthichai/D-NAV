export type DecisionCandidate = {
  id: string;
  decision: string;
  evidence: string;
  sources: DecisionSource[];
  extractConfidence: number;
  qualityScore: number;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
  imported?: boolean;
};

export type DecisionSource = {
  fileName?: string;
  pageNumber?: number;
  excerpt: string;
};
