import { type DatasetId, type DatasetMeta, getEmptyDatasetMeta } from "@/types/dataset";

export interface ReportDatasetMeta extends DatasetMeta {
  id: DatasetId;
  displayLabel: string;
  path: string;
}

export const REPORT_DATASETS = [
  {
    id: "dataset-apple-2020-2025",
    companyName: "Apple",
    periodLabel: "2020–2025",
    displayLabel: "Apple · 2020–2025",
    path: "/data/apple-2020-2025/decisions.json",
    sector: "Consumer Technology",
    stage: "Mature",
    source: "Synthetic demo dataset",
    type: "Public",
  },
] as const satisfies ReportDatasetMeta[];

export function getDatasetMeta(id: DatasetId | null | undefined): ReportDatasetMeta | DatasetMeta {
  if (!id) return getEmptyDatasetMeta();
  const meta = REPORT_DATASETS.find((dataset) => dataset.id === id);
  return meta ?? getEmptyDatasetMeta();
}

export function getDatasetDisplayLabel(index: number): string {
  return `Dataset ${index + 1}`;
}
