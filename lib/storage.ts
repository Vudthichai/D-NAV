import { DecisionEntry } from "./calculations";
import { type ArchetypeSummaryOutput, type CompanyContext, type CompanySummaryOutput } from "@/types/company";

export type { DecisionEntry };

const STORAGE_KEY = "dnav_log_v1";
const CONTEXT_KEY = "dnav_company_context_v1";
const COMPANY_SUMMARY_KEY = "dnav_company_summary_v1";
const ARCHETYPE_SUMMARY_KEY = "dnav_archetype_summary_v1";

export function loadLog(): DecisionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveLog(entries: DecisionEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Failed to save log:", error);
  }
}

export function addDecision(entry: DecisionEntry): void {
  const current = loadLog();
  current.unshift(entry);
  saveLog(current);
}

export function removeDecision(timestamp: number): void {
  const current = loadLog().filter(r => r.ts !== timestamp);
  saveLog(current);
}

export function clearLog(): void {
  saveLog([]);
}

export function loadCompanyContext(): CompanyContext | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(CONTEXT_KEY);
    return stored ? (JSON.parse(stored) as CompanyContext) : null;
  } catch {
    return null;
  }
}

export function saveCompanyContext(context: CompanyContext): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
  } catch (error) {
    console.error("Failed to save company context:", error);
  }
}

export function loadCompanySummary(): CompanySummaryOutput | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(COMPANY_SUMMARY_KEY);
    return stored ? (JSON.parse(stored) as CompanySummaryOutput) : null;
  } catch {
    return null;
  }
}

export function saveCompanySummary(summary: CompanySummaryOutput): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMPANY_SUMMARY_KEY, JSON.stringify(summary));
  } catch (error) {
    console.error("Failed to save company summary:", error);
  }
}

export function loadArchetypeSummaries(): Record<string, ArchetypeSummaryOutput> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(ARCHETYPE_SUMMARY_KEY);
    return stored ? (JSON.parse(stored) as Record<string, ArchetypeSummaryOutput>) : {};
  } catch {
    return {};
  }
}

export function saveArchetypeSummary(
  archetype: string,
  summary: ArchetypeSummaryOutput,
): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadArchetypeSummaries();
    const next = { ...existing, [archetype]: summary };
    localStorage.setItem(ARCHETYPE_SUMMARY_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to save archetype summary:", error);
  }
}
