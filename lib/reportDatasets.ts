import { computeMetrics, type DecisionEntry } from "@/lib/calculations";
import { type CompanyContext } from "@/types/company";

export type DatasetId = "apple-2020-2025" | "benchmark-2024-2025";

export interface ReportDatasetMeta {
  id: DatasetId;
  displayLabel: string;
  company: CompanyContext;
  decisions: DecisionEntry[];
}

const dayMs = 24 * 60 * 60 * 1000;
const baseTs = Date.now();

const makeDecision = (
  index: number,
  input: {
    name: string;
    category: string;
    impact: number;
    cost: number;
    risk: number;
    urgency: number;
    confidence: number;
  },
): DecisionEntry => {
  const metrics = computeMetrics(input);
  return {
    ts: baseTs - index * dayMs,
    ...input,
    ...metrics,
  };
};

const appleDecisions: DecisionEntry[] = [
  makeDecision(1, {
    name: "Expand flagship production",
    category: "Operations",
    impact: 9,
    cost: 5,
    risk: 3,
    urgency: 6,
    confidence: 8,
  }),
  makeDecision(2, {
    name: "Launch services bundle",
    category: "Product",
    impact: 8,
    cost: 4,
    risk: 2,
    urgency: 5,
    confidence: 7,
  }),
  makeDecision(3, {
    name: "Enter new device segment",
    category: "Product",
    impact: 9,
    cost: 6,
    risk: 5,
    urgency: 7,
    confidence: 6,
  }),
  makeDecision(4, {
    name: "Optimize supply chain nodes",
    category: "Operations",
    impact: 7,
    cost: 3,
    risk: 3,
    urgency: 4,
    confidence: 8,
  }),
  makeDecision(5, {
    name: "Increase R&D investment",
    category: "Finance",
    impact: 8,
    cost: 5,
    risk: 3,
    urgency: 4,
    confidence: 6,
  }),
  makeDecision(6, {
    name: "Retail footprint refresh",
    category: "Go-To-Market",
    impact: 6,
    cost: 3,
    risk: 2,
    urgency: 5,
    confidence: 7,
  }),
  makeDecision(7, {
    name: "Data center expansion",
    category: "Infrastructure",
    impact: 7,
    cost: 4,
    risk: 3,
    urgency: 6,
    confidence: 7,
  }),
  makeDecision(8, {
    name: "Channel partner incentives",
    category: "Go-To-Market",
    impact: 6,
    cost: 3,
    risk: 2,
    urgency: 4,
    confidence: 6,
  }),
  makeDecision(9, {
    name: "Expand health features",
    category: "Product",
    impact: 7,
    cost: 4,
    risk: 3,
    urgency: 5,
    confidence: 7,
  }),
  makeDecision(10, {
    name: "Reshore key components",
    category: "Operations",
    impact: 7,
    cost: 5,
    risk: 4,
    urgency: 6,
    confidence: 6,
  }),
  makeDecision(11, {
    name: "Energy sourcing shift",
    category: "Infrastructure",
    impact: 6,
    cost: 3,
    risk: 4,
    urgency: 3,
    confidence: 5,
  }),
  makeDecision(12, {
    name: "Platform privacy push",
    category: "Product",
    impact: 8,
    cost: 3,
    risk: 2,
    urgency: 5,
    confidence: 8,
  }),
];

const benchmarkDecisions: DecisionEntry[] = [
  makeDecision(1, {
    name: "Trim capital expenditures",
    category: "Finance",
    impact: 5,
    cost: 4,
    risk: 3,
    urgency: 4,
    confidence: 6,
  }),
  makeDecision(2, {
    name: "Pause experimental launches",
    category: "Product",
    impact: 4,
    cost: 2,
    risk: 2,
    urgency: 3,
    confidence: 7,
  }),
  makeDecision(3, {
    name: "Stabilize fulfillment ops",
    category: "Operations",
    impact: 6,
    cost: 3,
    risk: 3,
    urgency: 5,
    confidence: 6,
  }),
  makeDecision(4, {
    name: "Selective hiring freeze",
    category: "People",
    impact: 5,
    cost: 2,
    risk: 2,
    urgency: 4,
    confidence: 6,
  }),
  makeDecision(5, {
    name: "Contract renegotiations",
    category: "Operations",
    impact: 5,
    cost: 2,
    risk: 2,
    urgency: 6,
    confidence: 6,
  }),
  makeDecision(6, {
    name: "Security hardening sprint",
    category: "Infrastructure",
    impact: 6,
    cost: 3,
    risk: 3,
    urgency: 7,
    confidence: 5,
  }),
  makeDecision(7, {
    name: "Legacy system migration",
    category: "Infrastructure",
    impact: 5,
    cost: 4,
    risk: 4,
    urgency: 6,
    confidence: 5,
  }),
  makeDecision(8, {
    name: "Customer support overhaul",
    category: "Go-To-Market",
    impact: 5,
    cost: 3,
    risk: 3,
    urgency: 5,
    confidence: 6,
  }),
  makeDecision(9, {
    name: "Vendor consolidation",
    category: "Operations",
    impact: 5,
    cost: 3,
    risk: 2,
    urgency: 4,
    confidence: 6,
  }),
  makeDecision(10, {
    name: "Regional exit",
    category: "Go-To-Market",
    impact: 4,
    cost: 3,
    risk: 3,
    urgency: 5,
    confidence: 5,
  }),
  makeDecision(11, {
    name: "Lean experimentation guardrails",
    category: "Product",
    impact: 4,
    cost: 2,
    risk: 2,
    urgency: 4,
    confidence: 7,
  }),
  makeDecision(12, {
    name: "Data hygiene mandate",
    category: "Infrastructure",
    impact: 5,
    cost: 2,
    risk: 3,
    urgency: 4,
    confidence: 6,
  }),
];

export const REPORT_DATASETS: ReportDatasetMeta[] = [
  {
    id: "apple-2020-2025",
    displayLabel: "Apple · 2020–2025",
    company: {
      companyName: "Apple",
      timeframeLabel: "2020–2025",
      sector: "Consumer Technology",
      stage: "Mature",
      source: "Synthetic demo dataset",
    },
    decisions: appleDecisions,
  },
  {
    id: "benchmark-2024-2025",
    displayLabel: "Benchmark · 2024–2025",
    company: {
      companyName: "Benchmark Co.",
      timeframeLabel: "2024–2025",
      sector: "Enterprise Software",
      stage: "Growth",
      source: "Synthetic demo dataset",
    },
    decisions: benchmarkDecisions,
  },
];

export function getDatasetMeta(id: DatasetId): ReportDatasetMeta {
  const meta = REPORT_DATASETS.find((dataset) => dataset.id === id);
  return meta ?? REPORT_DATASETS[0];
}
