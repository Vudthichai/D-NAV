"use client";

import { useCallback, useMemo, type ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDatasetDisplayName } from "@/lib/datasetDisplay";
import { cn } from "@/lib/utils";
import { type DatasetId } from "@/types/dataset";
import { useDataset } from "./DatasetProvider";

interface DatasetSelectProps {
  label?: string;
  side?: "left" | "right";
  allowRemove?: boolean;
  triggerSize?: "sm" | "default";
  triggerClassName?: string;
  labelClassName?: string;
  containerClassName?: string;
}

export function DatasetSelect({
  label,
  side,
  allowRemove = true,
  triggerSize = "default",
  triggerClassName,
  labelClassName,
  containerClassName,
}: DatasetSelectProps): ReactElement {
  const { datasets, activeDatasetId, activeDataset, setActiveDatasetId, deleteDataset } = useDataset();

  const options = useMemo(
    () =>
      datasets.map((dataset) => ({
        value: dataset.id,
        label: getDatasetDisplayName(dataset),
      })),
    [datasets],
  );

  const canRemoveDataset = allowRemove && datasets.length > 1 && Boolean(activeDatasetId);

  const handleRemoveDataset = useCallback(() => {
    if (!canRemoveDataset || !activeDatasetId || !activeDataset) return;

    if (activeDataset.decisions.length > 0) {
      const confirmed = confirm("Delete this dataset and all of its decisions? This action cannot be undone.");
      if (!confirmed) return;
    }

    deleteDataset(activeDatasetId);
  }, [activeDataset, activeDatasetId, canRemoveDataset, deleteDataset]);

  const handleChange = useCallback(
    (value: string) => {
      if (value === "__remove") {
        handleRemoveDataset();
        return;
      }

      setActiveDatasetId(value as DatasetId);
    },
    [handleRemoveDataset, setActiveDatasetId],
  );

  return (
    <div className={cn("flex items-center gap-2", containerClassName)}>
      {label ? (
        <span className={cn("text-xs font-semibold uppercase tracking-wide text-muted-foreground", labelClassName)}>
          {label}
        </span>
      ) : null}
      <Select value={activeDatasetId ?? undefined} onValueChange={handleChange}>
        <SelectTrigger className={cn("min-w-[220px]", triggerClassName)} size={triggerSize} data-side={side}>
          <SelectValue placeholder="Select dataset" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
          {canRemoveDataset ? (
            <SelectItem value="__remove" className="text-destructive">
              Remove dataset
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}

export default DatasetSelect;
