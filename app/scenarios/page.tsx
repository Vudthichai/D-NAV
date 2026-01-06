"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const scenarios = [
  {
    title: "Positive Pressure",
    description: "High-urgency situations where the timeline is against you and confidence doesn’t match. Use rules to keep pace without guessing.",
  },
  {
    title: "High Stability",
    description: "Confidence outweighs risk; you can move without fear (varies by person). This is the zone for decisive execution.",
  },
  {
    title: "Stability vs Pressure",
    description: "If stability is positive, you can survive pressure even if it’s ugly. Keep the footing strong while you work the clock.",
  },
  {
    title: "Negative Return with High D-NAV Energy",
    description: "Slow hidden burns across teams, deals, or long arcs. Reframe the scope or re-balance the levers before momentum locks in the loss.",
  },
  {
    title: "Archetypes in the wild",
    description: "Match real decisions to the archetypes and tags in Definitions to speed up coaching and communication.",
  },
];

export default function ScenariosPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:px-6">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Library</p>
        <h1 className="text-3xl font-bold leading-tight text-foreground">Scenarios</h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          Translate D-NAV readouts into real-world situations so teams can act faster under pressure and explain their moves with clarity.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/contact">Book a Decision Audit</Link>
          </Button>
          <a
            href="/definitions"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Review Definitions
          </a>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {scenarios.map((scenario) => (
          <Card key={scenario.title} className="h-full border-border/60 bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-foreground">{scenario.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">{scenario.description}</p>
              <a
                href="/definitions"
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                See definitions
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
