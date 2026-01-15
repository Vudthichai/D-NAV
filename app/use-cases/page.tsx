"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle, GlassCard } from "@/components/ui/card";
import { ClipboardCheck, Compass, Sparkles, Target } from "lucide-react";

type Persona = {
  title: string;
  label: string;
  description: string;
  highlights: string[];
};

const personas: Persona[] = [
  {
    title: "Plan Lock-In Under Pressure",
    label: "Planning & Alignment",
    description:
      "A cross-team decision needs pre-commitment scrutiny, not debate. A facilitated review aligns leaders on the numbers before work starts.",
    highlights: [
      "Use the Stress Test in a guided session to reach a defensible decision in one screen.",
      "Surface where urgency or confidence is distorting the plan before commitments are made.",
      "Set an executive-grade language for risk, return, and stability across reviews.",
    ],
  },
  {
    title: "Constraint Tradeoff Review",
    label: "Execution under constraints",
    description:
      "When timelines compress, the decision context is about survivable scope. A consulting-led review keeps tradeoffs explicit and defensible.",
    highlights: [
      "Model return, pressure, and stability together before committing resources.",
      "Identify which lever to move — reduce cost, slow urgency, or raise confidence — during the session.",
      "Use the same review language in check-ins so scope stays aligned to reality.",
    ],
  },
  {
    title: "Performance Review Reset",
    label: "Performance & review loops",
    description:
      "Weekly decisions can drift without a shared standard. Guided reviews turn messy stories into a disciplined judgment loop.",
    highlights: [
      "Run a quick Stress Test in session to surface the true blocker.",
      "Translate confidence versus risk into a concrete coaching target.",
      "Build decision memory so progress is measured by better judgment, not volume.",
    ],
  },
  {
    title: "Executive Risk Call",
    label: "High-stakes calls",
    description:
      "Capital, hiring, and market bets demand executive-grade scrutiny. Facilitated reviews anchor high-stakes calls before they go live.",
    highlights: [
      "Surface pressure and stability before investor, hiring, or GTM decisions.",
      "Trade scope and speed without losing the return story.",
      "Align boards, partners, and teams with one shared stress-test review.",
    ],
  },
];

export default function UseCasesPage() {
  return (
    <main className="min-h-screen bg-[#f6f3ee] text-slate-900 dark:bg-[#050608] dark:text-white">
      <section className="bg-gradient-to-b from-[#f8f5f1] via-white to-[#f3efe8] py-14 dark:from-[#050608] dark:via-black/40 dark:to-[#050608] md:py-16">
        <div className="mx-auto max-w-6xl space-y-12 px-4 md:px-6">
          <div className="space-y-4 text-center">
            <Badge
              variant="outline"
              className="border-slate-200 text-xs uppercase tracking-[0.22em] text-amber-700 dark:border-white/20 dark:text-amber-200"
            >
              Real-World Navigation
            </Badge>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">Use Cases</h1>
            <p className="mx-auto max-w-3xl text-lg text-slate-600 dark:text-slate-200">
              D-NAV supports decision contexts where time, pressure, and accountability collide. The Stress Test anchors
              facilitated reviews, with audits and consulting engagements available when the stakes demand deeper
              scrutiny.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="bg-amber-500 text-black hover:bg-amber-400">
                <Link href="/stress-test">Stress Test a Decision</Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="border-slate-300 bg-white/80 text-slate-900 hover:bg-white dark:border-white/30 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <Link href="/contact">Book a Decision Audit</Link>
              </Button>
              <Button variant="ghost" asChild className="text-slate-700 hover:bg-black/5 dark:text-white dark:hover:bg-white/10">
                <Link href="/scenarios">
                  See real-life scenarios <span aria-hidden>→</span>
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {personas.map((persona) => (
              <GlassCard
                key={persona.title}
                className="h-full flex flex-col gap-6 py-6 text-slate-900 dark:text-white"
              >
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-semibold">{persona.title}</CardTitle>
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
                      {persona.label}
                    </p>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white">
                    {persona.label.startsWith("Planning") ? <ClipboardCheck className="h-5 w-5" /> : null}
                    {persona.label.startsWith("Execution") ? <Compass className="h-5 w-5" /> : null}
                    {persona.label.startsWith("Performance") ? <Sparkles className="h-5 w-5" /> : null}
                    {persona.label.startsWith("High-stakes") ? <Target className="h-5 w-5" /> : null}
                  </span>
                </CardHeader>
                <CardContent className="space-y-4 text-slate-600 dark:text-slate-200">
                  <p className="text-base leading-relaxed">{persona.description}</p>
                  <ul className="space-y-2 text-sm">
                    {persona.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-300" aria-hidden />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button size="sm" asChild className="bg-amber-500 text-black hover:bg-amber-400">
                      <Link href="/stress-test">Stress Test a Decision</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="border-slate-300 bg-white/80 text-slate-900 hover:bg-white dark:border-white/30 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                    >
                      <Link href="/contact">Talk with our team</Link>
                    </Button>
                  </div>
                </CardContent>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
