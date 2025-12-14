import { type DecisionEntry } from "@/lib/calculations";
import { type CompanyContext } from "@/types/company";

export type DatasetId = string;

export interface DatasetMeta {
  companyName: string;
  periodLabel: string;
  displayLabel?: string;
  ticker?: string;
  sector?: string;
  stage?: CompanyContext["stage"];
  source?: CompanyContext["source"];
  type?: CompanyContext["type"];
  contextNote?: string;
  path?: string;
}

export interface DatasetState {
  id: DatasetId;
  label: string;
  meta: DatasetMeta;
  decisions: DecisionEntry[];
}

const EMPTY_DATASET_META: DatasetMeta = {
  companyName: "",
  periodLabel: "",
  displayLabel: "",
  ticker: "",
  sector: "",
  stage: undefined,
  source: undefined,
  type: undefined,
  contextNote: "",
  path: "",
};

export function getEmptyDatasetMeta(): DatasetMeta {
  return { ...EMPTY_DATASET_META };
}

export function datasetMetaToCompanyContext(meta: DatasetMeta): CompanyContext {
  return {
    companyName: meta.companyName ?? "",
    timeframeLabel: meta.periodLabel ?? meta.displayLabel ?? "",
    ticker: meta.ticker || undefined,
    sector: meta.sector || undefined,
    stage: meta.stage,
    source: meta.source,
    type: meta.type,
    contextNote: meta.contextNote || undefined,
  };
}
