"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { oneWordArchetypes } from "@/lib/calculations";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calculator,
  CheckCircle,
  Clock,
  Info,
  Lightbulb,
  Shield,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navigationItems = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "ingredients", label: "Core Ingredients", icon: Target },
  { id: "signals", label: "Derived Signals", icon: TrendingUp },
  { id: "merit-energy", label: "Merit & Energy", icon: Zap },
  { id: "composite", label: "D-NAV Formula", icon: Calculator },
  { id: "compare", label: "Compare Mode", icon: BarChart3 },
  { id: "learning", label: "Learning & Momentum", icon: Lightbulb },
  { id: "archetypes", label: "Decision Archetypes", icon: Shield },
  { id: "notation", label: "Notation Guide", icon: Info },
] satisfies Array<{ id: string; label: string; icon: LucideIcon }>;

export default function DefinitionsPage() {
  const [activeSection, setActiveSection] = useState<string>(navigationItems[0]?.id ?? "");

  useEffect(() => {
    const sections = navigationItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (!sections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top
          );

        if (visibleEntries.length > 0) {
          setActiveSection(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-35% 0px -50% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => {
      observer.disconnect();
    };
  }, []);

  const renderArchetypes = () => {
    const combos: Array<{ p: number; s: number; r: number }> = [];
    [-1, 0, 1].forEach((p) =>
      [-1, 0, 1].forEach((s) => [-1, 0, 1].forEach((r) => combos.push({ p, s, r })))
    );

    const key = ({ p, s, r }: { p: number; s: number; r: number }) =>
      `${r === 1 ? 0 : r === 0 ? 1 : 2}-${s === 1 ? 0 : s === 0 ? 1 : 2}-${
        p === 1 ? 0 : p === 0 ? 1 : 2
      }`;

    combos.sort((a, b) => key(a).localeCompare(key(b)));

    return combos.map(({ p, s, r }) => {
      const key = [p, s, r].join("|");
      const title = oneWordArchetypes[key] || `${Pword(p)} ${Sword(s)} ${Rword(r)}`;
      const line = `${Rword(r)} with ${Sword(s).toLowerCase()} footing; ${Pword(
        p
      ).toLowerCase()} execution.`;

      return (
        <Card key={key} className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">{title}</h4>
              <div className="flex gap-2">
                <Badge variant={getBadgeVariant(p)}>P{p > 0 ? "+" : p < 0 ? "-" : "0"}</Badge>
                <Badge variant={getBadgeVariant(s)}>S{s > 0 ? "+" : s < 0 ? "-" : "0"}</Badge>
                <Badge variant={getBadgeVariant(r)}>R{r > 0 ? "+" : r < 0 ? "-" : "0"}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{line}</p>
          </div>
        </Card>
      );
    });
  };

  const Pword = (s: number) => (s > 0 ? "Pressured" : s < 0 ? "Calm" : "Balanced");
  const Sword = (s: number) => (s > 0 ? "Stable" : s < 0 ? "Fragile" : "Uncertain");
  const Rword = (s: number) => (s > 0 ? "Gain" : s < 0 ? "Loss" : "Flat");

  const getBadgeVariant = (value: number) => {
    if (value > 0) return "default";
    if (value < 0) return "destructive";
    return "secondary";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">D-NAV Documentation</h1>
              <p className="text-muted-foreground mt-1">
                The language and signals behind faster, clearer decisions
              </p>
            </div>
            <a
              href="/calculator"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              Back to The D-NAV
            </a>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-32">
              <ScrollArea className="h-[calc(100vh-10rem)]">
                <nav className="space-y-1">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                          activeSection === item.id
                            ? "text-foreground font-semibold bg-muted"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </a>
                    );
                  })}
                </nav>
              </ScrollArea>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 max-w-4xl">
            <div className="space-y-12">
              {/* Overview Section */}
              <section id="overview" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-4">Overview</h2>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    D-NAV (Decision Navigator) is a framework for making faster, clearer decisions
                    by quantifying the key factors that influence every choice. It transforms
                    subjective decision-making into objective analysis through structured evaluation
                    and real-time insights.
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      How It Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-primary mb-2">1</div>
                        <h3 className="font-semibold mb-1">Rate Variables</h3>
                        <p className="text-sm text-muted-foreground">
                          Score 5 key factors from 1-10
                        </p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-primary mb-2">2</div>
                        <h3 className="font-semibold mb-1">Get Insights</h3>
                        <p className="text-sm text-muted-foreground">
                          See real-time metrics and patterns
                        </p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-primary mb-2">3</div>
                        <h3 className="font-semibold mb-1">Make Decisions</h3>
                        <p className="text-sm text-muted-foreground">
                          Act with confidence and clarity
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Core Ingredients */}
              <section id="ingredients" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Core Ingredients</h2>
                  <p className="text-muted-foreground">
                    The five fundamental variables that shape every decision (rated 1-10 each)
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        Impact
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">Upside/importance if it works</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>1-3:</span>
                          <span className="text-muted-foreground">Low impact</span>
                        </div>
                        <div className="flex justify-between">
                          <span>4-6:</span>
                          <span className="text-muted-foreground">Moderate impact</span>
                        </div>
                        <div className="flex justify-between">
                          <span>7-10:</span>
                          <span className="text-muted-foreground">High impact</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <XCircle className="h-5 w-5 text-red-500" />
                        Cost
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">Time • money • effort • focus</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>1-3:</span>
                          <span className="text-muted-foreground">Low cost</span>
                        </div>
                        <div className="flex justify-between">
                          <span>4-6:</span>
                          <span className="text-muted-foreground">Moderate cost</span>
                        </div>
                        <div className="flex justify-between">
                          <span>7-10:</span>
                          <span className="text-muted-foreground">High cost</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Risk
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">Downside, what could go wrong</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>1-3:</span>
                          <span className="text-muted-foreground">Low risk</span>
                        </div>
                        <div className="flex justify-between">
                          <span>4-6:</span>
                          <span className="text-muted-foreground">Moderate risk</span>
                        </div>
                        <div className="flex justify-between">
                          <span>7-10:</span>
                          <span className="text-muted-foreground">High risk</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="h-5 w-5 text-blue-500" />
                        Urgency
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">How soon action is needed</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>1-3:</span>
                          <span className="text-muted-foreground">Low urgency</span>
                        </div>
                        <div className="flex justify-between">
                          <span>4-6:</span>
                          <span className="text-muted-foreground">Moderate urgency</span>
                        </div>
                        <div className="flex justify-between">
                          <span>7-10:</span>
                          <span className="text-muted-foreground">High urgency</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Confidence
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">Evidence & readiness to execute</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>1-3:</span>
                          <span className="text-muted-foreground">Low confidence</span>
                        </div>
                        <div className="flex justify-between">
                          <span>4-6:</span>
                          <span className="text-muted-foreground">Moderate confidence</span>
                        </div>
                        <div className="flex justify-between">
                          <span>7-10:</span>
                          <span className="text-muted-foreground">High confidence</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                          Scoring Guidelines
                        </h4>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          Scoring is <strong>in-the-moment</strong>:{" "}
                          <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                            1 = minimal
                          </code>
                          ,{" "}
                          <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                            10 = maximum
                          </code>
                          . You&rsquo;re rating how it <em>feels right now</em> — tomorrow&rsquo;s &ldquo;10&rdquo; might
                          change with new info or context.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Derived Signals */}
              <section id="signals" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Derived Signals</h2>
                  <p className="text-muted-foreground">
                    Three key metrics calculated from your core variables to reveal decision
                    patterns
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        Return
                      </CardTitle>
                      <CardDescription className="font-mono text-sm">Impact − Cost</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground">Value after cost</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          >
                            Positive
                          </Badge>
                          <span className="text-sm">Gain</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Neutral</Badge>
                          <span className="text-sm">Break-even</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Negative</Badge>
                          <span className="text-sm">Loss</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-500" />
                        Stability
                      </CardTitle>
                      <CardDescription className="font-mono text-sm">
                        Confidence − Risk
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground">Survivability</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          >
                            Stable
                          </Badge>
                          <span className="text-sm">≥ 0</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Uncertain</Badge>
                          <span className="text-sm">≈ 0</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Fragile</Badge>
                          <span className="text-sm">&lt; 0</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-orange-500" />
                        Pressure
                      </CardTitle>
                      <CardDescription className="font-mono text-sm">
                        Urgency − Confidence
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground">Execution stress</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          >
                            Calm
                          </Badge>
                          <span className="text-sm">&lt; 0</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Balanced</Badge>
                          <span className="text-sm">≈ 0</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Pressured</Badge>
                          <span className="text-sm">&gt; 0</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-xl border bg-muted/40 p-4 mt-4 space-y-2">
                  <p className="text-sm font-medium">Strategic Insight</p>
                  <p className="text-sm text-muted-foreground">
                    Return (R), Stability (S), and Pressure (P) are the core physics behind every decision. We group
                    them to expose different risks: Return = value after cost, Stability = survivability, Pressure =
                    execution stress. Strategic short-term negative return can be acceptable when Stability stays ≥ 0
                    and runaway Pressure is avoided.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Each decision gets an R, P, and S sign:{" "}
                    <strong>R+</strong> (gain), <strong>R0</strong> (roughly break-even), <strong>R-</strong> (loss);{" "}
                    <strong>P-</strong> (calm), <strong>P0</strong> (balanced), <strong>P+</strong> (pressured);{" "}
                    <strong>S+</strong> (stable footing), <strong>S0</strong> (uncertain footing), <strong>S-</strong> (fragile
                    footing). These signs feed directly into the Decision Archetypes shown below.
                  </p>
                </div>
              </section>

              {/* Merit & Energy */}
              <section id="merit-energy" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Merit & Energy</h2>
                  <p className="text-muted-foreground">The two fundamental components that make up the D-NAV score</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-blue-500" />
                        Merit
                      </CardTitle>
                      <CardDescription className="font-mono text-sm">
                        Impact − Cost − Risk
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">
                        Inherent quality of the bet (unit economics minus risk drag)
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">High Merit:</span>
                          <span className="text-muted-foreground">Strong value proposition</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Low Merit:</span>
                          <span className="text-muted-foreground">Weak or risky bet</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-orange-500" />
                        Energy
                      </CardTitle>
                      <CardDescription className="font-mono text-sm">
                        Urgency × Confidence
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">
                        Applied energy — how hard &amp; how ready you&rsquo;ll push now
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">High Energy:</span>
                          <span className="text-muted-foreground">Ready to execute</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Low Energy:</span>
                          <span className="text-muted-foreground">Not ready or urgent</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  At the system level, we sum these components per category.{" "}
                  <strong>Category Merit</strong> is the total inherent quality of decisions in that category (how strong the
                  bets are after cost and risk). <strong>Category Energy</strong> is the total execution push (how much urgency ×
                  confidence leadership spends there). Together they show where judgment actually creates value and
                  where decision effort is being spent.
                </p>
              </section>

              {/* D-NAV Formula */}
              <section id="composite" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-2">D-NAV Formula</h2>
                  <p className="text-muted-foreground">
                    The core calculation that combines Merit and Energy
                  </p>
                </div>

                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        D-NAV = Merit + Energy
                      </div>
                      <div className="text-lg font-mono text-blue-800 dark:text-blue-200">
                        (Impact − Cost − Risk) + (Urgency × Confidence)
                      </div>
                      <Separator className="my-4" />
                      <p className="text-blue-800 dark:text-blue-200 max-w-2xl mx-auto">
                        D-NAV blends <strong>Merit</strong> (quality of the bet) with{" "}
                        <strong>Energy</strong> (execution momentum). High D-NAV = a strong bet
                        and/or a strong push — always read <strong>Return</strong>,
                        <strong>Stability</strong>, and <strong>Pressure</strong> to avoid hidden
                        traps and slow bleeds.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Compare Mode */}
              <section id="compare" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Compare Mode</h2>
                  <p className="text-muted-foreground">
                    Side-by-side comparison between a Base scenario and a Scenario you adjust with
                    sliders
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Delta Calculations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="mt-0.5">
                          Δ
                        </Badge>
                        <div>
                          <p className="font-medium">Delta (Δ)</p>
                          <p className="text-sm text-muted-foreground">
                            <code className="bg-muted px-1 rounded">
                              ΔX = X<sub>Scenario</sub> − X<sub>Base</sub>
                            </code>
                            . Positive = Scenario is higher.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="mt-0.5">
                          ΔR
                        </Badge>
                        <div>
                          <p className="font-medium">ΔReturn</p>
                          <p className="text-sm text-muted-foreground">
                            <code className="bg-muted px-1 rounded">Δ(Impact − Cost)</code> — net
                            value change after cost.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="mt-0.5">
                          ΔS
                        </Badge>
                        <div>
                          <p className="font-medium">ΔStability</p>
                          <p className="text-sm text-muted-foreground">
                            <code className="bg-muted px-1 rounded">Δ(Confidence − Risk)</code> —
                            survivability change.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="mt-0.5">
                          ΔP
                        </Badge>
                        <div>
                          <p className="font-medium">ΔPressure</p>
                          <p className="text-sm text-muted-foreground">
                            <code className="bg-muted px-1 rounded">Δ(Urgency − Confidence)</code> —
                            execution stress change.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="mt-0.5">
                          ΔD
                        </Badge>
                        <div>
                          <p className="font-medium">ΔD-NAV</p>
                          <p className="text-sm text-muted-foreground">
                            <code className="bg-muted px-1 rounded">
                              Δ[(Impact − Cost − Risk) + (Urgency × Confidence)]
                            </code>{" "}
                            — overall quality × push change.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      Best Feasible Nudge (Optimizer)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      Finds the best feasible improvement under your guardrails. Searches small
                      slider adjustments (typically 1-point steps) to maximize <strong>ΔD-NAV</strong>
                      while respecting posture and stability constraints.
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Consulting-grade nudge prompts:</p>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        <li>Raise D-NAV without increasing Pressure</li>
                        <li>Improve Stability without sacrificing Return</li>
                        <li>Reduce Pressure while keeping D-NAV above X</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Controls in the optimizer:</p>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        <li>
                          Goal: choose which metric to optimize (D-NAV, Return, Pressure, or
                          Stability deltas)
                        </li>
                        <li>
                          Constraints: guardrails that must not be violated (e.g., don&apos;t increase
                          Pressure; don&apos;t decrease Return or Stability)
                        </li>
                        <li>
                          Threshold: minimum acceptable floor (e.g., keep D-NAV at least a target
                          value)
                        </li>
                        <li>
                          Urgency-up opt-in: higher urgency often raises Pressure, so the opt-in
                          keeps it explicitly guarded
                        </li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <p className="text-sm font-semibold">What you&apos;ll see:</p>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        <li>
                          Recommendation label: e.g., <em>Best feasible nudge: Confidence 6 → 7</em>
                        </li>
                        <li>
                          Expected deltas across <strong>D-NAV</strong>, <strong>Return</strong>,
                          <strong>Pressure</strong>, and <strong>Stability</strong>
                        </li>
                        <li>Driver list (Top 3) that explains which sliders move the outcome</li>
                        <li>
                          Narrative insight: e.g., &ldquo;Recommendation: Confidence 6 → 7. Expected
                          deltas: ΔD-NAV +4.0, ΔReturn +0.0, ΔPressure −1.0, ΔStability +1.0. Why:
                          improves survivability by raising confidence; reduces execution stress
                          without lowering return.&rdquo;
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                  </Card>

                <div className="mt-8 rounded-xl border bg-muted/40 p-4 space-y-2">
                  <h3 className="text-sm font-semibold">System Compare (Adaptation &amp; Entities)</h3>
                  <p className="text-sm text-muted-foreground">
                    Scenario Compare is local: it shows how a single decision or slider configuration differs from your
                    base case. System Compare looks at <strong>judgment physics</strong> over time or across entities.
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>
                      <strong>Adaptation Compare</strong> &mdash; same entity, different period. Shows how average Return,
                      Pressure, Stability, category weights, and archetype mix shift between snapshots.
                    </li>
                    <li>
                      <strong>Cross-Company Compare</strong> &mdash; two entities in the same period. Shows how posture
                      and archetype patterns diverge even if headline outcomes look similar.
                    </li>
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    In both cases we focus on three deltas: ΔR/ΔP/ΔS (posture), Δ category weight (where judgment load
                    moved), and Δ archetype mix (behavioral identity).
                  </p>
                </div>
              </section>

              {/* Learning & Momentum */}
              <section id="learning" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Learning & Momentum</h2>
                  <p className="text-muted-foreground">
                    Track short-, mid-, and long-horizon learning signals across your decision
                    stream and by category
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        Learning Curve Index (LCI)
                      </CardTitle>
                      <CardDescription className="font-mono text-sm">
                        Rebound / Drawdown
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground">Recovery efficiency after dips</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          >
                            &gt;1.0
                          </Badge>
                          <span className="text-sm">Over-recovery</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">≈1.0</Badge>
                          <span className="text-sm">Full recovery</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">&lt;1.0</Badge>
                          <span className="text-sm">Under-recovery</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Learning Curve Index (LCI) measures recovery efficiency after dips using Rebound / Drawdown.
                        Values &gt; <strong>1.0</strong> mean over-recovery (you bounce back higher than before), values around
                        <strong>1.0</strong> mean full recovery, and values &lt; <strong>1.0</strong> mean under-recovery (you don&apos;t fully
                        repair the damage).
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        Momentum<sub>n</sub>
                      </CardTitle>
                      <CardDescription className="font-mono text-sm">
                        slope(MA<sub>n</sub>(D-NAV))
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground">
                        Trend velocity over the last n decisions via least-squares slope on a moving
                        average
                      </p>
                      <div className="text-sm space-y-1">
                        <p>
                          Also calculated for <code className="bg-muted px-1 rounded">Return</code>,{" "}
                          <code className="bg-muted px-1 rounded">Stability</code>,{" "}
                          <code className="bg-muted px-1 rounded">Pressure</code>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Additional Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-2">Moving Averages</h4>
                        <div className="space-y-2 text-sm">
                          <p>
                            <code className="bg-muted px-1 rounded">
                              MA<sub>n</sub>(X)
                            </code>{" "}
                            = rolling average
                          </p>
                          <p>
                            <code className="bg-muted px-1 rounded">
                              EMA<sub>n</sub>(X)
                            </code>{" "}
                            = faster, recent-weighted
                          </p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Cross-Category Effects</h4>
                        <p className="text-sm text-muted-foreground">
                          Decisions in one arena can influence another (attention/energy budgets).
                          We show both global momentum and per-category momentum.
                        </p>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm">
                        <strong>Defaults:</strong> short = 15, mid = 50, long = 100 decisions. Short
                        = steering; mid = course; long = climate.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="mt-6 rounded-xl border bg-muted/40 p-4">
                  <h3 className="text-sm font-semibold mb-2">Recovery Metrics</h3>
                  <p className="text-sm text-muted-foreground">
                    We track how the system behaves immediately after setbacks:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1 mt-2">
                    <li>
                      <strong>Decisions to recover</strong> &mdash; average number of decisions it takes to return to baseline
                      after a negative dip.
                    </li>
                    <li>
                      <strong>Win rate after dips</strong> &mdash; percentage of follow-on decisions after a drawdown that
                      improve the situation rather than worsen it.
                    </li>
                    <li>
                      <strong>Decision debt</strong> &mdash; share of decisions that leave a lasting negative footprint even after
                      recovery attempts. High decision debt means bad calls cast a long shadow over the system.
                    </li>
                  </ul>
                </div>
              </section>

              {/* Decision Archetypes */}
              <section id="archetypes" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Decision Archetypes</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Each outcome is defined by the signs of Pressure, Stability, and Return (P–S–R). Together they
                    describe how the decision felt to make (pressure), how safe it left the system (stability), and
                    whether it created value (return).
                  </p>
                  <div className="mt-3 rounded-lg border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Legend: <strong>P+</strong> = pressured, <strong>P0</strong> = balanced, <strong>P-</strong> = calm;{" "}
                      <strong>S+</strong> = stable footing, <strong>S0</strong> = uncertain footing, <strong>S-</strong> = fragile footing;{" "}
                      <strong>R+</strong> = gain, <strong>R0</strong> = flat, <strong>R-</strong> = loss.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{renderArchetypes()}</div>
              </section>

              {/* Notation Guide */}
              <section id="notation" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Notation Guide</h2>
                  <p className="text-muted-foreground">
                    Mathematical symbols and abbreviations used throughout D-NAV
                  </p>
                </div>

                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">ΔX</code>
                            <div>
                              <p className="font-medium">Delta (change)</p>
                              <p className="text-sm text-muted-foreground">
                                Compare:{" "}
                                <code className="bg-muted px-1 rounded">
                                  X<sub>Scenario</sub> − X<sub>Base</sub>
                                </code>
                                . Time series:{" "}
                                <code className="bg-muted px-1 rounded">
                                  X<sub>t</sub> − X<sub>t−1</sub>
                                </code>
                                .
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                              MA<sub>n</sub>(X)
                            </code>
                            <div>
                              <p className="font-medium">Moving Average</p>
                              <p className="text-sm text-muted-foreground">
                                Rolling average over the last n decisions
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                              EMA<sub>n</sub>(X)
                            </code>
                            <div>
                              <p className="font-medium">Exponential Moving Average</p>
                              <p className="text-sm text-muted-foreground">
                                More weight on recent points
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                              Momentum<sub>n</sub>(X)
                            </code>
                            <div>
                              <p className="font-medium">Momentum</p>
                              <p className="text-sm text-muted-foreground">
                                Least-squares slope of MA<sub>n</sub>(X) (positive = trending up)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                              LCI
                            </code>
                            <div>
                              <p className="font-medium">Learning Curve Index</p>
                              <p className="text-sm text-muted-foreground">
                                Rebound / Drawdown around local dips
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                              Loss Streak
                            </code>
                            <div>
                              <p className="font-medium">Loss Streak</p>
                              <p className="text-sm text-muted-foreground">
                                Consecutive count of Return &lt; 0
                              </p>
                            </div>
                          </div>
                          <div className="flex items-baseline justify-between gap-4">
                            <div className="font-mono text-xs px-2 py-1 rounded bg-muted border">DDI</div>
                            <div>
                              <div className="text-sm font-medium">Decision Debt Index</div>
                              <div className="text-xs text-muted-foreground">
                                Proportion or index of decisions that continue to impose negative drag after recovery
                                attempts.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
