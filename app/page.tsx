"use client";

import { AnimatedCompass } from "@/components/animated-compass";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header with Theme Toggle */}
      <header className="flex justify-end items-center p-4 shrink-0">
        <ThemeToggle />
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-br from-background via-background to-muted/20 flex-1 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col items-center gap-4">
              <AnimatedCompass />
              <p className="uppercase tracking-[0.3em] text-xs text-muted-foreground">Decision NAVigator</p>
            </div>
            <div className="space-y-6">
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground">
                Track your judgment like a performance metric.
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                In 60 seconds, see whether your decision survives pressure.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="/calculator">
                  Run a Decision Check
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Start with a decision you’re avoiding.</p>
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section id="quick-start" className="py-24 bg-muted/20">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">What you can do in the next 60 seconds</h2>
            <p className="text-lg text-muted-foreground">Pick one decision and see if it survives.</p>
          </div>
          <ol className="text-left space-y-8 text-lg text-muted-foreground">
            <li>
              <strong className="text-foreground">Pick one live decision.</strong> Expansion, hire, product bet, trade — anything that actually matters.
            </li>
            <li>
              <strong className="text-foreground">Rate it honestly.</strong> Move sliders for Impact, Cost, Risk, Urgency, and Confidence. No posture. Just the tension you feel.
            </li>
            <li>
              <strong className="text-foreground">See if the bet is built to survive.</strong> D-NAV turns it into Return, Pressure, and Stability you can act on immediately.
            </li>
          </ol>
          <div className="flex justify-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/calculator">Run a Decision Check</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Under the hood: RPS + D-NAV</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Five forces become three signals and one readout. It stays simple even when the stakes aren’t.
            </p>
          </div>
          <div className="grid gap-12 md:grid-cols-2">
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-foreground">The three core signals (RPS)</h3>
              <ul className="space-y-6 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Return</strong> = Impact − Cost
                  <br />Is the upside worth the burn?
                </li>
                <li>
                  <strong className="text-foreground">Stability</strong> = Confidence − Risk
                  <br />Can your evidence outlast the downside?
                </li>
                <li>
                  <strong className="text-foreground">Pressure</strong> = Urgency − Confidence
                  <br />Is execution being driven by panic or proof?
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold text-foreground">The D-NAV score</h3>
              <p className="text-muted-foreground">
                RPS is the physics of the bet. D-NAV is the readout.
              </p>
              <p className="text-muted-foreground">
                It synthesizes Return, Pressure, and Stability into a fast signal of how your decision behaves under stress — so you know if you’re forcing fragility or underplaying real edge.
              </p>
            </div>
          </div>
          <div className="flex justify-center">
            <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/calculator">Run a Decision Check</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Compounding Section */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 space-y-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">Judgment compounds — if you track it.</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            One decision shows tension. Ten decisions show patterns. A hundred decisions reveal constraints.
          </p>
          <p className="text-base text-muted-foreground max-w-3xl mx-auto">
            Over time, D-NAV shows when your confidence is earned — and when it’s cosplay.
          </p>
          <div className="flex justify-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/calculator">Run a Decision Check</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Where Data Ends Section */}
      <section id="where-data-ends" className="py-24">
        <div className="max-w-5xl mx-auto px-6 space-y-8 text-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground">Where dashboards end, judgment begins</h2>
            <p className="text-lg text-muted-foreground">
              Dashboards show what has already happened. D-NAV measures the internal math of the bets you’re about to make.
            </p>
          </div>
          <ul className="space-y-6 text-left text-muted-foreground">
            <li>
              <strong className="text-foreground">Tesla Gigafactory:</strong> On paper, a capital-intensive nightmare. In reality, a judgment call about how much risk, urgency, and conviction could be carried at once.
            </li>
            <li>
              <strong className="text-foreground">Amazon → AWS:</strong> Looked like a distraction. It was actually a high-impact, high-stability bet hiding inside an “experiment.”
            </li>
            <li>
              <strong className="text-foreground">WeWork:</strong> Great surface-level metrics. Fragile judgment underneath. Pressure and risk completely outpaced real stability.
            </li>
            <li>
              <strong className="text-foreground">Enron:</strong> The numbers looked fine. The internal decision math was fake. No amount of reporting could save that.
            </li>
          </ul>
          <p className="text-base text-muted-foreground">
            D-NAV doesn’t predict outcomes. It flags fragile internal math before the outcome arrives.
          </p>
        </div>
      </section>

      {/* Who It's For Section */}
      <section id="who-its-for" className="py-24 bg-muted/20">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Built for people who live in the unknown</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Different arenas, same problem: your judgment has to perform before the data does.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="p-6 border rounded-2xl bg-card">
              <h3 className="text-xl font-semibold mb-3">Founders &amp; Execs</h3>
              <p className="text-muted-foreground">
                Stop making “vision calls” you can’t explain. Turn strategy debates into clear Return, Pressure, and Stability trade-offs. See if your conviction is earned or just loud.
              </p>
            </div>
            <div className="p-6 border rounded-2xl bg-card">
              <h3 className="text-xl font-semibold mb-3">Traders &amp; Investors</h3>
              <p className="text-muted-foreground">
                Separate itchy trigger finger from real edge. See if you’re stacking fragile high-pressure bets. Track your judgment drift across market regimes.
              </p>
            </div>
            <div className="p-6 border rounded-2xl bg-card">
              <h3 className="text-xl font-semibold mb-3">Operators &amp; Product Leads</h3>
              <p className="text-muted-foreground">
                Prioritize roadmap moves by impact versus execution drag. Avoid drowning in reactive, high-pressure decisions. Train teams to push without quietly torching stability.
              </p>
            </div>
            <div className="p-6 border rounded-2xl bg-card">
              <h3 className="text-xl font-semibold mb-3">Consultants &amp; Analysts</h3>
              <p className="text-muted-foreground">
                Turn stakeholder chaos into structured decision audits. Show clients how their judgment patterns bleed value. Deliver reports with a repeatable decision language.
              </p>
            </div>
          </div>
          <div className="space-y-4 text-center">
            <p className="text-base text-muted-foreground">
              If your job is to make calls before the data is clean, D-NAV is your mirror.
            </p>
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/calculator">Run a Decision Check</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section id="principles" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">How D-NAV changes the way you decide</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Keep scrolling if you want the philosophy behind the tool.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Challenge the Known</h3>
              <p className="text-muted-foreground">
                Use D-NAV when the model says “wait” but you know delay kills momentum. Quantify the conviction others call irrational.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Audit the Gut</h3>
              <p className="text-muted-foreground">
                Surface bias, overconfidence, and hidden fragility before they surface as losses. Judgment improves when it is interrogated.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Train for Volatility</h3>
              <p className="text-muted-foreground">
                Build a decision log that treats chaos as a training set. Iterate until your response time beats the rate of change.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Align the Team</h3>
              <p className="text-muted-foreground">
                Give founders, operators, and investors a shared language for why a move is bold—or reckless. Make the debate precise.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Protect the Downside</h3>
              <p className="text-muted-foreground">
                Stress-test cost and risk before they metastasize. D-NAV forces the hard questions before capital is committed.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Capture the Win Rate</h3>
              <p className="text-muted-foreground">
                Track which calls outperformed their data. The pattern is your edge. Defend it with evidence, not folklore.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section id="final-cta" className="py-24 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center px-6 space-y-6">
          <h2 className="text-3xl font-bold text-foreground">Run one decision. See if it holds.</h2>
          <p className="text-lg text-muted-foreground">
            Run one live decision, then ten, then a hundred. Watch your judgment evolve from gut feel to a measurable edge.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/calculator">Run a Decision Check</Link>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/contact">Book a Decision Audit</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-sm text-muted-foreground text-center md:text-left">
            Human progress happens where data runs out. D-NAV measures the quality of that leap.
          </p>
        </div>
      </footer>
    </main>
  );
}
