import { computeMetrics, type DecisionEntry } from "@/lib/calculations";
import {
  buildCompanyPeriodSnapshot,
  type CompanyPeriodSnapshot,
} from "@/lib/dnavSummaryEngine";
import { getDatasetMeta, type DatasetId } from "@/lib/reportDatasets";
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

export async function loadDecisionsForDataset(id: DatasetId | null): Promise<DecisionEntry[]> {
  const meta = getDatasetMeta(id);
  if (!meta.path) return [];

  try {
    const response = await fetch(meta.path, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load dataset: ${response.status} ${response.statusText}`);
    }

    const raw = (await response.json()) as RawDecision[];
    return raw.map(hydrateDecision).sort((a, b) => b.ts - a.ts);
  } catch (error) {
    console.error("Unable to load decisions for dataset", id, error);
    return [];
  }
}

export async function loadSnapshotForDataset(
  id: DatasetId | null,
): Promise<CompanyPeriodSnapshot | null> {
  try {
    const meta = getDatasetMeta(id);
    if (!meta.path) return null;
    const decisions = await loadDecisionsForDataset(id);

    const dashboard = buildJudgmentDashboard(decisions, meta.company);

    return buildCompanyPeriodSnapshot({
      company: dashboard.companyContext ?? meta.company,
      baseline: dashboard.baseline,
      categories: dashboard.categories,
      archetypes: dashboard.archetypes.rows,
      learning: {
        lci: dashboard.learning?.lci ?? 0,
        decisionsToRecover: dashboard.learning?.decisionsToRecover ?? 0,
        winRate: dashboard.learning?.winRate ?? 0,
        decisionDebt: dashboard.hygiene?.decisionDebt ?? 0,
      },
      timeframeKey: id,
      timeframeLabel: meta.periodLabel ?? meta.displayLabel,
    });
  } catch (error) {
    console.error("Failed to build snapshot for dataset", id, error);
    return null;
  }
}
