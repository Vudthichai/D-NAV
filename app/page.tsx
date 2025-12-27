"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { AnimatedCompass } from "@/components/animated-compass";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const noiseTexture =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48ZmlsdGVyIGlkPSdudCcgZmlsdGVyVW5pdHM9J3VzZXJTcGFjZU9uVXNlJyB4PScwJyB5PScwJz48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Jy4zJyBudW1PY3RhdmVzPSc0Jy8+PGZlQ29sb3JNYXRyaXggdHlwZT0nc2F0dXJhdGUnIHZhbHVlcz0nMCAwIDAgMCAwIDEgMCAwIDAgMCAwIDAgMCAwIDAgMC4xIDAgMCAwIDAgMCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJyBmaWx0ZXI9InVybCgjbnQpIiBvcGFjaXR5PScwLjQnLz48L3N2Zz4=\n";

function BackgroundGlow() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#04060f]" />
      <div className="absolute inset-0" style={{ backgroundImage: `url(${noiseTexture})` }} />
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="absolute right-0 top-10 h-[420px] w-[420px] rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="absolute -bottom-24 left-1/3 h-[500px] w-[500px] rounded-full bg-emerald-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,170,102,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(72,118,255,0.12),transparent_30%)]" />
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-60" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center space-y-4">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">{title}</h2>
      {subtitle ? <p className="text-lg text-slate-300 max-w-3xl mx-auto">{subtitle}</p> : null}
    </div>
  );
}

function MockupStack() {
  return (
    <div className="relative">
      <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-[28px] border border-white/15 bg-white/5 p-3 backdrop-blur-2xl shadow-[0_25px_80px_-40px_rgba(0,0,0,0.9)]">
        <div className="rounded-2xl bg-gradient-to-b from-white/5 to-black/40 p-1">
          <Image
            src="/mockups/Laptop-Report.png"
            alt="Laptop displaying the D-NAV decision report"
            width={900}
            height={650}
            className="h-full w-full rounded-xl object-cover"
            priority
          />
        </div>
      </div>
      <div className="hidden lg:block absolute -left-16 -bottom-10 w-[340px] rotate-[-6deg] overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-3 backdrop-blur-2xl shadow-[0_25px_80px_-40px_rgba(0,0,0,0.85)]">
        <div className="rounded-2xl bg-gradient-to-b from-white/5 to-black/40 p-1">
          <Image
            src="/mockups/Computer-Report.png"
            alt="Desktop mockup showing the D-NAV executive readout"
            width={900}
            height={650}
            className="h-full w-full rounded-2xl object-cover"
          />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04060f] text-white">
      <BackgroundGlow />

      <header className="flex justify-end items-center px-6 py-6 max-w-7xl mx-auto">
        <ThemeToggle />
      </header>

      <section className="relative pb-20 pt-10 sm:pt-16 lg:pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />
        <div className="max-w-6xl mx-auto px-6 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center relative">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-200 backdrop-blur">
              <AnimatedCompass />
              <span>Decision NAVigator</span>
            </div>
            <div className="space-y-6">
              <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">
                Track your judgment like a performance metric.
              </h1>
              <p className="text-xl text-slate-300 leading-relaxed">
                In 60 seconds, see whether your decision survives pressure.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="text-lg px-8 py-6 bg-amber-400 text-black hover:bg-amber-300 focus-visible:ring-amber-300"
                asChild
              >
                <Link href="/calculator">
                  Run a Decision Check
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-lg px-8 py-6 text-white border-white/20 hover:bg-white/10 focus-visible:ring-amber-300"
                asChild
              >
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="text-sm text-slate-400">Start with a decision you’re avoiding.</p>
          </div>

          <div className="relative">
            <div className="absolute -inset-10 rounded-full bg-amber-500/10 blur-3xl" />
            <MockupStack />
          </div>
        </div>
      </section>

      <section id="product-proof" className="relative py-20">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <SectionHeading
            title="Product proof"
            subtitle="See how the readouts land in the real world: high-fidelity views you can take into any executive room."
          />
          <div className="grid gap-8 md:grid-cols-3">
            <GlassCard className="group">
              <div className="space-y-4 p-6">
                <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-amber-200">
                  <span>Executive Readout</span>
                  <div className="h-px flex-1 ml-4 bg-gradient-to-r from-amber-200/50 to-transparent" />
                </div>
                <p className="text-slate-200">
                  Translate noisy decisions into a single readout leaders can act on immediately.
                </p>
              </div>
              <div className="px-6 pb-6">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <Image
                    src="/mockups/Computer-Report.png"
                    alt="Executive readout mockup"
                    width={900}
                    height={650}
                    className="w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                </div>
              </div>
            </GlassCard>
            <GlassCard className="group">
              <div className="space-y-4 p-6">
                <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-amber-200">
                  <span>Entity Compare</span>
                  <div className="h-px flex-1 ml-4 bg-gradient-to-r from-amber-200/50 to-transparent" />
                </div>
                <p className="text-slate-200">
                  Stack decisions side by side to see which bets are resilient versus fragile.
                </p>
              </div>
              <div className="px-6 pb-6">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <Image
                    src="/mockups/Computer-Entity.png"
                    alt="Entity compare mockup"
                    width={900}
                    height={650}
                    className="w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                </div>
              </div>
            </GlassCard>
            <GlassCard className="group">
              <div className="space-y-4 p-6">
                <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-amber-200">
                  <span>Adaptation</span>
                  <div className="h-px flex-1 ml-4 bg-gradient-to-r from-amber-200/50 to-transparent" />
                </div>
                <p className="text-slate-200">
                  Track how confidence and risk evolve so the plan adapts before pressure breaks it.
                </p>
              </div>
              <div className="px-6 pb-6">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <Image
                    src="/mockups/Computer-Adaptation.png"
                    alt="Adaptation mockup"
                    width={900}
                    height={650}
                    className="w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      <section id="quick-start" className="relative py-20">
        <div className="max-w-6xl mx-auto px-6">
          <GlassCard>
            <div className="p-10 sm:p-12 text-center space-y-12">
              <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold text-white">What you can do in the next 60 seconds</h2>
                <p className="text-lg text-slate-300">Pick one decision and see if it survives.</p>
              </div>
              <ol className="text-left space-y-8 text-lg text-slate-300 list-decimal list-inside">
                <li>
                  <strong className="text-white">Pick one live decision.</strong> Expansion, hire, product bet, trade — anything that actually matters.
                </li>
                <li>
                  <strong className="text-white">Rate it honestly.</strong> Move sliders for Impact, Cost, Risk, Urgency, and Confidence. No posture. Just the tension you feel.
                </li>
                <li>
                  <strong className="text-white">See if the bet is built to survive.</strong> D-NAV turns it into Return, Pressure, and Stability you can act on immediately.
                </li>
              </ol>
              <div className="flex justify-center">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 bg-amber-400 text-black hover:bg-amber-300 focus-visible:ring-amber-300"
                  asChild
                >
                  <Link href="/calculator">Run a Decision Check</Link>
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      <section id="how-it-works" className="relative py-20">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <SectionHeading
            title="Under the hood: RPS + D-NAV"
            subtitle="Five forces become three signals and one readout. It stays simple even when the stakes aren’t."
          />
          <div className="grid gap-10 md:grid-cols-2">
            <GlassCard>
              <div className="space-y-6 p-8">
                <h3 className="text-2xl font-semibold text-white">The three core signals (RPS)</h3>
                <ul className="space-y-6 text-slate-300">
                  <li>
                    <strong className="text-white">Return</strong> = Impact − Cost
                    <br />Is the upside worth the burn?
                  </li>
                  <li>
                    <strong className="text-white">Stability</strong> = Confidence − Risk
                    <br />Can your evidence outlast the downside?
                  </li>
                  <li>
                    <strong className="text-white">Pressure</strong> = Urgency − Confidence
                    <br />Is execution being driven by panic or proof?
                  </li>
                </ul>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="space-y-4 p-8">
                <h3 className="text-2xl font-semibold text-white">The D-NAV score</h3>
                <p className="text-slate-300">
                  RPS is the physics of the bet. D-NAV is the readout.
                </p>
                <p className="text-slate-300">
                  It synthesizes Return, Pressure, and Stability into a fast signal of how your decision behaves under stress — so you know if you’re forcing fragility or underplaying real edge.
                </p>
                <div className="pt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-lg px-8 py-6 border-white/30 text-white hover:bg-white/10 focus-visible:ring-amber-300"
                    asChild
                  >
                    <Link href="/calculator">Run a Decision Check</Link>
                  </Button>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      <section className="relative py-20">
        <div className="max-w-6xl mx-auto px-6">
          <GlassCard>
            <div className="p-10 sm:p-12 space-y-6 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white">Judgment compounds — if you track it.</h2>
              <p className="text-lg text-slate-300 max-w-3xl mx-auto">
                One decision shows tension. Ten decisions show patterns. A hundred decisions reveal constraints.
              </p>
              <p className="text-base text-slate-300 max-w-3xl mx-auto">
                Over time, D-NAV shows when your confidence is earned — and when it’s cosplay.
              </p>
              <div className="flex justify-center">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 bg-amber-400 text-black hover:bg-amber-300 focus-visible:ring-amber-300"
                  asChild
                >
                  <Link href="/calculator">Run a Decision Check</Link>
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      <section id="where-data-ends" className="relative py-20">
        <div className="max-w-6xl mx-auto px-6">
          <GlassCard>
            <div className="p-10 sm:p-12 space-y-8 text-center">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">Where dashboards end, judgment begins</h2>
                <p className="text-lg text-slate-300">
                  Dashboards show what has already happened. D-NAV measures the internal math of the bets you’re about to make.
                </p>
              </div>
              <ul className="space-y-6 text-left text-slate-300">
                <li>
                  <strong className="text-white">Tesla Gigafactory:</strong> On paper, a capital-intensive nightmare. In reality, a judgment call about how much risk, urgency, and conviction could be carried at once.
                </li>
                <li>
                  <strong className="text-white">Amazon → AWS:</strong> Looked like a distraction. It was actually a high-impact, high-stability bet hiding inside an “experiment.”
                </li>
                <li>
                  <strong className="text-white">WeWork:</strong> Great surface-level metrics. Fragile judgment underneath. Pressure and risk completely outpaced real stability.
                </li>
                <li>
                  <strong className="text-white">Enron:</strong> The numbers looked fine. The internal decision math was fake. No amount of reporting could save that.
                </li>
              </ul>
              <p className="text-base text-slate-300">
                D-NAV doesn’t predict outcomes. It flags fragile internal math before the outcome arrives.
              </p>
            </div>
          </GlassCard>
        </div>
      </section>

      <section id="who-its-for" className="relative py-20">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <SectionHeading
            title="Built for people who live in the unknown"
            subtitle="Different arenas, same problem: your judgment has to perform before the data does."
          />
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {["Founders & Execs", "Traders & Investors", "Operators & Product Leads", "Consultants & Analysts"].map(
              (title, index) => {
                const copy = [
                  "Stop making “vision calls” you can’t explain. Turn strategy debates into clear Return, Pressure, and Stability trade-offs. See if your conviction is earned or just loud.",
                  "Separate itchy trigger finger from real edge. See if you’re stacking fragile high-pressure bets. Track your judgment drift across market regimes.",
                  "Prioritize roadmap moves by impact versus execution drag. Avoid drowning in reactive, high-pressure decisions. Train teams to push without quietly torching stability.",
                  "Turn stakeholder chaos into structured decision audits. Show clients how their judgment patterns bleed value. Deliver reports with a repeatable decision language.",
                ];
                return (
                  <GlassCard key={title} className="h-full">
                    <div className="p-6 space-y-3">
                      <h3 className="text-xl font-semibold text-white">{title}</h3>
                      <p className="text-slate-300">{copy[index]}</p>
                    </div>
                  </GlassCard>
                );
              }
            )}
          </div>
          <div className="space-y-4 text-center">
            <p className="text-base text-slate-300">
              If your job is to make calls before the data is clean, D-NAV is your mirror.
            </p>
            <Button
              size="lg"
              className="text-lg px-8 py-6 bg-amber-400 text-black hover:bg-amber-300 focus-visible:ring-amber-300"
              asChild
            >
              <Link href="/calculator">Run a Decision Check</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="principles" className="relative py-20">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeading
            title="How D-NAV changes the way you decide"
            subtitle="Keep scrolling if you want the philosophy behind the tool."
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-10">
            {["Challenge the Known", "Audit the Gut", "Train for Volatility", "Align the Team", "Protect the Downside", "Capture the Win Rate"].map(
              (title, index) => {
                const copy = [
                  "Use D-NAV when the model says “wait” but you know delay kills momentum. Quantify the conviction others call irrational.",
                  "Surface bias, overconfidence, and hidden fragility before they surface as losses. Judgment improves when it is interrogated.",
                  "Build a decision log that treats chaos as a training set. Iterate until your response time beats the rate of change.",
                  "Give founders, operators, and investors a shared language for why a move is bold—or reckless. Make the debate precise.",
                  "Stress-test cost and risk before they metastasize. D-NAV forces the hard questions before capital is committed.",
                  "Track which calls outperformed their data. The pattern is your edge. Defend it with evidence, not folklore.",
                ];
                return (
                  <GlassCard key={title}>
                    <div className="p-6 space-y-4 h-full">
                      <h3 className="text-xl font-semibold text-white">{title}</h3>
                      <p className="text-slate-300">{copy[index]}</p>
                    </div>
                  </GlassCard>
                );
              }
            )}
          </div>
        </div>
      </section>

      <section className="relative py-20">
        <div className="max-w-5xl mx-auto text-center px-6 space-y-6">
          <GlassCard>
            <div className="p-10 sm:p-12 space-y-6">
              <h2 className="text-3xl font-bold text-white">Run one decision. See if it holds.</h2>
              <p className="text-lg text-slate-300">
                Run one live decision, then ten, then a hundred. Watch your judgment evolve from gut feel to a measurable edge.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 bg-amber-400 text-black hover:bg-amber-300 focus-visible:ring-amber-300"
                  asChild
                >
                  <Link href="/calculator">Run a Decision Check</Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-6 border-white/30 text-white hover:bg-white/10 focus-visible:ring-amber-300"
                  asChild
                >
                  <Link href="/contact">Book a Decision Audit</Link>
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      <section className="relative py-20">
        <div className="max-w-6xl mx-auto px-6">
          <GlassCard>
            <div className="p-10 sm:p-12 space-y-6">
              <SectionHeading
                title="What you get in a consultation"
                subtitle="Every session is structured, fast, and leaves you with tangible artifacts."
              />
              <ul className="grid gap-4 md:grid-cols-2 text-left text-slate-300">
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" aria-hidden />
                  <span>We break down the physics of a decision (Impact, Cost, Risk, Urgency, Confidence)</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" aria-hidden />
                  <span>We explain Return / Pressure / Stability (RPS) and Archetypes</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" aria-hidden />
                  <span>We review 10+ real decisions together</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" aria-hidden />
                  <span>You leave with a template you can keep updating</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" aria-hidden />
                  <span>You receive a recap + “brochure” style references (D-NAV, RPS, archetypes, patterns)</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" aria-hidden />
                  <span>We schedule a second session to review Entity + Compare (and Adaptation)</span>
                </li>
              </ul>
            </div>
          </GlassCard>
        </div>
      </section>

      <footer className="py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-sm text-slate-400 text-center md:text-left">
            Human progress happens where data runs out. D-NAV measures the quality of that leap.
          </p>
        </div>
      </footer>
    </main>
  );
}
