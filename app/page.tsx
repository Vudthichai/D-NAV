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
import Image from "next/image";
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
            <div className="flex justify-center items-center gap-4 mb-8">
              <AnimatedCompass className="h-20 w-20" />
              <div className="text-left">
                <h1 className="text-6xl font-black tracking-tight text-foreground">D-NAV</h1>
                <p className="text-xl text-muted-foreground font-medium">The Decision Navigator</p>
              </div>
            </div>

            {/* Hero Description */}
            <div className="max-w-4xl mx-auto mb-12">
              <h2 className="text-4xl font-bold text-foreground mb-6 leading-tight">
                Bring clarity to complex decisions instantly
              </h2>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Transform gut feelings into data-driven insights. D-NAV quantifies the intangible
                aspects of decision-making, giving you a clear framework to evaluate options, track
                patterns, and make better choices consistently.
              </p>

              {/* Key Features */}
              <div className="flex flex-wrap justify-center gap-3 mb-12">
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Zap className="w-4 h-4 mr-2" />
                  Real-time Analysis
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Target className="w-4 h-4 mr-2" />
                  Data-Driven Insights
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Brain className="w-4 h-4 mr-2" />
                  Pattern Recognition
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Decision Tracking
                </Badge>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="/calculator">
                  Launch The D-NAV
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="/definitions">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">How D-NAV Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A simple yet powerful framework that breaks down complex decisions into measurable
              components
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-8">
              <CardHeader>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calculator className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">1. Input Variables</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Rate five key variables: Impact, Cost, Risk, Urgency, and Confidence. Each slider
                  represents your current context and feelings.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-8">
              <CardHeader>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">2. Get Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  D-NAV calculates Return, Stability, and Pressure metrics, plus your composite
                  D-NAV score and decision archetype.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-8">
              <CardHeader>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ListOrdered className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">3. Track & Learn</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Build a decision portfolio, identify patterns, and improve your decision-making
                  process over time.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Why D-NAV?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stop second-guessing your decisions. Start making them with confidence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Quantify the Intangible</h3>
              <p className="text-muted-foreground">
                Turn gut feelings and intuition into measurable data points that you can track and
                analyze.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Real-Time Feedback</h3>
              <p className="text-muted-foreground">
                See how your decision profile changes as you adjust variables, giving you instant
                clarity.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Pattern Recognition</h3>
              <p className="text-muted-foreground">
                Identify your decision-making patterns and biases to make more consistent choices.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Decision Archetypes</h3>
              <p className="text-muted-foreground">
                Understand your decision style through proven archetypes that guide your approach.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Portfolio Tracking</h3>
              <p className="text-muted-foreground">
                Build a comprehensive decision portfolio to track your progress and outcomes over
                time.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Data Export</h3>
              <p className="text-muted-foreground">
                Export your decision data for further analysis or integration with other tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Ready to make better decisions?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start using D-NAV today and transform how you approach complex decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/calculator">
                Open The D-NAV
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/definitions">
                <BookOpen className="mr-2 w-5 h-5" />
                View Documentation
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.PNG"
                alt="D-NAV logo"
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg bg-primary/20 object-cover"
              />
              <div>
                <div className="font-bold text-lg">D-NAV</div>
                <div className="text-sm text-muted-foreground">The Decision Navigator</div>
              </div>
            </div>

            <div className="flex gap-6">
              <Link
                href="/definitions"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Documentation
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
