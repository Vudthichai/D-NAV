"use client";

import { AnimatedCompass } from "@/components/animated-compass";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Calculator,
  CheckCircle,
  ListOrdered,
  Target,
  Zap,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header with Theme Toggle */}
      <header className="flex justify-end items-center p-4 shrink-0">
        <ThemeToggle />
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-br from-background via-background to-muted/20 flex-1 flex items-center min-h-screen">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="text-center">
            {/* Logo and Title */}
            <div className="flex flex-col items-center gap-4 mb-8">
              <AnimatedCompass />
              <h1 className="text-6xl font-black tracking-tight text-foreground">D-NAV</h1>
            </div>

            {/* Hero Description */}
            <div className="max-w-4xl mx-auto mb-12">
              <h2 className="text-4xl font-bold text-foreground mb-6 leading-tight">
                When data ends, judgment begins.
              </h2>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                D-NAV measures what every dashboard ignores—the quality of your decisions in the
                unknown. It is a compass for explorers, founders, strategists, traders, and
                engineers of uncertainty who refuse to live inside yesterday’s data silo.
              </p>

              {/* Key Features */}
              <div className="flex flex-wrap justify-center gap-3 mb-12">
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Zap className="w-4 h-4 mr-2" />
                  Judgment Intelligence
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Target className="w-4 h-4 mr-2" />
                  Return, Pressure, Stability
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Brain className="w-4 h-4 mr-2" />
                  Bias Pattern Detection
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Decision Survivability
                </Badge>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="/calculator">
                  Run a Decision Check
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="/definitions">See How It Works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Proof Section */}
      <section className="py-24 bg-muted/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Where Data Ends</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Great calls rarely come gift-wrapped in perfect spreadsheets. These ten decisions were
              forged in incomplete data, conflicting signals, and raw conviction. Judgment quality—not
              data volume—determined who survived.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">Tesla</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3 text-muted-foreground">
                <p>Betting the company on the Gigafactory before demand data existed.</p>
                <p className="text-sm">Impact high · Cost extreme · Risk existential · Urgency high · Confidence irrationally high.</p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">SpaceX</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3 text-muted-foreground">
                <p>Choosing to reuse rockets when the industry consensus said it was impossible.</p>
                <p className="text-sm">Data screamed no. Judgment recalibrated the frontier.</p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">Amazon</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3 text-muted-foreground">
                <p>Launching AWS without a market precedent for cloud computing.</p>
                <p className="text-sm">No demand model. Only conviction in latent pressure.</p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">IBM</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3 text-muted-foreground">
                <p>Pivoting from hardware to services in the ’90s. Suicidal on paper.</p>
                <p className="text-sm">The models said collapse. Judgment found endurance.</p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">WeWork</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3 text-muted-foreground">
                <p>Same numeric optimism as Amazon’s early play but reversed risk weighting.</p>
                <p className="text-sm">Confidence outran reality. Judgment failed the stress test.</p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">Netflix</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3 text-muted-foreground">
                <p>Killing DVDs while the unit economics still printed cash.</p>
                <p className="text-sm">Comfort is data’s lullaby. Judgment cut the cord early.</p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">Enron</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3 text-muted-foreground">
                <p>Perfect metrics hiding rotten stability.</p>
                <p className="text-sm">Confidence outran risk. Judgment ignored its own alarms.</p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">Apple</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3 text-muted-foreground">
                <p>Jobs cut the product line to four when the data screamed diversify.</p>
                <p className="text-sm">Precision judgment beat noisy demand forecasts.</p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">Apollo 13</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3 text-muted-foreground">
                <p>Engineers solving a crisis no simulation covered.</p>
                <p className="text-sm">Urgency versus confidence in live fire. Judgment won.</p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">Pfizer</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3 text-muted-foreground">
                <p>Green-lighting mRNA at record speed.</p>
                <p className="text-sm">Risk enormous. Urgency absolute. Confidence still forming. Judgment led.</p>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-base text-muted-foreground mt-16">
            When the spreadsheet runs out, judgment takes over. D-NAV measures that judgment.
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">How D-NAV Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The Return, Pressure, Stability (RPS) model measures internal forces—not market noise.
              D-NAV does not predict the future. It reveals whether your judgment is built to survive
              it.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-8">
              <CardHeader>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calculator className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">1. Map the Unknowns</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Score Impact, Cost, Risk, Urgency, and Confidence as they actually feel—not how the
                  report wants them to feel. Capture the tension inside the decision.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-8">
              <CardHeader>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">2. Measure Judgment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  D-NAV translates those inputs into Return, Pressure, and Stability—three vectors that
                  show whether conviction, risk, and urgency are in balance.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-8">
              <CardHeader>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ListOrdered className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">3. Iterate Under Pressure</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Build a portfolio of decisions, audit the outliers, and sharpen judgment faster than
                  your environment shifts.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-2 items-center">
            <Card className="p-8 h-full">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-2xl">RPS Explained</CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-muted-foreground space-y-4">
                <p>
                  Return, Pressure, and Stability expose the inner mechanics of your call. Return shows
                  whether the upside justifies the burn. Pressure reveals how urgency and confidence are
                  colliding. Stability tests if the structure can survive volatility.
                </p>
                <p>
                  This is not predictive analytics. It is a high-resolution mirror for leaders who must
                  choose before the data matures.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 h-full bg-primary/5 border-primary/40">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-2xl">Equation of Curiosity Under Constraint</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-3xl font-semibold text-foreground">
                  (Impact − Cost − Risk) + (Urgency × Confidence)
                </div>
                <p className="text-muted-foreground mt-4">
                  The formula captures how explorers frame the leap: protect the downside, amplify the
                  drive, and let confidence earn its keep.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Philosophy</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              D-NAV is built for people who explore uncertainty and learn faster than their
              environments change. If you only move when the dashboard agrees, this is not for you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Challenge the Known</h3>
              <p className="text-muted-foreground">
                Use D-NAV when the model says “wait” but you know delay kills momentum. Quantify the
                conviction others call irrational.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Audit the Gut</h3>
              <p className="text-muted-foreground">
                Surface bias, overconfidence, and hidden fragility before they surface as losses.
                Judgment improves when it is interrogated.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Train for Volatility</h3>
              <p className="text-muted-foreground">
                Build a decision log that treats chaos as a training set. Iterate until your response
                time beats the rate of change.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Align the Team</h3>
              <p className="text-muted-foreground">
                Give founders, operators, and investors a shared language for why a move is bold—or
                reckless. Make the debate precise.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Protect the Downside</h3>
              <p className="text-muted-foreground">
                Stress-test cost and risk before they metastasize. D-NAV forces the hard questions
                before capital is committed.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Capture the Win Rate</h3>
              <p className="text-muted-foreground">
                Track which calls outperformed their data. The pattern is your edge. Defend it with
                evidence, not folklore.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 mt-16 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Ready to measure the judgment that keeps you alive?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Run a live decision, test its resilience, and recalibrate before reality does it for you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/calculator">
                Start Measuring Judgment
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/definitions">
                <BookOpen className="mr-2 w-5 h-5" />
                See the Framework
              </Link>
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
