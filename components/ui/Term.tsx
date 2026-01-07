"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TERMS, TermKey } from "@/src/lib/terms";
import { ReactNode } from "react";

type TermProps = {
  termKey: TermKey;
  children?: ReactNode;
  className?: string;
  disableUnderline?: boolean;
};

export default function Term({ termKey, children, className, disableUnderline = false }: TermProps) {
  const definition = TERMS[termKey];
  const label = children ?? definition.label;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center text-inherit transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            disableUnderline
              ? "no-underline"
              : "no-underline decoration-dotted underline-offset-4 hover:underline focus-visible:underline",
            className,
          )}
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[240px] text-xs leading-snug">
        <div className="font-semibold text-background">{definition.label}</div>
        <div className="mt-1 text-background/80">{definition.short}</div>
        {definition.long ? <div className="mt-1 text-[11px] text-background/60">{definition.long}</div> : null}
      </TooltipContent>
    </Tooltip>
  );
}
