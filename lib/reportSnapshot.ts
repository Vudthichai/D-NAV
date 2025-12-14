import { computeMetrics, type DecisionEntry } from "@/lib/calculations";
import {
  buildCompanyPeriodSnapshot,
  type CompanyPeriodSnapshot,
} from "@/lib/dnavSummaryEngine";
import { datasetMetaToCompanyContext, getEmptyDatasetMeta, type DatasetState } from "@/types/dataset";
import { buildJudgmentDashboard } from "@/utils/judgmentDashboard";

type RawDecision = {
  ts: number;
  name: string;
  category: string;
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
};

const hydrateDecision = (decision: RawDecision): DecisionEntry => {
  const metrics = computeMetrics({
    impact: decision.impact,
    cost: decision.cost,
    risk: decision.risk,
    urgency: decision.urgency,
    confidence: decision.confidence,
  });

  return { ...decision, ...metrics };
};

export async function loadDecisionsForDataset(dataset: DatasetState | null): Promise<DecisionEntry[]> {
  if (!dataset) return [];
  if (dataset.decisions.length > 0) return dataset.decisions;
  if (!dataset.meta.path) return [];

  try {
    const response = await fetch(dataset.meta.path, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load dataset: ${response.status} ${response.statusText}`);
    }

    const raw = (await response.json()) as RawDecision[];
    return raw.map(hydrateDecision).sort((a, b) => b.ts - a.ts);
  } catch (error) {
    console.error("Unable to load decisions for dataset", dataset.id, error);
    return [];
  }
}

export async function loadSnapshotForDataset(
  dataset: DatasetState | null,
): Promise<CompanyPeriodSnapshot | null> {
  try {
    if (!dataset) return null;
    const decisions = await loadDecisionsForDataset(dataset);

    const dashboard = buildJudgmentDashboard(
      decisions,
      datasetMetaToCompanyContext(dataset.meta ?? getEmptyDatasetMeta()),
    );

    return buildCompanyPeriodSnapshot({
      company: dashboard.companyContext ?? datasetMetaToCompanyContext(dataset.meta ?? getEmptyDatasetMeta()),
      baseline: dashboard.baseline,
      categories: dashboard.categories,
      archetypes: dashboard.archetypes.rows,
      learning: {
        lci: dashboard.learning?.lci ?? 0,
        decisionsToRecover: dashboard.learning?.decisionsToRecover ?? 0,
        winRate: dashboard.learning?.winRate ?? 0,
        decisionDebt: dashboard.hygiene?.decisionDebt ?? 0,
      },
      timeframeKey: dataset.id,
      timeframeLabel: dataset.meta.periodLabel ?? dataset.meta.displayLabel,
    });
  } catch (error) {
    console.error("Failed to build snapshot for dataset", dataset?.id, error);
    return null;
  }
}
