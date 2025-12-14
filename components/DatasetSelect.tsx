"use client";

import { useMemo, type ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type DatasetId } from "@/types/dataset";
import { useDataset } from "./DatasetProvider";

interface DatasetSelectProps {
  label?: string;
  side?: "left" | "right";
}

export function DatasetSelect({ label, side }: DatasetSelectProps): ReactElement {
  const { datasets, activeDatasetId, setActiveDatasetId } = useDataset();

  const options = useMemo(
    () =>
      datasets.map((dataset) => ({
        value: dataset.id,
        label: dataset.label,
      })),
    [datasets],
  );

  return (
    <div className="flex items-center gap-2">
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      ) : null}
      <Select value={activeDatasetId ?? undefined} onValueChange={(value) => setActiveDatasetId(value as DatasetId)}>
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
