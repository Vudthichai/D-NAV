"use client";

import GlassyTooltip from "@/components/ui/GlassyTooltip";
import { cn } from "@/lib/utils";
import { DEFINITIONS, DefinitionKey } from "@/src/lib/definitions";
import { ReactNode } from "react";

type TermProps = {
  termKey: DefinitionKey;
  children?: ReactNode;
  className?: string;
};

export default function Term({ termKey, children, className }: TermProps) {
  const definition = DEFINITIONS[termKey];
  const label = children ?? definition.label;
  return (
    <GlassyTooltip label={definition.label} note={definition.note} definition={definition.shortDefinition}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center text-inherit transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "no-underline",
          className,
        )}
      >
        {label}
      </button>
    </GlassyTooltip>
  );
}
