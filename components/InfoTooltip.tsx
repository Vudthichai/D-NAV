"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getMetricExplainer } from "@/utils/metricExplainers";
import * as React from "react";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface InfoTooltipProps {
  term: string;
  children: React.ReactNode;
  side?: TooltipSide;
}

export function InfoTooltip({ term, children, side = "top" }: InfoTooltipProps) {
  const info = getMetricExplainer(term);

  if (!info) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs space-y-2">
        <p className="text-sm font-semibold leading-snug">{info.description}</p>
        <p className="text-xs text-muted-foreground leading-snug">Example: {info.example}</p>
      </TooltipContent>
    </Tooltip>
  );
}
