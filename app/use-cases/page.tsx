"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, LineChart, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type UseCase = {
  id: string;
  title: string;
  label: string;
  description: string;
  highlights: string[];
  cta: string;
  icon: LucideIcon;
  details: {
    overview: string;
    archetypes: Array<{ title: string; description: string }>;
    outcomes: string[];
  };
};

const useCases: UseCase[] = [
  {
    id: "founder",
    title: "Founders",
    label: "Founders & Solopreneurs",
    description:
      "Turn ambiguous founder intuition into investor-ready narratives and portfolio clarity.",
    highlights: [
      "Model capital allocation, runway choices, and founder-market fit",
      "Stress test investor updates with quantified story arcs",
      "Compare venture bets with repeatable evaluation criteria",
    ],
    cta: "Explore Founders",
    icon: Rocket,
    details: {
      overview:
        "D-NAV translates founder instincts into structured diligence. Capture qualitative signals from teams, customers, and markets, then align stakeholders around the expected trajectory of the bet.",
      archetypes: [
        {
          title: "Launch Velocity",
          description:
            "Evaluate speed-sensitive moves like product releases or funding rounds with clear pressure and return profiles.",
        },
        {
          title: "Runway Navigator",
          description:
            "Balance burn versus growth by visualizing trade-offs among cost, risk, and confidence in pipeline health.",
        },
        {
          title: "Portfolio Balancer",
          description:
            "Prioritize venture bets by comparing composite scores and pattern-matching previous wins and misses.",
        },
      ],
      outcomes: [
        "Faster consensus around investor narratives and board decisions",
        "Data-backed insight into when to double down or pivot",
        "Institutional memory of decision logic across fundraising cycles",
      ],
    },
  },
  {
    id: "corporate",
    title: "Corporate",
    label: "Corporate Leadership",
    description:
      "Align leadership teams on hiring, resource planning, and strategic initiatives without endless slide decks.",
    highlights: [
      "Score leadership bets using a shared language for risk",
      "Run scenario plans that integrate finance and talent inputs",
      "Document decision trails for org-wide accountability",
    ],
    cta: "Explore Corporate",
    icon: Building2,
    details: {
      overview:
        "Give executives a living dashboard for cross-functional decisions. D-NAV unifies finance, operations, and people data so leaders can evaluate trade-offs in real time.",
      archetypes: [
        {
          title: "Org Architect",
          description:
            "Model hiring waves and leadership placements with calibrated urgency and impact scores.",
        },
        {
          title: "Change Pilot",
          description:
            "Guide transformation programs by mapping confidence versus risk for each milestone.",
        },
        {
          title: "Stakeholder Synthesizer",
          description:
            "Align executives and boards using a single source of truth for strategic rationale.",
        },
      ],
      outcomes: [
        "Unified prioritization across business units",
        "Reduced friction in headcount and investment approvals",
        "Auditable log of the rationale behind each major move",
      ],
    },
  },
  {
    id: "trading",
    title: "Investing",
    label: "Investing Analysis",
    description:
      "Quantify conviction in complex trades by incorporating qualitative signals into disciplined execution.",
    highlights: [
      "Blend discretionary insights with systematic decision rules",
      "Expose hidden pressure points before capital is deployed",
      "Review post-trade outcomes with structured narratives",
    ],
    cta: "Explore Investing",
    icon: LineChart,
    details: {
      overview:
        "Traders bring macro intuition, research notes, and market structure together in one place. D-NAV compares opportunities, surfaces pressure, and solidifies playbooks.",
      archetypes: [
        {
          title: "Conviction Builder",
          description:
            "Score asymmetric setups and confirm if return justifies the pressure and risk.",
        },
        {
          title: "Risk Sentinel",
          description:
            "Stress test positions against scenario shocks and liquidity constraints.",
        },
        {
          title: "Review Analyst",
          description:
            "Capture post-trade learnings to refine models and human judgment.",
        },
      ],
      outcomes: [
        "Clear go/no-go criteria before capital is at risk",
        "Faster iteration on playbooks with shared decision memory",
        "Quantified lessons that de-bias future positioning",
      ],
    },
  },
];

export default function UseCasesPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="py-20 bg-linear-to-b from-background via-muted/20 to-muted/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="uppercase tracking-wide text-xs mb-4">
              Real-World Navigation
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Use Cases for Every Decision Frontier
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore how D-NAV equips teams and individuals to translate qualitative insight into confident,
              repeatable outcomes across industries and disciplines.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {useCases.map((useCase) => {
              const Icon = useCase.icon;
              return (
                <Dialog key={useCase.id}>
                  <Card className="flex flex-col h-full shadow-lg shadow-primary/5 border-border/60">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {useCase.label}
                        </Badge>
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                      <CardTitle className="text-2xl font-semibold text-foreground">
                        {useCase.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <p className="text-muted-foreground mb-6 leading-relaxed">
                        {useCase.description}
                      </p>
                      <ul className="space-y-3 text-sm text-muted-foreground">
                        {useCase.highlights.map((highlight) => (
                          <li key={highlight} className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter className="mt-6">
                      <DialogTrigger asChild>
                        <Button className="w-full" size="lg">
                          {useCase.cta}
                        </Button>
                      </DialogTrigger>
                    </CardFooter>
                  </Card>

                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{useCase.title}</DialogTitle>
                      <DialogDescription>{useCase.label}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 text-sm">
                      <p className="leading-relaxed text-muted-foreground">{useCase.details.overview}</p>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
                          Decision Archetypes
                        </h3>
                        <div className="grid gap-3">
                          {useCase.details.archetypes.map((archetype) => (
                            <div
                              key={archetype.title}
                              className="rounded-lg border border-border/60 bg-muted/40 p-4"
                            >
                              <p className="text-base font-semibold text-foreground">{archetype.title}</p>
                              <p className="text-muted-foreground leading-relaxed mt-1">
                                {archetype.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">
                          Outcomes You Can Expect
                        </h3>
                        <ul className="space-y-2 text-muted-foreground">
                          {useCase.details.outcomes.map((outcome) => (
                            <li key={outcome} className="flex items-start gap-2">
                              <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                              <span>{outcome}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-3 pt-4">
                        <Button asChild>
                          <Link href="/calculator">Launch D-NAV</Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <Link href="/contact">Talk with our team</Link>
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
