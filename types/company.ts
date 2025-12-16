export interface CompanyContext {
  companyName: string;
  timeframeLabel: string;
  ticker?: string;
  type?: "Public" | "Private" | "Startup" | "Non-profit" | "Fund" | "Other";
  sector?: string;
  stage?: "Early" | "Growth" | "Mature" | "Turnaround" | "Other";
  source?: "Public filings" | "Internal decision log" | "Mixed" | string;
  contextNote?: string;
  judgmentUnit?: string;
}

export interface ArchetypeSummaryInput {
  name: string;
  count: number;
  avgR: number;
  avgP: number;
  avgS: number;
  avgDNAV: number;
  topCategories: string[];
}

export interface CategorySummaryInput {
  name: string;
  count: number;
  share: number;
  avgDNAV: number;
}

export interface CompanySummaryInput {
  company: CompanyContext & {
    totalDecisions: number;
    avgReturn: number;
    avgPressure: number;
    avgStability: number;
  };
  topCategories: CategorySummaryInput[];
  archetypes: ArchetypeSummaryInput[];
}

export interface SingleArchetypeSummaryInput {
  company: CompanyContext;
  archetype: ArchetypeSummaryInput;
  sampleTitles: string[];
}

export interface CompanySummaryOutput {
  summary: string;
  strengths: string[];
  vulnerabilities: string[];
}

export interface ArchetypeSummaryOutput {
  title: string;
  summary: string;
  isStrength: boolean;
  notes: string[];
}
