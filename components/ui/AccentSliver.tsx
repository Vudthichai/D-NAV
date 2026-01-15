import { cn } from "@/lib/utils"

interface AccentSliverProps {
  className?: string
}

export function AccentSliver({ className }: AccentSliverProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-[16px] w-[3px] shrink-0 rounded-full bg-[hsl(var(--primary))]", className)}
    />
  )
}
