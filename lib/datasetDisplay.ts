import { type DatasetState } from "@/types/dataset";

export function getDatasetDisplayName(dataset: DatasetState): string {
  const companyName = dataset.meta.companyName?.trim();
  const periodLabel = (dataset.meta.periodLabel || dataset.meta.displayLabel)?.trim();
  const baseLabel = dataset.label?.trim() || "Dataset";

  if (companyName && periodLabel) {
    return `${companyName} · ${periodLabel}`;
  }

  if (companyName) {
    return companyName;
  }

  if (periodLabel) {
    return periodLabel;
  }

  return baseLabel;
}
