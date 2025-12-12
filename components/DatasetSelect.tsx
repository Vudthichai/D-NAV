"use client";

import { useMemo, type ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDatasetDisplayLabel } from "@/lib/reportDatasets";
import { type DatasetId } from "@/types/dataset";
import { useDataset } from "./DatasetProvider";

interface DatasetSelectProps {
  label?: string;
  side?: "left" | "right";
}

export function DatasetSelect({ label, side }: DatasetSelectProps): ReactElement {
  const { datasets, datasetId, setDatasetId } = useDataset();

  const options = useMemo(
    () =>
      datasets.map((dataset, index) => ({
        value: dataset.id,
        label: getDatasetDisplayLabel(index),
      })),
    [datasets],
  );

  return (
    <div className="flex items-center gap-2">
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      ) : null}
      <Select value={datasetId ?? undefined} onValueChange={(value) => setDatasetId(value as DatasetId)}>
        <SelectTrigger className="min-w-[220px]" data-side={side}>
          <SelectValue placeholder="Select dataset" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default DatasetSelect;
