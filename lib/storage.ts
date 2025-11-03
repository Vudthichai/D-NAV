import { DecisionEntry } from './calculations';

export type { DecisionEntry };

const STORAGE_KEY = 'dnav_log_v1';

export function loadLog(): DecisionEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveLog(entries: DecisionEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to save log:', error);
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
