import { Badge } from "@/components/ui/badge";
import { getArchetypeSignals, type RpsSignal } from "@/lib/calculations";
import { cn } from "@/lib/utils";

type ArchetypeRpsChipsProps = {
  archetype: string;
  className?: string;
  chipClassName?: string;
};

const getBadgeVariant = (value: RpsSignal) => {
  if (value > 0) return "default";
  if (value < 0) return "destructive";
  return "secondary";
};

const formatSignal = (label: string, value: RpsSignal) =>
  `${label}${value > 0 ? "+" : value < 0 ? "-" : "0"}`;

export function ArchetypeRpsChips({ archetype, className, chipClassName }: ArchetypeRpsChipsProps) {
  const signals = getArchetypeSignals(archetype);

  if (!signals) {
    return null;
  }

  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      <Badge variant={getBadgeVariant(signals.r)} className={cn("px-1.5 py-0.5 text-[10px]", chipClassName)}>
        {formatSignal("R", signals.r)}
      </Badge>
      <Badge variant={getBadgeVariant(signals.p)} className={cn("px-1.5 py-0.5 text-[10px]", chipClassName)}>
        {formatSignal("P", signals.p)}
      </Badge>
      <Badge variant={getBadgeVariant(signals.s)} className={cn("px-1.5 py-0.5 text-[10px]", chipClassName)}>
        {formatSignal("S", signals.s)}
      </Badge>
    </span>
  );
}
