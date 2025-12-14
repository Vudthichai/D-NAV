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
  type SetStateAction,
} from "react";

import { computeMetrics, type DecisionEntry } from "@/lib/calculations";
import { getDatasetDisplayLabel } from "@/lib/reportDatasets";
import { getEmptyDatasetMeta, type DatasetId, type DatasetMeta, type DatasetState } from "@/types/dataset";

interface DatasetContextValue {
  datasets: DatasetState[];
  activeDatasetId: DatasetId | null;
  activeDataset: DatasetState | null;
  setActiveDatasetId: (id: DatasetId | null) => void;
  meta: DatasetMeta;
  decisions: DecisionEntry[];
  setDecisions: (entries: SetStateAction<DecisionEntry[]>) => void;
  setDecisionsForDataset: (id: DatasetId, entries: SetStateAction<DecisionEntry[]>) => void;
  addDataset: () => DatasetId;
  deleteDataset: (id: DatasetId) => void;
  setDatasetMeta: (id: DatasetId, metaPatch: Partial<DatasetMeta>) => void;
  clearDatasetDecisions: (id: DatasetId) => void;
  clearAllDatasets: () => void;
  getDatasetById: (id: DatasetId | null) => DatasetState | undefined;
  isDatasetLoading: boolean;
  loadError: string | null;
}

interface StoredDatasetState {
  datasets: DatasetState[];
  activeDatasetId: DatasetId | null;
}

const STORAGE_KEY = "dnav_datasets_state_v2";

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

const createInitialDataset = (): DatasetState => ({
  id: "dataset-1",
  label: "Dataset 1",
  meta: getEmptyDatasetMeta(),
  decisions: [],
});

function normalizeDatasets(raw: DatasetState[] | undefined): DatasetState[] {
  if (!raw || raw.length === 0) return [createInitialDataset()];

  return raw.map((dataset, index) => ({
    id: dataset.id || `dataset-${index + 1}`,
    label: dataset.label || getDatasetDisplayLabel(index),
    meta: { ...getEmptyDatasetMeta(), ...dataset.meta },
    decisions: dataset.decisions ?? [],
  }));
}

function loadStoredState(): StoredDatasetState {
  if (typeof window === "undefined") {
    const initial = createInitialDataset();
    return { datasets: [initial], activeDatasetId: initial.id };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredDatasetState;
      const datasets = normalizeDatasets(parsed.datasets);
      const activeDatasetId = datasets.find((dataset) => dataset.id === parsed.activeDatasetId)?.id ?? datasets[0]?.id ?? null;
      return { datasets, activeDatasetId };
    }
  } catch (error) {
    console.error("Failed to load dataset state", error);
  }

  const initial = createInitialDataset();
  return { datasets: [initial], activeDatasetId: initial.id };
}

const DatasetContext = createContext<DatasetContextValue | undefined>(undefined);

export function DatasetProvider({ children }: { children: ReactNode }): ReactElement {
  const initialState = useMemo(() => loadStoredState(), []);
  const [datasets, setDatasets] = useState<DatasetState[]>(initialState.datasets);
  const [activeDatasetId, setActiveDatasetId] = useState<DatasetId | null>(initialState.activeDatasetId);
  const [loadingMap, setLoadingMap] = useState<Record<DatasetId, boolean>>({});
  const [loadErrors, setLoadErrors] = useState<Record<DatasetId, string | null>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const state: StoredDatasetState = { datasets, activeDatasetId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [activeDatasetId, datasets]);

  const resolveDecisionsUpdate = useCallback(
    (update: SetStateAction<DecisionEntry[]>, current: DecisionEntry[]): DecisionEntry[] =>
      typeof update === "function" ? update(current) : update,
    [],
  );

  const setDecisionsForDataset = useCallback(
    (id: DatasetId, entries: SetStateAction<DecisionEntry[]>) => {
      setDatasets((prev) =>
        prev.map((dataset) =>
          dataset.id === id ? { ...dataset, decisions: resolveDecisionsUpdate(entries, dataset.decisions) } : dataset,
        ),
      );
    },
    [resolveDecisionsUpdate],
  );

  const setDecisions = useCallback(
    (entries: SetStateAction<DecisionEntry[]>) => {
      if (!activeDatasetId) return;
      setDecisionsForDataset(activeDatasetId, entries);
    },
    [activeDatasetId, setDecisionsForDataset],
  );

  const addDataset = useCallback((): DatasetId => {
    const nextIndex = datasets.length + 1;
    const id = `dataset-${nextIndex}`;
    const label = getDatasetDisplayLabel(nextIndex - 1);
    const meta: DatasetMeta = { ...getEmptyDatasetMeta() };
    const nextDataset: DatasetState = { id, label, meta, decisions: [] };
    setDatasets((prev) => [...prev, nextDataset]);
    setActiveDatasetId(id);
    return id;
  }, [datasets.length]);

  const deleteDataset = useCallback(
    (id: DatasetId) => {
      setDatasets((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((dataset) => dataset.id !== id);
        if (filtered.length === 0) return prev;
        const relabeled = filtered.map((dataset, index) => ({
          ...dataset,
          label: getDatasetDisplayLabel(index),
        }));

        setActiveDatasetId((current) => {
          if (!current || current === id) return relabeled[0]?.id ?? null;
          const stillExists = relabeled.some((dataset) => dataset.id === current);
          return stillExists ? current : relabeled[0]?.id ?? null;
        });

        return relabeled;
      });
    },
    [],
  );

  const setDatasetMeta = useCallback((id: DatasetId, metaPatch: Partial<DatasetMeta>) => {
    setDatasets((prev) =>
      prev.map((dataset) =>
        dataset.id === id ? { ...dataset, meta: { ...dataset.meta, ...metaPatch } } : dataset,
      ),
    );
  }, []);

  const clearDatasetDecisions = useCallback((id: DatasetId) => {
    setDecisionsForDataset(id, []);
  }, [setDecisionsForDataset]);

  const clearAllDatasets = useCallback(() => {
    const initial = createInitialDataset();
    setDatasets([initial]);
    setActiveDatasetId(initial.id);
  }, []);

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

  const activeDataset = useMemo(() => getDatasetById(activeDatasetId) ?? null, [activeDatasetId, getDatasetById]);

  const meta = useMemo(() => activeDataset?.meta ?? getEmptyDatasetMeta(), [activeDataset]);
  const decisions = useMemo(() => activeDataset?.decisions ?? [], [activeDataset]);
  const isDatasetLoading = activeDatasetId ? Boolean(loadingMap[activeDatasetId]) : false;
  const loadError = activeDatasetId ? loadErrors[activeDatasetId] ?? null : null;

  const value = useMemo(
    () => ({
      datasets,
      activeDatasetId,
      activeDataset,
      setActiveDatasetId,
      meta,
      decisions,
      setDecisions,
      setDecisionsForDataset,
      addDataset,
      deleteDataset,
      setDatasetMeta,
      clearDatasetDecisions,
      clearAllDatasets,
      getDatasetById,
      isDatasetLoading,
      loadError,
    }),
    [
      activeDataset,
      activeDatasetId,
      addDataset,
      clearAllDatasets,
      clearDatasetDecisions,
      decisions,
      deleteDataset,
      datasets,
      getDatasetById,
      isDatasetLoading,
      loadError,
      meta,
      setDatasetMeta,
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
