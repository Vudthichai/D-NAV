"use client";

import GlassyTooltip from "@/components/ui/GlassyTooltip";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DECISION_VARIABLE_KEYS,
  DEFINITIONS,
  DERIVED_SIGNAL_KEYS,
  DefinitionKey,
} from "@/src/lib/definitions";
import Link from "next/link";

interface DefinitionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const archetypeDefinitionKey: DefinitionKey = "archetype";

export function DefinitionsSheet({ open, onOpenChange }: DefinitionsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 border-l border-border/40 bg-background/70 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.6)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:max-w-md"
      >
        <SheetHeader className="px-4 pb-3 pt-5">
          <SheetTitle className="text-lg">Definitions</SheetTitle>
          <SheetDescription>Quick language for the Stress Test.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-6">
          <DefinitionGroup title="Decision variables" items={DECISION_VARIABLE_KEYS} />
          <DefinitionGroup title="Derived signals" items={DERIVED_SIGNAL_KEYS} />
          <DefinitionGroup title="Archetype" items={[archetypeDefinitionKey]} />
          <Link
            href="/definitions"
            className="inline-flex text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            See all definitions →
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DefinitionGroup({
  title,
  items,
}: {
  title: string;
  items: DefinitionKey[];
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <Separator className="bg-border/70" />
      </div>
      <div className="space-y-2.5">
        {items.map((key) => {
          const definition = DEFINITIONS[key];
          return (
            <div key={definition.label} className="space-y-1">
              <GlassyTooltip label={definition.label} note={definition.note} definition={definition.shortDefinition}>
                <button
                  type="button"
                  className="text-sm font-semibold text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {definition.label}
                  {definition.note ? <span className="text-muted-foreground">{` (${definition.note})`}</span> : null}
                </button>
              </GlassyTooltip>
              <p className="text-sm leading-snug text-muted-foreground">{definition.shortDefinition}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DefinitionsSheet;
