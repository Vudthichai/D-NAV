"use client";

import { cn } from "@/lib/utils";

type AnimatedCompassProps = {
  className?: string;
};

const toRadians = (angle: number) => ((angle - 90) * Math.PI) / 180;

const describeArc = (cx: number, cy: number, radius: number, startAngle: number, endAngle: number) => {
  const start = {
    x: cx + radius * Math.cos(toRadians(endAngle)),
    y: cy + radius * Math.sin(toRadians(endAngle)),
  };

  const end = {
    x: cx + radius * Math.cos(toRadians(startAngle)),
    y: cy + radius * Math.sin(toRadians(startAngle)),
  };

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

export function AnimatedCompass({ className }: AnimatedCompassProps) {
  const outerArcPath = describeArc(60, 60, 54, -18, 108);

  return (
    <div
      className={cn(
        "relative flex h-24 w-24 items-center justify-center rounded-3xl bg-background/90 p-3 shadow-xl ring-1 ring-primary/20",
        className,
      )}
    >
      <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl animate-pulse" />
      <svg
        viewBox="0 0 120 120"
        className="relative h-full w-full text-primary"
        role="img"
        aria-label="Animated compass"
      >
        <defs>
          <radialGradient id="compassGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(59,130,246,0.25)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
          </radialGradient>
        </defs>

        <circle cx="60" cy="60" r="56" fill="url(#compassGlow)" opacity="0.85" />
        <circle cx="60" cy="60" r="48" fill="currentColor" opacity="0.08" />

        <path
          d={outerArcPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="animate-[spin_18s_linear_infinite] opacity-70"
        />

        {[{ radius: 34, letter: "R", speed: "animate-spin-slower" },
          { radius: 26, letter: "S", speed: "animate-spin-reverse" },
          { radius: 18, letter: "P", speed: "animate-spin-slowest" }].map((ring, index) => (
          <g key={ring.letter} className={cn(ring.speed, "origin-center")}
             style={{ animationDelay: `${index * 0.4}s` }}>
            <circle
              cx="60"
              cy="60"
              r={ring.radius}
              fill="rgba(255,255,255,0.08)"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="6 6"
              opacity={0.55}
            />
            <text
              x="60"
              y="60"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={16 + (2 - index) * 2}
              fontWeight={700}
              fill="currentColor"
              opacity={0.9 - index * 0.15}
            >
              {ring.letter}
            </text>
          </g>
        ))}

        <g className="compass-needle">
          <circle cx="60" cy="60" r="10" fill="white" opacity="0.85" />
          <polygon
            points="60,26 72,60 60,94 48,60"
            fill="currentColor"
            opacity="0.78"
            className="drop-shadow-[0_8px_18px_rgba(37,99,235,0.35)]"
          />
          <polygon points="60,40 68,60 60,80 52,60" fill="white" opacity="0.85" />
          <circle cx="60" cy="60" r="6" fill="currentColor" opacity="0.6" />
          <circle cx="60" cy="60" r="3" fill="white" />
        </g>
      </svg>
    </div>
  );
}
