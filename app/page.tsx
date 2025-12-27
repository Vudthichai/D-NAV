"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AnimatedCompass } from "@/components/animated-compass";
import { Button } from "@/components/ui/button";

const noiseTexture =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48ZmlsdGVyIGlkPSdudCcgZmlsdGVyVW5pdHM9J3VzZXJTcGFjZU9uVXNlJyB4PScwJyB5PScwJz48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Jy4zJyBudW1PY3RhdmVzPSc0Jy8+PGZlQ29sb3JNYXRyaXggdHlwZT0nc2F0dXJhdGUnIHZhbHVlcz0nMCAwIDAgMCAwIDEgMCAwIDAgMCAwIDAgMCAwIDAgMC4xIDAgMCAwIDAgMCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJyBmaWx0ZXI9InVybCgjbnQpIiBvcGFjaXR5PScwLjQnLz48L3N2Zz4=\n";

type GlassPanelProps = HTMLAttributes<HTMLDivElement>;

function HeroBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#050608]" />
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: `url(${noiseTexture})` }} />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(circle at 30% 22%, rgba(249,115,22,0.18), transparent 38%), radial-gradient(circle at 78% 12%, rgba(59,130,246,0.12), transparent 32%), radial-gradient(circle at 55% 80%, rgba(16,185,129,0.12), transparent 28%)",
        }}
      />
    </div>
  );
}

function GlassPanel({ children, className = "", ...props }: GlassPanelProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.8)] backdrop-blur-xl ${className}`.trim()}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-40" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SectionHeading({ title, subtitle, align = "center" }: { title: string; subtitle?: string; align?: "center" | "left" }) {
  const alignmentClass = align === "center" ? "text-center" : "text-left";
  const widthClass = align === "center" ? "mx-auto" : "";

  return (
    <div className={`space-y-3 ${alignmentClass}`}>
      <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Feature × Qupe</p>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">{title}</h2>
      {subtitle ? <p className={`text-lg text-slate-300 max-w-3xl ${widthClass}`}>{subtitle}</p> : null}
    </div>
  );
}

function HeroSection() {
  const signals = [
    {
      title: "Judgment telemetry",
      copy: "RPS shows whether your conviction is earned or improv.",
    },
    {
      title: "Built for real-time calls",
      copy: "Archetypes translate edge, fragility, and drift into action.",
    },
    {
      title: "Compare without theatrics",
      copy: "Line up entities and see where to push, pause, or adapt.",
    },
  ];

  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackground />
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 space-y-12">
        <div className="flex flex-wrap items-center gap-3 animate-fade-up" style={{ "--delay": "0s" } as CSSProperties}>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-slate-100">
            <AnimatedCompass className="h-5 w-5" />
            <span>Feature × Qupe</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            Decision NAVigator
          </div>
        </div>

        <div className="space-y-7 animate-fade-up" style={{ "--delay": "0.08s" } as CSSProperties}>
          <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">
            Track your judgment with a glassy, minimal command surface.
          </h1>
          <p className="text-xl text-slate-200 max-w-3xl">
            D-NAV blends executive-grade clarity with live decision telemetry. No laptop glam — just proof you can take into the room.
          </p>
        </div>

        <div className="space-y-4 animate-fade-up" style={{ "--delay": "0.14s" } as CSSProperties}>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
            <Button
              size="lg"
              className="text-lg px-8 py-6 bg-amber-500 text-black hover:bg-amber-400 focus-visible:ring-amber-300 shadow-[0_12px_40px_-20px_rgba(249,115,22,0.8)]"
              asChild
            >
              <Link href="/calculator">
                Run a Decision Check
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 border-white/25 bg-slate-900/70 text-white hover:bg-white/10 hover:border-amber-300/60 focus-visible:ring-amber-300"
              asChild
            >
              <Link href="#quick-start">See how it works</Link>
            </Button>
          </div>
          <p className="text-sm text-slate-400">Start with a decision you’re avoiding.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 animate-fade-up" style={{ "--delay": "0.22s" } as CSSProperties}>
          {signals.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_-42px_rgba(0,0,0,0.9)]">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Signal</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-slate-300">{item.copy}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 animate-fade-up" style={{ "--delay": "0.32s" } as CSSProperties}>
          <Image src="/logo.PNG" alt="D-NAV logo" width={48} height={48} className="rounded-xl border border-white/10 bg-white/5 p-2" />
          <div className="text-sm text-slate-300">
            Feature x Qupe is a calm surface for the messy parts of judgment. No haze, no glow — just the score of how your calls hold up.
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofStrip() {
  const items = [
    {
      title: "Executive readout",
      description: "Minimal panels that translate noise into Return, Pressure, Stability lines leaders can act on.",
    },
    {
      title: "Entity compare",
      description: "Juxtapose bets, teams, or assets without theatrics. See which levers move the score.",
    },
    {
      title: "Adaptation",
      description: "Watch urgency, risk, and confidence drift over time so you can intervene before a snap.",
    },
  ];

  return (
    <section className="bg-[#050608] pb-16">
      <div className="max-w-6xl mx-auto px-6 space-y-6">
        <GlassPanel className="p-6 md:p-8 animate-fade-up" style={{ "--delay": "0.12s" } as CSSProperties}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.2em] text-amber-200">Proof strip</p>
                <h3 className="text-2xl font-semibold text-white">Executive-proof clarity. No desktop mockups.</h3>
                <p className="text-slate-300 max-w-3xl">
                  Three micro surfaces — readout, compare, adaptation — to show how the system responds under pressure.
                </p>
              </div>
              <div className="text-sm text-slate-300">Glassy panels, tight typography, aligned to the decisions you avoid.</div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {items.map((item, index) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md animate-fade-up"
                  style={{ "--delay": `${0.16 + index * 0.06}s` } as CSSProperties}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                      {item.title}
                    </div>
                    <p className="text-slate-200 text-sm leading-relaxed">{item.description}</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {[1, 2, 3].map((bar) => (
                      <div key={bar} className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-white/40 via-white/15 to-transparent animate-shimmer" />
                      </div>
                    ))}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {["Return", "Pressure", "Stability"].map((label) => (
                        <div key={label} className="rounded-lg border border-white/5 bg-white/5 px-2 py-1 text-[11px] text-slate-200 text-center">
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}

function DistributionBars() {
  const bars = [
    { label: "Return", width: "78%", tone: "amber" },
    { label: "Pressure", width: "62%", tone: "slate" },
    { label: "Stability", width: "71%", tone: "slate" },
  ];

  const toneClass: Record<string, string> = {
    amber: "from-amber-400 to-amber-500",
    slate: "from-slate-100/80 to-slate-300/70",
  };

  return (
    <div className="space-y-3">
      {bars.map((bar, index) => (
        <div key={bar.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm text-slate-200">
            <span>{bar.label}</span>
            <span className="text-slate-400">{bar.width}</span>
          </div>
          <div className="h-2 rounded-full bg-white/5">
            <div
              className={`bar-fill h-full rounded-full bg-gradient-to-r ${toneClass[bar.tone]} shadow-[0_8px_30px_-18px_rgba(249,115,22,0.8)]`}
              style={{ "--bar-width": bar.width, "--delay": `${0.1 + index * 0.08}s` } as CSSProperties}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function UnderTheHoodSection() {
  return (
    <section id="quick-start" className="bg-[#040507] py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-6 space-y-10">
        <SectionHeading
          title="Under the hood: RPS + D-NAV"
          subtitle="A single rhythm: capture the signal, compare entities, and adapt before pressure spikes."
          align="left"
        />

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <GlassPanel className="p-6 md:p-8 animate-fade-up" style={{ "--delay": "0.08s" } as CSSProperties}>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                RPS Signals
              </div>
              <h3 className="text-2xl font-semibold text-white">Return, Pressure, Stability — one tile.</h3>
              <p className="text-slate-300">
                The physics of your decision: Return = Impact − Cost, Pressure = Urgency − Confidence, Stability = Confidence − Risk. All readouts share the same grammar so your team stops arguing over language.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {["Return", "Pressure", "Stability"].map((item, index) => (
                  <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Signal</p>
                    <p className="text-base font-semibold text-white">{item}</p>
                    <p className="text-xs text-slate-300">{index === 0 ? "Impact vs. burn" : index === 1 ? "Urgency vs. proof" : "Confidence vs. risk"}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6 md:p-8 animate-fade-up" style={{ "--delay": "0.14s" } as CSSProperties}>
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">D-NAV score</p>
                  <h3 className="text-xl font-semibold text-white">See the score before the market does.</h3>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">Live</div>
              </div>
              <p className="text-slate-300">
                Log one move or an entire portfolio. The score shows how much pressure your conviction can withstand — and where adaptation buys you stability.
              </p>
              <DistributionBars />
              <div className="rounded-2xl border border-white/5 bg-black/40 p-4 text-sm text-slate-200">
                <p className="font-semibold text-white">How to read it</p>
                <p className="mt-1 text-slate-300">
                  Bars rise as confidence earns the right to push harder. If Pressure creeps ahead of Return, the system flags an adaptation window before you torch stability.
                </p>
              </div>
            </div>
          </GlassPanel>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <GlassPanel className="p-6 md:p-7 animate-fade-up" style={{ "--delay": "0.18s" } as CSSProperties}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                Archetypes
              </div>
              <h3 className="text-xl font-semibold text-white">Name the pattern, then decide.</h3>
              <p className="text-slate-300">
                Aggressor, Stabilizer, Hedged, or Drifter — each archetype clarifies whether you should double down, cool down, or gather proof.
              </p>
              <ul className="space-y-2 text-slate-200">
                <li className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />Spot how pressure warps your calls.
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden />Map the next move to the archetype — not to ego.
                </li>
              </ul>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6 md:p-7 animate-fade-up" style={{ "--delay": "0.22s" } as CSSProperties}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                Compare + Adaptation
              </div>
              <h3 className="text-xl font-semibold text-white">Side-by-side, then shift before it snaps.</h3>
              <p className="text-slate-300">
                Compare entities across the same RPS grammar. When drift shows up, adaptation windows keep the move alive without heavy resets.
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
                <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Compare</p>
                  <p className="text-slate-200">Find the pressure that’s choking Return.</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Adapt</p>
                  <p className="text-slate-200">Move to a calmer archetype without losing speed.</p>
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </section>
  );
}

function AudienceSection() {
  const audiences = [
    {
      title: "Founders & Execs",
      copy: "Separate conviction from charisma. Turn board debates into Return, Pressure, Stability trade-offs.",
    },
    {
      title: "Traders & Investors",
      copy: "See if your edge is drift or signal. Track judgment across regimes before the drawdown hits.",
    },
    {
      title: "Operators & Product Leads",
      copy: "Prioritize with proof. Avoid burning stability on reactive, high-pressure roadmap calls.",
    },
    {
      title: "Consultants & Analysts",
      copy: "Turn client chaos into a decision audit. Deliver reports with a repeatable decision language.",
    },
  ];

  return (
    <section className="bg-[#050608] py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-6 space-y-10">
        <SectionHeading
          title="Built for people who live in the unknown"
          subtitle="If you make calls before the data is clean, D-NAV is your mirror."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {audiences.map((item, index) => (
            <GlassPanel key={item.title} className="h-full p-5 animate-fade-up" style={{ "--delay": `${0.08 + index * 0.04}s` } as CSSProperties}>
              <div className="flex h-full flex-col gap-3">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-slate-300 flex-1">{item.copy}</p>
              </div>
            </GlassPanel>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="bg-[#040507] py-16 md:py-20">
      <div className="max-w-5xl mx-auto px-6">
        <GlassPanel className="animate-fade-up" style={{ "--delay": "0.12s" } as CSSProperties}>
          <div className="p-10 sm:p-12 space-y-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Run one decision. See if it holds.</h2>
            <p className="text-lg text-slate-300 max-w-3xl mx-auto">
              Log a single decision and watch the score. When the pressure shifts, adapt with intent — not with hope.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="text-lg px-8 py-6 bg-amber-500 text-black hover:bg-amber-400 focus-visible:ring-amber-300"
                asChild
              >
                <Link href="/calculator">Run a Decision Check</Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 border-white/30 bg-slate-900/70 text-white hover:bg-white/10 focus-visible:ring-amber-300"
                asChild
              >
                <Link href="/contact">Book a Decision Audit</Link>
              </Button>
            </div>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="bg-[#050608] text-white">
      <HeroSection />
      <ProofStrip />
      <UnderTheHoodSection />
      <AudienceSection />
      <FinalCTASection />
    </main>
  );
}
