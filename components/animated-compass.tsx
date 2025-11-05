"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type AnimatedCompassProps = {
  className?: string;
};

const ORANGE = "#ff7a2c";
const CANVAS = "#ffffff";

const toCartesian = (center: number, radius: number, angleDeg: number) => {
  const angle = ((angleDeg - 90) * Math.PI) / 180;

  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
};

export function AnimatedCompass({ className }: AnimatedCompassProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const animationFrame = requestAnimationFrame(() => setIsReady(true));

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const ticks = useMemo(
    () =>
      Array.from({ length: 60 }, (_, index) => {
        const major = index % 5 === 0;
        const start = toCartesian(60, major ? 48 : 46, index * 6);
        const end = toCartesian(60, major ? 36 : 40, index * 6);

        return { major, start, end };
      }),
    [],
  );

  return (
    <div
      className={cn(
        "relative flex h-28 w-28 items-center justify-center rounded-[36px] bg-transparent p-3.5 text-[#ff7a2c]",
        "before:absolute before:inset-1 before:rounded-[32px] before:bg-[radial-gradient(circle_at_30%_20%,rgba(255,122,44,0.35),rgba(255,255,255,0.75))] before:opacity-80 before:blur-lg before:content-['']",
        className,
      )}
    >
      <div className="relative h-full w-full">
        <svg
          viewBox="0 0 120 120"
          className="h-full w-full drop-shadow-[0_16px_32px_rgba(255,255,255,0.35)]"
          role="img"
          aria-label="Animated compass"
        >
          <defs>
            <linearGradient id="compassBorder" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#ff955a" />
              <stop offset="50%" stopColor={ORANGE} />
              <stop offset="100%" stopColor="#ff6c1a" />
            </linearGradient>
            <radialGradient id="dialGlow" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="rgba(255, 146, 77, 0.35)" />
              <stop offset="65%" stopColor="rgba(255, 122, 44, 0.08)" />
              <stop offset="100%" stopColor="rgba(255, 122, 44, 0)" />
            </radialGradient>
          </defs>

          <rect x="6" y="6" width="108" height="108" rx="26" fill="url(#compassBorder)" />
          <rect x="14" y="14" width="92" height="92" rx="22" fill={CANVAS} />
          <circle cx="60" cy="60" r="45" fill="url(#dialGlow)" />
          <circle cx="60" cy="60" r="44" fill="#ffffff" stroke="rgba(255,122,44,0.16)" strokeWidth="1.5" />

          <g opacity="0.75">
            {ticks.map(({ major, start, end }, index) => (
              <line
                key={`tick-${index}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={major ? ORANGE : "rgba(255,255,255,0.45)"}
                strokeWidth={major ? 2.3 : 1.2}
                strokeLinecap="round"
              />
            ))}
          </g>

          <g className="origin-center animate-[spin_22s_linear_infinite]" opacity="0.35">
            <circle cx="60" cy="60" r="32" fill="none" stroke={ORANGE} strokeWidth="1.5" strokeDasharray="4 6" />
            <circle cx="60" cy="60" r="24" fill="none" stroke="rgba(255,255,255,0.55)" strokeDasharray="6 10" />
          </g>

          <g className={cn("origin-center", isReady ? "animate-compass-needle" : "")}
             style={{ transformOrigin: "60px 60px" }}>
            <polygon
              points="60,8 78,60 60,112 42,60"
              fill={ORANGE}
              stroke="white"
              strokeWidth={3.5}
              strokeLinejoin="round"
            />
            <circle cx="60" cy="60" r="11" fill="rgba(255,255,255,0.6)" />
            <circle cx="60" cy="60" r="7" fill={ORANGE} opacity={0.92} />
            <circle cx="60" cy="60" r="3" fill="white" />
          </g>

          <g className="origin-center" fontFamily="'Inter', sans-serif" fontWeight={700} fontSize="10">
            <text x="60" y="28" textAnchor="middle" fill="white" letterSpacing="4">
              N
            </text>
            <text x="94" y="64" textAnchor="middle" fill={ORANGE} letterSpacing="4">
              E
            </text>
            <text x="26" y="64" textAnchor="middle" fill={ORANGE} letterSpacing="4">
              W
            </text>
            <text x="60" y="100" textAnchor="middle" fill={ORANGE} letterSpacing="4">
              S
            </text>
          </g>

          <g opacity={0.9} className="origin-center animate-[spin_28s_linear_infinite]">
            <polygon points="60,6 64,18 72,20 64,24 60,36 56,24 48,20 56,18" fill="rgba(255,255,255,0.14)" />
          </g>
        </svg>
      </div>

      <style jsx>{`
        .animate-compass-needle {
          animation: compass-needle-spin 3.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes compass-needle-spin {
          0% {
            transform: rotate(-260deg);
          }
          25% {
            transform: rotate(300deg);
          }
          48% {
            transform: rotate(170deg);
          }
          70% {
            transform: rotate(52deg);
          }
          85% {
            transform: rotate(28deg);
          }
          100% {
            transform: rotate(16deg);
          }
        }
      `}</style>
    </div>
  );
}

