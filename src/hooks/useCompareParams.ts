"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { DEFAULT_DECISION_VARS, type DecisionVars } from "@/src/lib/dnav/types";
import { parseVars } from "@/src/lib/dnav/serialize";

export type Selection =
  | { kind: "log"; id: string; label?: string }
  | { kind: "manual"; vars: DecisionVars; label?: string };

function parseSelection(raw: string | null, label: string | undefined): Selection | null {
  if (!raw) return null;
  if (raw.startsWith("log:")) {
    const id = raw.slice("log:".length);
    return id ? { kind: "log", id, label } : null;
  }

  if (raw.startsWith("manual:")) {
    const vars = parseVars(raw.slice("manual:".length));
    return vars ? { kind: "manual", vars, label } : null;
  }

  return null;
}

const defaultSelection = (): Selection => ({ kind: "manual", vars: { ...DEFAULT_DECISION_VARS } });

export function useCompareParams(): { a: Selection; b: Selection } {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const aLabel = searchParams.get("aLabel") ?? undefined;
    const bLabel = searchParams.get("bLabel") ?? undefined;

    const parsedA = parseSelection(searchParams.get("a"), aLabel) ?? defaultSelection();
    const parsedB = parseSelection(searchParams.get("b"), bLabel) ?? defaultSelection();

    return { a: parsedA, b: parsedB };
  }, [searchParams]);
}
