"use client";

"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle, GlassCard } from "@/components/ui/card";

const scenarioCards = [
  {
    title: "Positive Pressure",
    explain:
      "Urgency is high and confidence is thin. The clock is louder than your evidence.",
    feelsLike:
      "You’re late to something that matters — shipping a patch, making a call before close, deciding under scrutiny.",
    numbers: "Urgency spikes, confidence lags, pressure climbs even if return looks good.",
    nextMove: ["Buy time by trimming scope or unlocking a quick evidence hit.", "Name the risk you’re accepting so the team isn’t guessing."],
  },
  {
    title: "High Stability",
    explain: "Confidence outweighs risk. The move is survivable even if pressure exists.",
    feelsLike: "You can execute without fear; the risk feels priced-in to you even if others hesitate.",
    numbers: "Confidence sits above risk; stability is positive so pressure feels manageable.",
    nextMove: ["Advance decisively while the footing is strong.", "Use the stability to teach the team what ‘safe enough’ looks like."],
  },
  {
    title: "Stability vs Pressure relationship",
    explain: "Solid stability makes pressure survivable. It might still be ugly, but it holds.",
    feelsLike: "You’re under the gun, but you trust the plan and the evidence backing it.",
    numbers: "Stability positive, pressure elevated. Urgency is high but confidence keeps it from cracking.",
    nextMove: ["Protect the stability sources (evidence, people, cash) while you burn down pressure.", "Sequence steps so you never give up stability just to sprint."],
  },
  {
    title: "Negative Return in high D-NAV situations",
    explain: "The energy is high but the math is off; you’re burning quietly in the background.",
    feelsLike: "Work is frantic yet something feels net-negative — a slow leak in a deal or a team.",
    numbers: "Return negative or neutral while urgency stays elevated. Stability might be masking the burn.",
    nextMove: ["Find the leak: trim cost, reframe scope, or raise impact before momentum locks in losses.", "If the leak won’t close, exit cleanly instead of dragging it out."],
  },
  {
    title: "Calm failure",
    explain: "Low pressure doesn’t mean good. It can be comfortable drift.",
    feelsLike: "No one is panicked, but nothing is improving — maybe coasting on autopilot.",
    numbers: "Pressure low because urgency is muted, but return is flat and stability may be soft.",
    nextMove: ["Create honest urgency or define the impact target so drift stops.", "Shake the system with a small, fast decision to surface real signals."],
  },
  {
    title: "High conviction, high risk",
    explain: "Confidence may be narrative-heavy while risk is underpriced.",
    feelsLike: "You ‘know’ this will work and are ready to push, but the downside could bite hard.",
    numbers: "Confidence and risk both high; stability hovers near zero or negative.",
    nextMove: ["Stress-test the risk assumptions and add one disconfirming piece of evidence.", "Design a reversible first move before committing the full plan."],
  },
  {
    title: "Narrative inflation",
    explain: "Confidence is rising faster than results justify. Mispricing hides here.",
    feelsLike: "The room believes the story more than the scoreboard.",
    numbers: "Confidence high and climbing while Return is flat/negative; Stability may be neutral.",
    nextMove: ["Demand one disconfirming datapoint before scaling.", "Convert belief into proof: run a small test that can fail loudly."],
  },
  {
    title: "Fragile execution regime",
    explain: "Pressure is compressing Stability. Things look fine… until they don’t.",
    feelsLike: "Everyone is sprinting; no one feels safe to slow down.",
    numbers: "Pressure elevated (Urgency > Confidence) while Stability is low/negative (Risk ≈ or > Confidence).",
    nextMove: ["Buy time: cut scope or sequence the plan into survivable steps.", "Protect Stability sources (cash, people, evidence) before pushing speed."],
  },
  {
    title: "Underexploited leverage",
    explain: "High Impact with low Cost keeps showing up. This is hidden upside.",
    feelsLike: "“Why didn’t we do this sooner?” energy.",
    numbers: "Impact high, Cost low → Return strongly positive; Pressure may be manageable.",
    nextMove: ["Move now: allocate ownership and ship the smallest version this week.", "Create a repeatable playbook so it doesn’t die in debate."],
  },
  {
    title: "Rushed without necessity",
    explain: "Urgency is spiking without real risk. This is distortion, not reality.",
    feelsLike: "The timeline feels emotional or political—not externally forced.",
    numbers: "Urgency high, Risk low; Pressure rises because Confidence doesn’t match the speed.",
    nextMove: ["Name the real driver (fear, optics, politics) and reset the clock if possible.", "If you can’t slow down, raise Confidence fast: get one concrete evidence hit."],
  },
];

export default function ScenariosPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-white">
      <section className="mx-auto max-w-6xl space-y-10 px-4 py-10 md:px-6 md:py-14">
        <header className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Field Guide</p>
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">Scenarios</h1>
          <p className="mx-auto max-w-3xl text-base text-slate-200">
            Real-world decision physics in plain language. Use these as fast translations of Return, Pressure, and
            Stability before you act.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="bg-amber-500 text-black hover:bg-amber-400">
              <Link href="/stress-test">Stress test a decision</Link>
            </Button>
            <Button variant="outline" asChild className="border-white/30 bg-white/5 text-white hover:bg-white/10">
              <Link href="/contact">Book a Decision Audit</Link>
            </Button>
            <a
              href="/definitions"
              className="text-sm font-medium text-slate-200 underline-offset-4 hover:text-white hover:underline"
            >
              See definitions
            </a>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {scenarioCards.map((scenario) => (
            <GlassCard
              key={scenario.title}
              className="h-full flex flex-col gap-6 py-6 text-white"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">{scenario.title}</CardTitle>
                <p className="text-sm text-slate-200">{scenario.explain}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-200">
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200">What it feels like</p>
                  <p className="mt-1 leading-relaxed">{scenario.feelsLike}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200">What the numbers usually look like</p>
                  <p className="mt-1 leading-relaxed">{scenario.numbers}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 space-y-1.5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200">Next move</p>
                  <ul className="space-y-1.5">
                    {scenario.nextMove.map((move) => (
                      <li key={move} className="flex items-start gap-2">
                        <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                        <span>{move}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </GlassCard>
          ))}
        </div>

        <GlassCard className="flex flex-col gap-6 py-6 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Decision market inefficiencies</CardTitle>
            <p className="text-sm text-slate-200">Early warning / early opportunity signals.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                <span>
                  Confidence ↑ faster than Return → Narrative inflation. Leaders believe more than results justify. This
                  is where reputational risk and mispricing hide.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                <span>
                  Pressure compresses Stability → Fragile execution regimes. Things look fine… until they don’t. Classic
                  blow-up zone.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                <span>
                  High Impact + Low Cost persists → Underexploited leverage. This is where boards ask “why didn’t we do
                  this sooner?”
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                <span>Urgency spikes without Risk → Political or emotional distortion. Decisions are being rushed without external necessity.</span>
              </li>
            </ul>
            <p className="text-sm text-slate-200">
              Compare modes tell you how you performed. These tell you where to look next. That distinction matters.
            </p>
          </CardContent>
        </GlassCard>

        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center md:flex-row md:px-6">
          <p className="text-sm text-slate-200">Ready to translate your own situation?</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400" asChild>
              <Link href="/stress-test">Run the Stress Test</Link>
            </Button>
            <Button size="sm" variant="outline" asChild className="border-white/30 bg-white/5 text-white hover:bg-white/10">
              <Link href="/contact">Book a Decision Audit</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
