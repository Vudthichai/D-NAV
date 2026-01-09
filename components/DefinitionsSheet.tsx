"use client";

import Link from "next/link";

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
      <SheetContent
        side="right"
        className="relative gap-0 border-l border-black/10 bg-white/70 shadow-2xl backdrop-blur-xl sm:max-w-md dark:border-white/10 dark:bg-zinc-950/60"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-transparent dark:from-white/10" />
        <div className="relative flex h-full flex-col">
          <SheetHeader className="border-b border-black/5 px-5 pt-6 pb-4 text-left dark:border-white/10">
            <SheetTitle className="text-lg">Definitions</SheetTitle>
            <SheetDescription className="text-sm leading-relaxed">
              Quick language for the Stress Test.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-6 pt-5">
            <div className="divide-y divide-black/5 dark:divide-white/10">
              <DefinitionGroup title="Decision variables" items={variableDefinitions} />
              <DefinitionGroup title="Derived signals" items={signalDefinitions} />
              <DefinitionGroup title="Archetype" items={[archetypeDefinition]} />
            </div>
            <Link
              href="/definitions"
              className="mt-6 inline-flex text-xs font-medium uppercase tracking-wide text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              See all definitions →
            </Link>
          </div>
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
    <div className="space-y-3 pt-6 first:pt-0">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <Separator className="bg-border/70" />
      </div>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.title} className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DefinitionsSheet;
