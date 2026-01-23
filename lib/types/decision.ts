export type DecisionCandidate = {
  id: string;
  decision: string;
  evidence: string;
  source?: string;
  extractConfidence: number;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
  keep: boolean;
};
