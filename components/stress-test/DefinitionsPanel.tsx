"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function DefinitionsPanel({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <div
      className={["fixed inset-0 z-[100]", open ? "pointer-events-auto" : "pointer-events-none"].join(
        " ",
      )}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={[
          "absolute inset-0 transition-opacity duration-200",
          "bg-black/20 dark:bg-black/55",
          "backdrop-blur-[1px]",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className={[
          "definitions-panel",
          "absolute right-4 top-4 bottom-4 w-[440px] max-w-[calc(100vw-2rem)]",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-[110%]",
          "rounded-[28px]",
          "bg-white/55 dark:bg-zinc-950/45",
          "backdrop-blur-2xl",
          "border border-white/60 dark:border-white/10",
          "ring-1 ring-black/10 dark:ring-white/5",
          "shadow-[0_30px_90px_rgba(0,0,0,0.18)]",
          "overflow-hidden",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label="Definitions"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-white/55 to-white/10 dark:from-white/10 dark:to-transparent" />
          <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.35)_1px,transparent_0)] [background-size:18px_18px]" />
        </div>

        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between px-6 pt-6 pb-4">
            <div>
              <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Definitions</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Quick language for the Stress Test.
              </div>
            </div>

            <button
              onClick={onClose}
              className={[
                "inline-flex items-center justify-center",
                "h-9 w-9 rounded-full",
                "bg-white/40 dark:bg-white/10",
                "border border-white/50 dark:border-white/10",
                "backdrop-blur-xl",
                "text-zinc-800 dark:text-zinc-100",
                "hover:bg-white/55 dark:hover:bg-white/15",
                "transition-colors",
              ].join(" ")}
              aria-label="Close definitions"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <Section title="Decision Variables">
              <Def term="Impact" desc="Upside if it works. Higher = more potential gain." />
              <Def term="Cost" desc="Money, time, focus, or reputation you burn to make it happen." />
              <Def term="Risk" desc="What breaks or is hard to unwind if you’re wrong." />
              <Def term="Urgency" desc="How soon a move is needed before options shrink." />
              <Def term="Confidence" desc="Evidence and experience behind the call—not just hope." />
            </Section>

            <Divider />

            <Section title="Derived Signals">
              <Def term="Return (R)" desc="Impact minus Cost. Positive means upside beats the burn." />
              <Def
                term="Pressure (P)"
                desc="Urgency minus Confidence. Shows if urgency or conviction is steering you."
              />
              <Def
                term="Stability (S)"
                desc="Confidence minus Risk. Tests if evidence can outlast friction and downside."
              />
            </Section>

            <Divider />

            <Section title="Archetype">
              <Def
                term="Archetype"
                desc="A stance derived from the signs of Return, Pressure, and Stability (R/P/S). Each combination maps to a one-word archetype so you can name the situation quickly."
              />
            </Section>

            <div className="mt-6">
              <Link
                href="/definitions"
                className="text-sm font-medium text-zinc-800 hover:underline dark:text-zinc-200"
              >
                See all definitions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        {title}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function Def({ term, desc }: { term: string; desc: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{term}</div>
      <div className="mt-1 text-sm leading-snug text-zinc-600 dark:text-zinc-400">{desc}</div>
    </div>
  );
}

function Divider() {
  return <div className="mt-5 h-px w-full bg-black/10 dark:bg-white/10" />;
}
