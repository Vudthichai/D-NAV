export type DecisionModality = "WILL" | "PLAN" | "EXPECT" | "TARGET" | "MAY";
export type DecisionTriage = "KEEP" | "MAYBE" | "DROP";

export type DecisionEvidenceAnchor = {
  file: string;
  page: number;
  snippet: string;
  span_start?: number;
  span_end?: number;
};

export type ConstraintTimeNormalized =
  | { type: "date"; value: string }
  | { type: "quarter"; year: number; quarter: 1 | 2 | 3 | 4 }
  | { type: "half"; year: number; half: 1 | 2 }
  | { type: "fiscalYear"; year: number }
  | { type: "year"; year: number }
  | { type: "relative"; label: string };

export type ConstraintTime = {
  raw: string;
  normalized: ConstraintTimeNormalized | null;
};

export type DecisionObject = {
  id: string;
  canonical_text: string;
  actor: string;
  action: string;
  object: string;
  constraint_time: ConstraintTime | null;
  constraint_location: string | null;
  modality: DecisionModality;
  confidence_of_extraction: number;
  triage: DecisionTriage;
  triage_reason: string;
  evidence_anchors: DecisionEvidenceAnchor[];
};
