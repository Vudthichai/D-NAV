"use client";

import { DEFINITIONS, TermKey } from "@/src/lib/definitions";
import { cn } from "@/lib/utils";
import { ReactNode, useId } from "react";

type TermProps = {
  term: TermKey;
  children?: ReactNode;
  className?: string;
};

export default function Term({ term, children, className }: TermProps) {
  const definition = DEFINITIONS[term];
  const tooltipId = useId();
  const label = children ?? definition.label;

  return (
    <span className={cn("group relative inline-flex", className)}>
      <button
        type="button"
        className="inline-flex items-center text-inherit underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-describedby={tooltipId}
      >
        {label}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-[320px] max-w-[85vw] -translate-x-1/2 translate-y-1 rounded-xl border border-black/10 bg-white/95 p-3 text-sm text-neutral-900 opacity-0 shadow-lg backdrop-blur transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
      >
        <div className="font-semibold text-neutral-900">{definition.label}</div>
        <div className="mt-1 text-sm text-neutral-600">{definition.body}</div>
        {definition.formula ? (
          <div className="mt-2 inline-flex rounded-full bg-neutral-900/5 px-2 py-0.5 font-mono text-xs text-neutral-700">
            {definition.formula}
          </div>
        ) : null}
      </span>
    </span>
  );
}
