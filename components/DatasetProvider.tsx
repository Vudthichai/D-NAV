"use client";

import { createContext, useContext, useMemo, useState, type ReactElement, type ReactNode } from "react";

import { REPORT_DATASETS, getDatasetMeta, type DatasetId, type ReportDatasetMeta } from "@/lib/reportDatasets";

interface DatasetContextValue {
  datasetId: DatasetId | null;
  setDatasetId: (id: DatasetId | null) => void;
  meta: ReportDatasetMeta;
}

const DatasetContext = createContext<DatasetContextValue | undefined>(undefined);

export function DatasetProvider({ children }: { children: ReactNode }): ReactElement {
  const [datasetId, setDatasetId] = useState<DatasetId | null>(REPORT_DATASETS[0]?.id ?? null);

  const meta = useMemo(() => getDatasetMeta(datasetId), [datasetId]);

  const value = useMemo(() => ({ datasetId, setDatasetId, meta }), [datasetId, meta]);

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset(): DatasetContextValue {
  const ctx = useContext(DatasetContext);
  if (!ctx) {
    throw new Error("useDataset must be used within a DatasetProvider");
  }
  return ctx;
}
