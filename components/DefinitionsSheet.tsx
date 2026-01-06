"use client";

import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface DefinitionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const variableDefinitions = [
  { title: "Impact", body: "Upside if it works. Higher = more potential gain." },
  { title: "Cost", body: "Money, time, focus, or reputation you burn to make it happen." },
  { title: "Risk", body: "What breaks or is hard to unwind if you’re wrong." },
  { title: "Urgency", body: "How soon a move is needed before options shrink." },
  { title: "Confidence", body: "Evidence and experience behind the call—not just hope." },
];

const signalDefinitions = [
  { title: "Return (R)", body: "Impact minus Cost. Positive means upside beats the burn." },
  {
    title: "Pressure (P)",
    body: "Urgency minus Confidence. Shows if urgency or conviction is steering you.",
  },
  {
    title: "Stability (S)",
    body: "Confidence minus Risk. Tests if evidence can outlast friction and downside.",
  },
];

const archetypeDefinition = {
  title: "Archetype",
  body: "A stance derived from the signs of Return, Pressure, and Stability (R/P/S). Each combination maps to a one-word archetype so you can name the situation quickly.",
};

export function DefinitionsSheet({ open, onOpenChange }: DefinitionsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md gap-0">
        <SheetHeader className="px-4 pt-5 pb-3">
          <SheetTitle className="text-lg">Definitions</SheetTitle>
          <SheetDescription>Quick language for the Stress Test.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-6">
          <DefinitionGroup title="Decision variables" items={variableDefinitions} />
          <DefinitionGroup title="Derived signals" items={signalDefinitions} />
          <DefinitionGroup title="Archetype" items={[archetypeDefinition]} />
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
