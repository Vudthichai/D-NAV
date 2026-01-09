"use client";

import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ARCHETYPE_DEFINITION,
  DECISION_VARIABLE_DEFINITIONS,
  DERIVED_SIGNAL_DEFINITIONS,
} from "@/src/lib/definitions";

interface DefinitionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DefinitionsSheet({ open, onOpenChange }: DefinitionsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-md gap-0 border-l border-border/60 bg-background/75 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 rounded-l-2xl"
      >
        <SheetHeader className="px-4 pt-5 pb-3">
          <SheetTitle className="text-lg">Definitions</SheetTitle>
          <SheetDescription>Quick language for the Stress Test.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-6">
          <DefinitionGroup title="Decision variables" items={DECISION_VARIABLE_DEFINITIONS} />
          <DefinitionGroup title="Derived signals" items={DERIVED_SIGNAL_DEFINITIONS} />
          <DefinitionGroup title="Archetype" items={[ARCHETYPE_DEFINITION]} />
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
  items: Array<{ title: string; body: string }>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <Separator className="bg-border/70" />
      </div>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.title} className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="text-sm leading-snug text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DefinitionsSheet;
