import * as React from "react"

import { cn } from "@/lib/utils"

type CalloutProps = {
  label: string
  children: React.ReactNode
  className?: string
  labelClassName?: string
  bodyClassName?: string
}

function Callout({ label, children, className, labelClassName, bodyClassName }: CalloutProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-orange-100 border-l-4 border-l-orange-500 bg-orange-50/70 px-4 py-3 print:break-inside-avoid",
        className
      )}
    >
      <p className={cn("text-[11px] font-semibold uppercase tracking-wide text-neutral-600", labelClassName)}>
        {label}
      </p>
      <div className={cn("mt-1 text-[13px] leading-[1.45] text-neutral-900", bodyClassName)}>{children}</div>
    </div>
  )
}

export { Callout }
