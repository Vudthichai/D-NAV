import { type CompanyContext } from "@/types/company";

export type DatasetId = (typeof REPORT_DATASETS)[number]["id"];

export interface ReportDatasetMeta {
  id: string;
  companyName: string;
  periodLabel: string;
  displayLabel: string;
  path: string;
  company: CompanyContext;
}

export const REPORT_DATASETS = [
  {
    id: "apple-2020-2025",
    companyName: "Apple",
    periodLabel: "2020–2025",
    displayLabel: "Apple · 2020–2025",
    path: "/data/apple-2020-2025/decisions.json",
    company: {
      companyName: "Apple",
      timeframeLabel: "2020–2025",
      sector: "Consumer Technology",
      stage: "Mature",
      source: "Synthetic demo dataset",
    },
  },
  {
    id: "benchmark-2024-2025",
    companyName: "Benchmark Co.",
    periodLabel: "2024–2025",
    displayLabel: "Benchmark · 2024–2025",
    path: "/data/benchmark-2024-2025/decisions.json",
    company: {
      companyName: "Benchmark Co.",
      timeframeLabel: "2024–2025",
      sector: "Enterprise Software",
      stage: "Growth",
      source: "Synthetic demo dataset",
    },
  },
] as const satisfies ReportDatasetMeta[];

export function getDatasetMeta(id: DatasetId): ReportDatasetMeta {
  const meta = REPORT_DATASETS.find((dataset) => dataset.id === id);
  return meta ?? REPORT_DATASETS[0];
}
