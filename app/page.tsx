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
      badge: "Diagnostic lens",
      title: "What actually drives this decision",
      copy: "Breaks a decision into five variables so hidden pressure and weak assumptions become visible.",
    },
    {
      badge: "Pattern recognition",
      title: "Cross-engagement patterns",
      copy: "Reveals how decisions cluster over time—where judgment is stable, strained, or inconsistent.",
    },
    {
      badge: "Contrast",
      title: "Stress-test judgment",
      copy: "Compares decisions across domains to expose imbalance before it becomes failure.",
    },
  ];

  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackground />
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 space-y-12">
        <div className="flex flex-col items-start animate-fade-up" style={{ "--delay": "0s" } as CSSProperties}>
          <div className="self-center mb-12 md:mb-14 lg:mb-16">
            <Image
              src="/mockups/OrangeHeaderDelta.png"
              alt="D-NAV header logo"
              width={1536}
              height={1024}
              className="w-[200px] sm:w-[240px] lg:w-[280px] max-w-[320px] h-auto"
              priority
            />
          </div>

          <div className="space-y-6 md:space-y-7 w-full max-w-4xl">
            <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">Decisions fail long before execution. D-NAV shows you where.</h1>
            <p className="text-xl text-slate-200 max-w-3xl">D-NAV helps you see the pressure, return, and stability behind decisions—before momentum locks in.</p>
            <div className="space-y-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Button
                  size="lg"
                  className="h-11 w-full sm:w-auto px-6 text-base font-semibold bg-amber-500 text-black hover:bg-amber-400 focus-visible:ring-amber-300 shadow-[0_12px_40px_-20px_rgba(249,115,22,0.8)]"
                  asChild
                >
                  <Link href="/stress-test">
                    Stress Test a Decision
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10 w-full sm:w-auto px-4 text-sm font-medium text-slate-200 hover:text-amber-200 hover:bg-white/5 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608]"
                  asChild
                >
                  <Link href="/contact">Request a pre-commitment review</Link>
                </Button>
              </div>
              <p className="text-sm text-slate-400">One decision. Five variables. Immediate clarity.</p>
            </div>
            <p className="text-lg text-slate-300 max-w-3xl">
              Decisions rarely collapse because of effort. They fail because pressure, risk, and stability were never surfaced before commitment. D-NAV makes that friction visible early, so execution teams inherit a plan that has already survived scrutiny.
            </p>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Decision friction D-NAV removes:</p>
              <ul className="space-y-2 text-slate-200 text-sm">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                  <span>Endless debate without shared criteria</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                  <span>Confidence masquerading as certainty</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                  <span>Pressure discovered too late</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                  <span>Execution teams inheriting unresolved risk</span>
                </li>
              </ul>
              <p className="text-sm text-slate-300">These aren&apos;t execution problems. They&apos;re judgment problems.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 md:mt-12 lg:mt-14 animate-fade-up" style={{ "--delay": "0.08s" } as CSSProperties}>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-7 shadow-[0_18px_50px_-42px_rgba(0,0,0,0.9)] space-y-4">
            <h2 className="text-base md:text-lg font-semibold text-white uppercase tracking-[0.18em]">When D-NAV is the right tool</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-slate-200">
                <p className="text-base text-slate-200">
                  When decisions feel urgent, complex, or irreversible—and no one can clearly explain why they feel that way.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2 text-slate-200">
                <p className="text-base text-slate-200">
                  D-NAV surfaces the pressure, return, and stability dynamics already shaping the outcome.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 animate-fade-up" style={{ "--delay": "0.14s" } as CSSProperties}>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
              <Button
                size="lg"
                className="text-lg px-8 py-6 bg-amber-500 text-black hover:bg-amber-400 focus-visible:ring-amber-300 shadow-[0_12px_40px_-20px_rgba(249,115,22,0.8)]"
                asChild
              >
              <Link href="/stress-test">
                Stress Test a Decision
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 border-white/25 bg-slate-900 text-white hover:bg-white/10 hover:border-amber-300/60 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608]"
              asChild
            >
              <Link href="/contact">Request a pre-commitment review</Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-lg px-8 py-6 text-white hover:bg-white/10 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608]"
              asChild
            >
              <Link href="#quick-start">See the system grammar</Link>
            </Button>
          </div>
          <p className="text-sm text-slate-400">Engagements begin with one decision and expand into audits and consulting work.</p>
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
          Engagements include Decision Checks, audits, and pre-commitment reviews delivered with the same system language.
        </p>
      </div>
    </section>
  );
}

function ExecutiveReadoutSection() {
  return (
    <section className="bg-[#050608] py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-4 md:space-y-6">
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-200">Executive Readout</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight text-white">A pre-commitment decision brief, built to survive scrutiny.</h2>
            <div className="space-y-3 text-slate-200">
              <p>Built for boardrooms, diligence reviews, and executive sessions where judgment must be defensible.</p>
              <p>D-NAV translates the system grammar into a concise brief that makes pressure, risk, and stability legible before any commitment.</p>
              <p>It shows how judgment is applied, where hidden pressure sits, and whether stability can absorb the move — the evidence executives expect in the room.</p>
              <p>The readout is a consulting deliverable designed to reduce slideware and eliminate post-hoc storytelling.</p>
              <p>The goal is a plan that has already survived questioning.</p>
            </div>
            <p className="text-sm text-slate-400">The readout is a consulting deliverable that makes the decision legible before execution.</p>
          </div>

          <div className="relative flex justify-center md:justify-end">
            <Image
              src="/mockups/compreport.png"
              alt="D-NAV Executive Readout"
              width={1360}
              height={900}
              className="w-full max-w-[1100px] h-auto md:w-[115%] lg:w-[135%] lg:translate-x-10 lg:-mr-16 drop-shadow-[0_32px_120px_rgba(0,0,0,0.45)]"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function EntityCompareSection() {
  return (
    <section className="bg-[#050608] py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid gap-10 lg:gap-16 md:grid-cols-2 md:items-center">
          <div className="relative flex justify-center md:justify-start lg:justify-start">
            <Image
              src="/mockups/compentity.png"
              alt="D-NAV Entity Compare"
              width={1480}
              height={960}
              className="relative z-10 w-full max-w-[1100px] h-auto md:w-[115%] lg:w-[135%] lg:-translate-x-10 lg:-ml-16 drop-shadow-[0_32px_120px_rgba(0,0,0,0.45)]"
              priority
            />
          </div>

          <div className="space-y-4 md:space-y-6">
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-200">Entity Compare</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight text-white">Judgment becomes clear when contrasted.</h2>
            <div className="space-y-3 text-slate-200">
              <p>Once decisions share the same system language, comparison moves from opinion to evidence.</p>
              <p>D-NAV stacks teams, strategies, or domains side-by-side to reveal where judgment earns return and where it quietly accumulates pressure before the work starts.</p>
              <p>What appears solid in isolation often fractures under contrast — the moment to adapt before commitment, not after.</p>
            </div>
            <p className="text-sm text-slate-400">Same decision language. Very different outcomes.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function UnderTheHoodSection() {
  return (
    <section id="quick-start" className="bg-[#040507] py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-6 space-y-10">
        <SectionHeading title="Under the hood: RPS + D-NAV" align="left" eyebrow="System grammar" />

        <p className="text-slate-300 text-base max-w-3xl animate-fade-up" style={{ "--delay": "0.04s" } as CSSProperties}>
          D-NAV doesn&apos;t tell you what to decide. It shows you how your decisions behave under pressure.
        </p>
        <p className="text-slate-300 text-base max-w-3xl animate-fade-up" style={{ "--delay": "0.06s" } as CSSProperties}>
          Return, Pressure, and Stability describe the geometry of a decision—not its outcome.
        </p>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <GlassPanel className="p-6 md:p-8 animate-fade-up" style={{ "--delay": "0.08s" } as CSSProperties}>
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                RPS + D-NAV
              </div>
              <h3 className="text-2xl font-semibold text-white">RPS is the internal signal. D-NAV is the consulting readout.</h3>
              <p className="text-slate-300">
                One language for Return, Pressure, Stability. Inputs are captured once, then translated into decision checks, audits, and pre-commitment briefs with the same score. The internal frame is Merit (Impact − Cost − Risk) and Energy (Urgency × Confidence); the readout is Return, Pressure, and Stability.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <TrendingUp className="h-4 w-4 text-emerald-300" aria-hidden />
                    Return
                  </div>
                  <p className="mt-1 text-xs text-slate-300">Upside after cost and risk.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Activity className="h-4 w-4 text-amber-300" aria-hidden />
                    Pressure
                  </div>
                  <p className="mt-1 text-xs text-slate-300">Where urgency and confidence strain the plan.</p>
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
                <p className="font-semibold text-white">RPS turns five inputs into internal logic and a consulting readout:</p>
                <ul className="space-y-1 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
                    <span>
                      <span className="font-semibold text-white">Merit</span> = Impact − Cost − Risk
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                    <span>
                      <span className="font-semibold text-white">Energy</span> = Urgency × Confidence
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden />
                    <span>
                      <span className="font-semibold text-white">Return, Pressure, Stability</span> translate Merit and Energy for the consulting brief.
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
                D-NAV is the consulting readout. Merit = Impact − Cost − Risk. Energy = Urgency × Confidence. Pressure and Stability show where Energy strains the plan. Together, they reveal whether the Merit holds and whether the team can carry it.
              </p>
              <div className="rounded-2xl border border-white/5 bg-black/40 p-4 space-y-2">
                <p className="text-sm font-semibold text-white">D-NAV = Merit + Energy</p>
                <p className="text-sm text-slate-300">Merit = Impact − Cost − Risk. Energy = Urgency × Confidence.</p>
              </div>
              <RpsDistributions />
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  className="w-full justify-center border border-white/15 bg-white/10 text-white hover:bg-white/15 focus-visible:ring-amber-300"
                  asChild
                >
                  <Link href="/stress-test">Stress Test a Decision</Link>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-center border border-white/15 bg-black/30 text-white hover:bg-white/10 focus-visible:ring-amber-300"
                  asChild
                >
                  <Link href="/contact">Request a decision audit</Link>
                </Button>
              </div>
            </div>
          </GlassPanel>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <GlassPanel className="p-6 md:p-7 animate-fade-up" style={{ "--delay": "0.18s" } as CSSProperties}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                Pattern recognition
              </div>
              <h3 className="text-xl font-semibold text-white">Pattern recognition across engagements.</h3>
              <p className="text-slate-300">
                Breakthrough, Drift, Strain, or Coast — drawn from recurring engagements. Patterns show whether performance is repeating or sliding before you commit.
              </p>
              <p className="text-sm text-slate-400">Descriptive, not prescriptive — they flag when to adapt or defend.</p>
              <ul className="space-y-2 text-slate-200">
                <li className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />Spot recurring pressure spikes across similar calls.
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden />See what repeatedly creates stability.
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />Catch drift early and know when to adapt versus advance.
                </li>
              </ul>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6 md:p-7 animate-fade-up" style={{ "--delay": "0.22s" } as CSSProperties}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                Contrast
              </div>
              <h3 className="text-xl font-semibold text-white">Compare</h3>
              <p className="text-slate-300">Side-by-side stress tests show where plans break under pressure before commitment.</p>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
                <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Entity</p>
                  <p className="text-slate-200">Line up options to see what compresses Return or inflates Pressure.</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Adaptation</p>
                  <p className="text-slate-200">Watch inputs drift and spot the adjustment window before stability snaps.</p>
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
  return (
    <section className="bg-[#050608] py-16 md:py-20">
      <div className="max-w-4xl mx-auto px-6 space-y-6 text-center">
        <SectionHeading title="Built for people who plan in uncertainty" />
        <p className="text-lg text-slate-200">
          D-NAV is used by people who make decisions before the data is clean—leaders, operators, coaches, and planners whose judgment shapes outcomes long before execution begins.
        </p>
        <div className="space-y-2 text-base text-slate-300">
          <p>Operators — balancing speed and stability under real constraints</p>
          <p>Leaders — making irreversible calls with incomplete information</p>
          <p>Coaches — diagnosing judgment patterns, not just results</p>
        </div>
        <div className="flex justify-center">
          <Button
            variant="ghost"
            className="text-white hover:text-amber-200 hover:bg-white/5 focus-visible:ring-amber-300"
            asChild
          >
            <Link href="/use-cases">
              View use cases
              <span aria-hidden className="ml-1">
                →
              </span>
            </Link>
          </Button>
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
            <h2 className="text-3xl md:text-4xl font-bold text-white">Start with a decision check. Expand to an audit.</h2>
            <p className="text-lg text-slate-300 max-w-3xl mx-auto">
              Begin with one decision. If the pressure shows up, move into a decision audit or a pre-commitment consulting engagement.
            </p>
            <p className="text-sm text-slate-400">Built to serve advisory, diligence, and boardroom contexts.</p>
            <p className="text-lg text-slate-200">
              You don&apos;t need better answers.
              <br />
              You need better questions earlier.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="text-lg px-8 py-6 bg-amber-500 text-black hover:bg-amber-400 focus-visible:ring-amber-300"
                asChild
              >
                <Link href="/stress-test">Stress Test a Decision</Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 border-white/30 bg-slate-900/70 text-white hover:bg-white/10 focus-visible:ring-amber-300"
                asChild
              >
                <Link href="/contact">Book a Decision Audit</Link>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-lg px-8 py-6 text-white hover:bg-white/10 focus-visible:ring-amber-300"
                asChild
              >
                <Link href="/contact">Schedule a consulting engagement</Link>
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
      <ExecutiveReadoutSection />
      <EntityCompareSection />
      <UnderTheHoodSection />
      <AudienceSection />
      <FinalCTASection />
    </main>
  );
}
