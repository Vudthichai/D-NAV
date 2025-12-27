"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Segment = {
  label: string;
  percent: number;
  colorClass: string;
};

const rows: Array<{
  title: string;
  segments: Segment[];
}> = [
  {
    title: "Return",
    segments: [
      { label: "Positive", percent: 85, colorClass: "bg-gradient-to-r from-emerald-400 to-emerald-500" },
      { label: "Neutral", percent: 8, colorClass: "bg-slate-500" },
      { label: "Negative", percent: 7, colorClass: "bg-gradient-to-r from-rose-400 to-rose-500" },
    ],
  },
  {
    title: "Pressure",
    segments: [
      { label: "Pressured", percent: 9, colorClass: "bg-gradient-to-r from-amber-400 to-orange-500" },
      { label: "Neutral", percent: 3, colorClass: "bg-slate-500" },
      { label: "Calm", percent: 88, colorClass: "bg-gradient-to-r from-sky-400 to-blue-500" },
    ],
  },
  {
    title: "Stability",
    segments: [
      { label: "Stable", percent: 88, colorClass: "bg-gradient-to-r from-emerald-400 to-emerald-500" },
      { label: "Neutral", percent: 1, colorClass: "bg-slate-500" },
      { label: "Fragile", percent: 11, colorClass: "bg-gradient-to-r from-rose-400 to-rose-500" },
    ],
  },
];

export function RpsDistributions() {
  const initialReduceMotion =
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
  const ref = useRef<HTMLDivElement | null>(null);
  const [reduceMotion, setReduceMotion] = useState<boolean>(initialReduceMotion);
  const [inView, setInView] = useState(initialReduceMotion);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => {
      setReduceMotion(event.matches);
      if (event.matches) {
        setInView(true);
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    if (reduceMotion) {
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [reduceMotion]);

  return (
    <div ref={ref} className="space-y-4">
      {rows.map((row, rowIndex) => (
        <div key={row.title} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-200">{row.title}</span>
            <span className="text-slate-400">Distributions</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
            {row.segments.map((segment, index) => (
              <span
                key={segment.label}
                className={cn(
                  "relative block h-full transition-[width] duration-700 ease-out",
                  reduceMotion ? "" : "will-change-[width]",
                  segment.colorClass
                )}
                style={{
                  width: inView ? `${segment.percent}%` : reduceMotion ? `${segment.percent}%` : "0%",
                  transitionDelay: reduceMotion ? "0ms" : `${(rowIndex * 3 + index) * 90}ms`,
                }}
              >
                <span className="absolute inset-y-0 left-2 right-2 flex items-center justify-between text-[10px] text-white/80 mix-blend-screen">
                  {segment.percent >= 10 ? segment.label : ""}
                  {segment.percent >= 6 ? `${segment.percent}%` : ""}
                </span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
            {row.segments.map((segment) => (
              <span key={segment.label} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                <span className="h-2 w-2 rounded-full bg-white/70" aria-hidden />
                {segment.label} • {segment.percent}%
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
