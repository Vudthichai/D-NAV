"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { getEmptyDatasetMeta, REPORT_DATASETS } from "@/lib/reportDatasets";
import { computeMetrics, type DecisionEntry } from "@/lib/calculations";
import { type DatasetId, type DatasetState, type ReportDatasetMeta } from "@/types/dataset";

interface DatasetContextValue {
  datasets: DatasetState[];
  datasetId: DatasetId | null;
  setDatasetId: (id: DatasetId | null) => void;
  meta: ReportDatasetMeta;
  decisions: DecisionEntry[];
  setDecisions: (entries: DecisionEntry[]) => void;
  setDecisionsForDataset: (id: DatasetId, entries: DecisionEntry[]) => void;
  addDataset: () => DatasetId;
  getDatasetById: (id: DatasetId | null) => DatasetState | undefined;
  isDatasetLoading: boolean;
  loadError: string | null;
}

interface StoredDatasetState {
  datasets: DatasetState[];
  activeDatasetId: DatasetId | null;
}

const STORAGE_KEY = "dnav_datasets_state_v1";

const hydrateDecision = (decision: {
  ts: number;
  name: string;
  category: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
}): DecisionEntry => {
  const metrics = computeMetrics({
    impact: decision.impact,
    cost: decision.cost,
    risk: decision.risk,
    urgency: decision.urgency,
    confidence: decision.confidence,
  });

  return { ...decision, ...metrics };
};

function loadStoredState(): StoredDatasetState {
  if (typeof window === "undefined") {
    const seedMeta = REPORT_DATASETS[0];
    const initialDataset: DatasetState | undefined = seedMeta
      ? { id: "dataset-1", meta: { ...seedMeta, id: "dataset-1" }, decisions: [] }
      : undefined;

    return {
      datasets: initialDataset ? [initialDataset] : [],
      activeDatasetId: initialDataset?.id ?? null,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredDatasetState;
      return parsed;
    }
  } catch (error) {
    console.error("Failed to load dataset state", error);
  }

  const seedMeta = REPORT_DATASETS[0];
  const initialDataset: DatasetState | undefined = seedMeta
    ? { id: "dataset-1", meta: { ...seedMeta, id: "dataset-1" }, decisions: [] }
    : undefined;

  return {
    datasets: initialDataset ? [initialDataset] : [],
    activeDatasetId: initialDataset?.id ?? null,
  };
}

const DatasetContext = createContext<DatasetContextValue | undefined>(undefined);

export function DatasetProvider({ children }: { children: ReactNode }): ReactElement {
  const [datasets, setDatasets] = useState<DatasetState[]>(() => loadStoredState().datasets);
  const [datasetId, setDatasetId] = useState<DatasetId | null>(() => loadStoredState().activeDatasetId);
  const [loadingMap, setLoadingMap] = useState<Record<DatasetId, boolean>>({});
  const [loadErrors, setLoadErrors] = useState<Record<DatasetId, string | null>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const state: StoredDatasetState = { datasets, activeDatasetId: datasetId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [datasetId, datasets]);

  const setDecisionsForDataset = useCallback((id: DatasetId, entries: DecisionEntry[]) => {
    setDatasets((prev) => prev.map((dataset) => (dataset.id === id ? { ...dataset, decisions: entries } : dataset)));
  }, []);

  const setDecisions = useCallback(
    (entries: DecisionEntry[]) => {
      if (!datasetId) return;
      setDecisionsForDataset(datasetId, entries);
    },
    [datasetId, setDecisionsForDataset],
  );

  const addDataset = useCallback((): DatasetId => {
    const nextIndex = datasets.length + 1;
    const id = `dataset-${nextIndex}`;
    const meta: ReportDatasetMeta = { ...getEmptyDatasetMeta(), id };
    const nextDataset: DatasetState = { id, meta, decisions: [] };
    setDatasets((prev) => [...prev, nextDataset]);
    setDatasetId(id);
    return id;
  }, [datasets.length]);

  const getDatasetById = useCallback(
    (id: DatasetId | null) => datasets.find((dataset) => dataset.id === id),
    [datasets],
  );

  useEffect(() => {
    datasets.forEach((dataset) => {
      if (!dataset.meta.path || dataset.decisions.length > 0 || loadingMap[dataset.id]) return;

      setLoadingMap((prev) => ({ ...prev, [dataset.id]: true }));
      setLoadErrors((prev) => ({ ...prev, [dataset.id]: null }));

      fetch(dataset.meta.path, { cache: "force-cache" })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to load dataset: ${response.status} ${response.statusText}`);
          }

          const raw = (await response.json()) as Array<{
            ts: number;
            name: string;
            category: string;
            impact: number;
            cost: number;
            risk: number;
            urgency: number;
            confidence: number;
          }>;
          const hydrated = raw.map(hydrateDecision).sort((a, b) => b.ts - a.ts);
          setDecisionsForDataset(dataset.id, hydrated);
        })
        .catch((error) => {
          console.error("Unable to load decisions for dataset", dataset.id, error);
          setLoadErrors((prev) => ({ ...prev, [dataset.id]: "Unable to load dataset" }));
        })
        .finally(() => {
          setLoadingMap((prev) => ({ ...prev, [dataset.id]: false }));
        });
    });
  }, [datasets, loadingMap, setDecisionsForDataset]);

  const activeDataset = useMemo(() => getDatasetById(datasetId), [datasetId, getDatasetById]);

  const meta = activeDataset?.meta ?? getEmptyDatasetMeta();
  const decisions = activeDataset?.decisions ?? [];
  const isDatasetLoading = datasetId ? Boolean(loadingMap[datasetId]) : false;
  const loadError = datasetId ? loadErrors[datasetId] ?? null : null;

  const value = useMemo(
    () => ({
      datasets,
      datasetId,
      setDatasetId,
      meta,
      decisions,
      setDecisions,
      setDecisionsForDataset,
      addDataset,
      getDatasetById,
      isDatasetLoading,
      loadError,
    }),
    [
      addDataset,
      datasetId,
      datasets,
      decisions,
      getDatasetById,
      isDatasetLoading,
      loadError,
      meta,
      setDecisions,
      setDecisionsForDataset,
    ],
  );

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset(): DatasetContextValue {
  const ctx = useContext(DatasetContext);
  if (!ctx) {
    throw new Error("useDataset must be used within a DatasetProvider");
  }
  return ctx;
}
