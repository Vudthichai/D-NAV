"use client";

import LeveragePanel from "@/components/compare/LeveragePanel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DecisionVariables } from "@/lib/calculations";

interface CompareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseVariables: DecisionVariables;
}

export default function CompareSheet({
  open,
  onOpenChange,
  baseVariables,
}: CompareSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto px-6 sm:max-w-[92vw] sm:px-8 lg:max-w-[88vw] lg:px-10 xl:max-w-[80vw]"
      >
        <SheetHeader>
          <SheetTitle>Leverage (Sensitivity)</SheetTitle>
          <SheetDescription>
            Hold the baseline steady and adjust the modified judgment to see what moved D-NAV in
            this context.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <LeveragePanel baseInputs={baseVariables} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
