"use client";

import { cn } from "@/lib/utils";

type AnimatedCompassProps = {
  className?: string;
};

export function AnimatedCompass({ className }: AnimatedCompassProps) {
  return (
    <div
      className={cn(
        "relative flex h-20 w-20 items-center justify-center rounded-2xl bg-background/80 p-2 shadow-xl ring-1 ring-primary/20",
        className,
      )}
    >
      <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl animate-pulse" />
      <svg
        viewBox="0 0 120 120"
        className="relative h-full w-full text-primary"
        role="img"
        aria-label="Animated compass"
      >
        <defs>
          <radialGradient id="compassGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(59,130,246,0.2)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
          </radialGradient>
        </defs>

        <circle cx="60" cy="60" r="54" fill="url(#compassGlow)" opacity="0.7" />
        <circle cx="60" cy="60" r="48" fill="currentColor" opacity="0.08" />
        <circle cx="60" cy="60" r="48" fill="transparent" stroke="currentColor" strokeWidth="2" opacity="0.35" />

        <g className="compass-ring" stroke="currentColor" strokeWidth="2" opacity="0.3">
          <circle cx="60" cy="60" r="40" fill="none" strokeDasharray="8 8" />
          <line x1="60" y1="10" x2="60" y2="22" />
          <line x1="60" y1="98" x2="60" y2="110" />
          <line x1="10" y1="60" x2="22" y2="60" />
          <line x1="98" y1="60" x2="110" y2="60" />
        </g>

        <g className="compass-needle">
          <polygon
            points="60,20 72,60 60,100 48,60"
            fill="currentColor"
            opacity="0.75"
            className="drop-shadow-[0_8px_16px_rgba(37,99,235,0.35)]"
          />
          <polygon points="60,32 68,60 60,88 52,60" fill="white" opacity="0.85" />
          <circle cx="60" cy="60" r="6" fill="currentColor" opacity="0.6" />
          <circle cx="60" cy="60" r="3" fill="white" />
        </g>
      </svg>
    </div>
  );
}
