"use client";

import type { MouseEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AnimatedCompass } from "@/components/animated-compass";
import { Button } from "@/components/ui/button";

const noiseTexture =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48ZmlsdGVyIGlkPSdudCcgZmlsdGVyVW5pdHM9J3VzZXJTcGFjZU9uVXNlJyB4PScwJyB5PScwJz48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Jy4zJyBudW1PY3RhdmVzPSc0Jy8+PGZlQ29sb3JNYXRyaXggdHlwZT0nc2F0dXJhdGUnIHZhbHVlcz0nMCAwIDAgMCAwIDEgMCAwIDAgMCAwIDAgMCAwIDAgMC4xIDAgMCAwIDAgMCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJyBmaWx0ZXI9InVybCgjbnQpIiBvcGFjaXR5PScwLjQnLz48L3N2Zz4=\n";

function HeroBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#0b0d10]" />
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: `url(${noiseTexture})` }} />
      <div className="absolute left-1/4 top-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#f97316]/10 blur-[90px]" />
      <div className="absolute right-[-120px] top-[-140px] h-[440px] w-[440px] rounded-full bg-indigo-500/10 blur-[110px]" />
      <div className="absolute bottom-[-220px] left-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[110px]" />
    </div>
  );
}

function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.8)] backdrop-blur-md ${className}`}>
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
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">{title}</h2>
      {subtitle ? <p className={`text-lg text-slate-300 max-w-3xl ${widthClass}`}>{subtitle}</p> : null}
    </div>
  );
}

function HeroVisual() {
  const cards = [
    {
      title: "Reports",
      image: "/mockups/Computer-Report.png",
      accent: "from-amber-400/60 to-amber-400/5",
      rotation: "-6deg",
      offset: "translateY(12px) translateX(-8px)",
      delay: "0ms",
    },
    {
      title: "Compare",
      image: "/mockups/Computer-Entity.png",
      accent: "from-indigo-400/70 to-indigo-400/5",
      rotation: "2deg",
      offset: "translateY(-6px)",
      delay: "120ms",
    },
    {
      title: "Adaptation",
      image: "/mockups/Computer-Adaptation.png",
      accent: "from-emerald-400/60 to-emerald-400/5",
      rotation: "8deg",
      offset: "translateY(16px) translateX(10px)",
      delay: "220ms",
    },
  ];

  return (
    <div className="relative fade-in-up" style={{ animationDelay: "80ms" }}>
      <div className="pointer-events-none absolute -left-6 -right-4 top-8 h-48 rounded-full bg-gradient-to-r from-white/5 via-white/0 to-white/5 blur-3xl" />
      <GlassPanel className="bg-[#0e1117]/70 border-white/10 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.8)]">
        <div className="relative overflow-hidden rounded-[22px] border border-white/5 bg-gradient-to-br from-white/5 via-transparent to-white/5 px-6 py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),transparent_45%)] opacity-60" />
          <div className="absolute inset-x-4 bottom-6 top-6 rounded-[18px] border border-white/5" />
          <div className="relative flex h-[360px] items-center justify-center">
            {cards.map((card) => (
              <div
                key={card.title}
                className="group absolute w-[72%] max-w-[320px] rounded-2xl border border-white/15 bg-black/70 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)] transition duration-700"
                style={{
                  transform: `${card.offset} rotate(${card.rotation})`,
                  animationDelay: card.delay,
                }}
              >
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.accent} opacity-50`} />
                <div className="relative overflow-hidden rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between px-4 py-3 backdrop-blur-sm">
                    <p className="text-sm font-semibold text-white">{card.title}</p>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_8px_rgba(74,222,128,0.15)]" />
                  </div>
                  <div className="relative aspect-[4/3] w-full bg-white/5">
                    {/* TODO: Swap placeholder frames with the latest product screenshots if available. */}
                    <Image
                      src={card.image}
                      alt={`${card.title} preview`}
                      fill
                      sizes="(min-width: 1024px) 32vw, 90vw"
                      className="object-cover"
                      priority={card.title === "Reports"}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

function HeroSection() {
  const scrollToHowItWorks = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById("quick-start");
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  const chips = ["Navigator", "Contrarian", "Integrator"];

  const signalBars = [
    { label: "Return", width: "78%" },
    { label: "Pressure", width: "64%" },
    { label: "Stability", width: "86%" },
  ];

  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackground />
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-20 md:pb-28 space-y-12">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-100">
              <AnimatedCompass className="h-6 w-6" />
              <span>Decision NAVigator</span>
            </div>
            <div className="space-y-6">
              <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">
                Track your judgment like a performance metric.
              </h1>
              <p className="text-xl text-slate-200 max-w-2xl">
                In 60 seconds, see whether your decision survives pressure.
              </p>
            </div>
            <div className="flex flex-col items-center justify-start gap-4 sm:flex-row sm:gap-5">
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
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 border border-white/20 bg-black/80 text-white transition hover:-translate-y-[1px] hover:bg-black focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30"
                asChild
              >
                <Link href="#quick-start" onClick={scrollToHowItWorks}>
                  See how it works
                </Link>
              </Button>
            </div>
            <p className="text-sm text-slate-400">Start with a decision you’re avoiding.</p>
          </div>
          <HeroVisual />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <GlassPanel className="group h-full bg-[#0f1218] fade-in-up" style={{ animationDelay: "40ms" }}>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-200">RPS signals</p>
                <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-slate-200">Live</span>
              </div>
              <div className="space-y-3.5">
                {signalBars.map((signal) => (
                  <div
                    key={signal.label}
                    className="group/row space-y-2 signal-row"
                    style={{ ["--bar-width" as string]: signal.width }}
                  >
                    <div className="flex items-center justify-between text-sm text-white">
                      <span>{signal.label}</span>
                      <span className="text-slate-300">{signal.width}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5">
                      <div
                        className="signal-bar micro-bar h-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="group h-full bg-[#0f1218] fade-in-up" style={{ animationDelay: "140ms" }}>
            <div className="flex flex-col gap-4 p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Archetypes</p>
                <h3 className="text-xl font-semibold text-white">Your decision style, revealed over time.</h3>
                <p className="text-slate-300">See the pattern behind your judgment calls.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.7)]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="group h-full bg-[#0f1218] fade-in-up" style={{ animationDelay: "240ms" }}>
            <div className="flex flex-col gap-4 p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Compare + Adaptation</p>
                <h3 className="text-xl font-semibold text-white">Compare decisions. Track drift. See fragility early.</h3>
                <p className="text-slate-300">
                  Pinpoint when confidence, risk, or urgency are moving faster than your proof.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Entity Compare", "Adaptation"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.7)]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </section>
  );
}

function StepsSection() {
  const steps = [
    {
      title: "Pick one live decision.",
      description:
        "Expansion, hire, product bet, trade — anything that actually matters.",
    },
    {
      title: "Rate it honestly.",
      description:
        "Move sliders for Impact, Cost, Risk, Urgency, and Confidence. No posture. Just the tension you feel.",
    },
    {
      title: "See if the bet is built to survive.",
      description:
        "D-NAV turns it into Return, Pressure, and Stability you can act on immediately.",
    },
  ];

  return (
    <section id="quick-start" className="bg-[#0d1016] py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-6 space-y-10">
        <SectionHeading
          title="What you can do in the next 60 seconds"
          subtitle="Pick one decision and see if it survives."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <GlassPanel key={step.title} className="h-full bg-white/5">
              <div className="flex h-full flex-col gap-4 p-6">
                <span className="text-sm font-semibold text-amber-200">Step {index + 1}</span>
                <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                <p className="text-base text-slate-300 clamp-4 flex-1">{step.description}</p>
              </div>
            </GlassPanel>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProofCard({
  label,
  title,
  description,
  imagePath,
  alt,
  priority = false,
}: {
  label: string;
  title: string;
  description: string;
  imagePath: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <GlassPanel className="flex h-full flex-col bg-white/5">
      <div className="flex-1 space-y-3 p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-200">
          <span>{label}</span>
          <div className="h-px flex-1 bg-gradient-to-r from-amber-200/40 to-transparent" />
        </div>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="text-slate-200 clamp-3">{description}</p>
      </div>
      <div className="border-t border-white/10 bg-black/40 px-6 pb-6 pt-4">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.9)]">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={imagePath}
              alt={alt}
              fill
              sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
              className="object-cover"
              priority={priority}
            />
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function ProductProofSection() {
  const proof = [
    {
      label: "Executive Readout",
      title: "Executive Readout",
      description: "Translate noisy decisions into a single readout leaders can act on immediately.",
      imagePath: "/mockups/Computer-Report.png",
      alt: "Executive readout mockup",
    },
    {
      label: "Entity Compare",
      title: "Entity Compare",
      description: "Compare decision sets side-by-side to spot resilience, fragility, and hidden pressure.",
      imagePath: "/mockups/Computer-Entity.png",
      alt: "Entity compare mockup",
    },
    {
      label: "Adaptation",
      title: "Adaptation",
      description: "Watch confidence, risk, and urgency drift over time—so you adjust before the system snaps.",
      imagePath: "/mockups/Computer-Adaptation.png",
      alt: "Adaptation mockup",
    },
  ];

  return (
    <section id="product-proof" className="bg-[#0b0d10] py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-6 space-y-10">
        <SectionHeading
          title="Product proof"
          subtitle="See how the readouts land in the real world: high-fidelity views you can take into any executive room."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {proof.map((item, index) => (
            <ProofCard key={item.title} {...item} priority={index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ConsultationSection() {
  const bullets = [
    "Decision physics (Impact, Cost, Risk, Urgency, Confidence)",
    "RPS + Archetypes explained on your own decisions",
    "Review 10+ decisions live",
    "Leave with a template + your first logged decisions",
    "Take-home references: D-NAV / RPS / Archetypes / Patterns",
    "Schedule a second session to review Entity + Compare",
  ];

  return (
    <section className="bg-[#0d1016] py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-6 space-y-8">
        <SectionHeading
          title="Consultation: what you walk away with"
          subtitle="Every session is structured, fast, and leaves you with tangible artifacts."
          align="left"
        />
        <GlassPanel>
          <div className="grid gap-8 lg:grid-cols-2 p-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold text-white">We move quickly so you leave with proof.</h3>
              <p className="text-slate-300">
                One decision shows tension. Ten decisions show patterns. A hundred decisions reveal constraints. Over time, D-NAV shows when your confidence is earned — and when it’s cosplay.
              </p>
              <p className="text-slate-300">
                We turn your live calls into Return, Pressure, and Stability — then give you the tools to keep logging without us.
              </p>
            </div>
            <ul className="grid gap-4 text-left text-slate-200 sm:grid-cols-2 lg:grid-cols-1">
              {bullets.map((item) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.7)]">
                  <span className="mt-2 h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}

function AudienceSection() {
  const titles = ["Founders & Execs", "Traders & Investors", "Operators & Product Leads", "Consultants & Analysts"];
  const copy = [
    "Stop making “vision calls” you can’t explain. Turn strategy debates into clear Return, Pressure, and Stability trade-offs. See if your conviction is earned or just loud.",
    "Separate itchy trigger finger from real edge. See if you’re stacking fragile high-pressure bets. Track your judgment drift across market regimes.",
    "Prioritize roadmap moves by impact versus execution drag. Avoid drowning in reactive, high-pressure decisions. Train teams to push without quietly torching stability.",
    "Turn stakeholder chaos into structured decision audits. Show clients how their judgment patterns bleed value. Deliver reports with a repeatable decision language.",
  ];

  return (
    <section id="who-its-for" className="bg-[#0b0d10] py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-6 space-y-10">
        <SectionHeading
          title="Built for people who live in the unknown"
          subtitle="Different arenas, same problem: your judgment has to perform before the data does."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {titles.map((title, index) => (
            <GlassPanel key={title} className="h-full bg-white/5">
              <div className="flex h-full flex-col gap-3 p-6">
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="text-slate-300">{copy[index]}</p>
              </div>
            </GlassPanel>
          ))}
        </div>
        <div className="space-y-4 text-center">
          <p className="text-base text-slate-300">
            If your job is to make calls before the data is clean, D-NAV is your mirror.
          </p>
          <Button
            size="lg"
            className="text-lg px-8 py-6 bg-amber-500 text-black hover:bg-amber-400 focus-visible:ring-amber-300"
            asChild
          >
            <Link href="/calculator">Run a Decision Check</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="bg-[#0d1016] py-16 md:py-24">
      <div className="max-w-5xl mx-auto px-6">
        <GlassPanel>
          <div className="p-10 sm:p-12 space-y-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Run one decision. See if it holds.</h2>
            <p className="text-lg text-slate-300 max-w-3xl mx-auto">
              Run one live decision, then ten, then a hundred. Watch your judgment evolve from gut feel to a measurable edge.
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
                className="text-lg px-8 py-6 border-white/30 text-white hover:bg-white/10 focus-visible:ring-amber-300"
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
    <main className="bg-[#0b0d10] text-white scroll-smooth">
      <HeroSection />
      <StepsSection />
      <ProductProofSection />
      <ConsultationSection />
      <AudienceSection />
      <FinalCTASection />
    </main>
  );
}
