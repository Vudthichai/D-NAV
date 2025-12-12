import { type CompanyContext } from "@/types/company";
import { type DecisionEntry } from "@/lib/storage";

export type DatasetId = string;

export interface ReportDatasetMeta {
  id: string;
  companyName: string;
  periodLabel: string;
  displayLabel: string;
  path: string;
  company: CompanyContext;
}

export interface DatasetState {
  id: DatasetId;
  meta: ReportDatasetMeta;
  decisions: DecisionEntry[];
}
