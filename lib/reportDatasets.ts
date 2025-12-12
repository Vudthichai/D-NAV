import { type DatasetId, type ReportDatasetMeta } from "@/types/dataset";

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
] as const satisfies ReportDatasetMeta[];

const EMPTY_DATASET_META: ReportDatasetMeta = {
  id: "",
  companyName: "",
  periodLabel: "",
  displayLabel: "",
  path: "",
  company: {
    companyName: "",
    timeframeLabel: "",
    source: undefined,
  },
};

export function getDatasetMeta(id: DatasetId | null | undefined): ReportDatasetMeta {
  if (!id) return EMPTY_DATASET_META;
  const meta = REPORT_DATASETS.find((dataset) => dataset.id === id);
  return meta ?? EMPTY_DATASET_META;
}

export function getDatasetDisplayLabel(index: number): string {
  return `Dataset ${index + 1}`;
}

export function getEmptyDatasetMeta(): ReportDatasetMeta {
  return EMPTY_DATASET_META;
}
