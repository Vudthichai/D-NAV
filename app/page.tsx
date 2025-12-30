"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowRight, Shield, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RpsDistributions } from "@/components/RpsDistributions";

const noiseTexture =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48ZmlsdGVyIGlkPSdudCcgZmlsdGVyVW5pdHM9J3VzZXJTcGFjZU9uVXNlJyB4PScwJyB5PScwJz48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Jy4zJyBudW1PY3RhdmVzPSc0Jy8+PGZlQ29sb3JNYXRyaXggdHlwZT0nc2F0dXJhdGUnIHZhbHVlcz0nMCAwIDAgMCAwIDEgMCAwIDAgMCAwIDAgMCAwIDAgMC4xIDAgMCAwIDAgMCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJyBmaWx0ZXI9InVybCgjbnQpIiBvcGFjaXR5PScwLjQnLz48L3N2Zz4=\n";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
  children?: ReactNode;
};

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

function GlassPanel({ children, className, ...rest }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.8)] backdrop-blur-xl",
        className,
      )}
      {...rest}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-40" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  align = "center",
  eyebrow = "Decision NAVigator",
}: { title: string; subtitle?: string; align?: "center" | "left"; eyebrow?: string }) {
  const alignmentClass = align === "center" ? "text-center" : "text-left";
  const widthClass = align === "center" ? "mx-auto" : "";

  return (
    <div className={`space-y-3 ${alignmentClass}`}>
      {eyebrow ? <p className="text-xs uppercase tracking-[0.3em] text-amber-200">{eyebrow}</p> : null}
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">{title}</h2>
      {subtitle ? <p className={`text-lg text-slate-300 max-w-3xl ${widthClass}`}>{subtitle}</p> : null}
    </div>
  );
}

function HeroSection() {
  const signals = [
    {
      badge: "Physics",
      title: "Decision physics",
      copy: "Score Impact, Cost, Risk, Urgency, Confidence. We translate it into Return / Pressure / Stability so it’s instantly legible.",
    },
    {
      badge: "Patterns",
      title: "Archetypes",
      copy: "Once you log enough calls, D-NAV reveals your operating pattern — the way you earn Return, absorb Pressure, and protect Stability.",
    },
    {
      badge: "Compare",
      title: "Compare",
      copy: "Compare surfaces who’s under pressure. Use Entity Compare for side-by-side analysis, and Adaptation to track drift over time.",
    },
  ];

  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackground />
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 space-y-12">
        <div
          className="grid gap-8 lg:grid-cols-[auto,1fr] lg:items-start animate-fade-up"
          style={{ "--delay": "0s" } as CSSProperties}
        >
          <div className="flex justify-start lg:justify-center">
            <Image
              src="/mockups/D_NAVlogoclean.png"
              alt="D-NAV logo"
              width={1536}
              height={1024}
              className="w-[110px] md:w-[120px] h-auto"
              priority
            />
          </div>

          <div className="space-y-7">
            <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">Clarity in uncertainty — measured.</h1>
            <p className="text-xl text-slate-200 max-w-3xl">
              D-NAV turns your gut call into a score, shows what’s driving it, and tells you what to change before you commit.
            </p>
          </div>
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
              className="text-lg px-8 py-6 border-white/25 bg-slate-900 text-white hover:bg-white/10 hover:border-amber-300/60 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608]"
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
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                {item.badge}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-slate-300">{item.copy}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-slate-300 animate-fade-up" style={{ "--delay": "0.32s" } as CSSProperties}>
          Start with one real decision. The system gets sharper as you log.
        </p>
      </div>
    </section>
  );
}

function ProofStrip() {
  const items = [
    {
      title: "Executive Readout",
      description: "Turn noise into a one-page decision brief: RPS baseline, distributions, and what to do next.",
      image: "/mockups/Laptop-Report.png",
    },
    {
      title: "Entity Compare",
      description: "Stack companies, teams, bets, or options side-by-side. See where pressure is choking return.",
      image: "/mockups/Laptop-Entity.png",
    },
    {
      title: "Adaptation",
      description: "Watch urgency, risk, and confidence drift. Catch instability early.",
      image: "/mockups/Laptop-Adaptation.png",
    },
  ];

  return (
    <section className="bg-[#050608] pb-16">
      <div className="max-w-6xl mx-auto px-6 space-y-6">
        <GlassPanel className="p-6 md:p-8 animate-fade-up" style={{ "--delay": "0.12s" } as CSSProperties}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.2em] text-amber-200">Executive Readouts</p>
                <h3 className="text-2xl font-semibold text-white">Executive readouts you can walk into a room with.</h3>
                <p className="text-slate-300 max-w-3xl">One decision language. Three views: readout, compare, adaptation.</p>
              </div>
              <div className="text-sm text-slate-300 max-w-sm">
                Built to replace the deck thrash. Every surface echoes the same grammar: Return, Pressure, Stability.
              </div>
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
                  <div className="mt-4 relative rounded-xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/10 p-2 shadow-[0_20px_50px_-45px_rgba(0,0,0,0.9)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/0 opacity-40" />
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={720}
                      height={460}
                      className="relative z-10 w-full rounded-lg border border-white/10 object-cover shadow-lg"
                    />
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

function UnderTheHoodSection() {
  return (
    <section id="quick-start" className="bg-[#040507] py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-6 space-y-10">
        <SectionHeading
          title="Under the hood: RPS + D-NAV"
          subtitle="RPS is the signal. D-NAV is the readout."
          align="left"
          eyebrow="System grammar"
        />

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <GlassPanel className="p-6 md:p-8 animate-fade-up" style={{ "--delay": "0.08s" } as CSSProperties}>
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                RPS + D-NAV
              </div>
              <h3 className="text-2xl font-semibold text-white">RPS is the signal. D-NAV is the readout.</h3>
              <p className="text-slate-300">
                One language for every view: Return, Pressure, Stability. Capture the inputs once, then read the score the same way across readouts, comparisons, and adaptations.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <TrendingUp className="h-4 w-4 text-emerald-300" aria-hidden />
                    Return
                  </div>
                  <p className="mt-1 text-xs text-slate-300">Upside after cost.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Activity className="h-4 w-4 text-amber-300" aria-hidden />
                    Pressure
                  </div>
                  <p className="mt-1 text-xs text-slate-300">Execution stress.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Shield className="h-4 w-4 text-sky-300" aria-hidden />
                    Stability
                  </div>
                  <p className="mt-1 text-xs text-slate-300">Downside tolerance.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2 text-sm text-slate-200">
                <p className="font-semibold text-white">RPS turns five inputs into three signals:</p>
                <ul className="space-y-1 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
                    <span>
                      <span className="font-semibold text-white">Return</span> = Impact − Cost
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                    <span>
                      <span className="font-semibold text-white">Pressure</span> = Urgency − Confidence
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden />
                    <span>
                      <span className="font-semibold text-white">Stability</span> = Confidence − Risk
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6 md:p-8 animate-fade-up" style={{ "--delay": "0.14s" } as CSSProperties}>
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">D-NAV Score</p>
                  <h3 className="text-xl font-semibold text-white">See the score before the market does.</h3>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">Live</div>
              </div>
              <p className="text-slate-300">
                D-NAV is your decision’s readout. Value = Impact − Cost − Risk. Execution = Urgency × Confidence. Together, they show whether the upside is real — and whether you can actually carry it.
              </p>
              <div className="rounded-2xl border border-white/5 bg-black/40 p-4 space-y-2">
                <p className="text-sm font-semibold text-white">D-NAV = Value + Execution</p>
                <p className="text-sm text-slate-300">Value = Impact − Cost − Risk. Execution = Urgency × Confidence.</p>
              </div>
              <RpsDistributions />
              <Button
                variant="secondary"
                className="w-full justify-center border border-white/15 bg-white/10 text-white hover:bg-white/15 focus-visible:ring-amber-300"
                asChild
              >
                <Link href="/calculator">Run a Decision Check</Link>
              </Button>
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
                Breakthrough, Drift, Strain, or Coast — all pulled from the definitions you already use. Each archetype clarifies whether to double down, cool down, or gather proof.
              </p>
              <ul className="space-y-2 text-slate-200">
                <li className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />Spot what spikes Pressure.
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden />See what creates Stability.
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />Know when to adapt vs double down.
                </li>
              </ul>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6 md:p-7 animate-fade-up" style={{ "--delay": "0.22s" } as CSSProperties}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                Compare
              </div>
              <h3 className="text-xl font-semibold text-white">Side-by-side, then shift before it snaps.</h3>
              <p className="text-slate-300">
                Compare surfaces who’s under pressure. Use Entity Compare for side-by-side analysis, and Adaptation to track drift over time.
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
                <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Entity</p>
                  <p className="text-slate-200">Line up options and see what’s compressing Return or inflating Pressure.</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Adaptation</p>
                  <p className="text-slate-200">Watch inputs drift and spot the adjustment window before the move degrades.</p>
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
