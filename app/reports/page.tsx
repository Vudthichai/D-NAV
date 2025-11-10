"use client";

import { useMemo, useState } from "react";

import { AnimatedCompass } from "@/components/animated-compass";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  FileChartColumn,
  FileDown,
  FileText,
  type LucideIcon,
} from "lucide-react";

const TIMEFRAMES = [
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "quarter", label: "Quarter" },
  { value: "all", label: "All-Time" },
] as const;

type Timeframe = (typeof TIMEFRAMES)[number]["value"];

type Report = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  icon: LucideIcon;
  previewAccent: string;
  highlights: Record<Timeframe, string>;
};

const reports: Report[] = [
  {
    id: "narrative",
    title: "Download Narrative PDF",
    description:
      "A polished summary of your qualitative inputs, sentiment, and key takeaways for stakeholder-ready storytelling.",
    actionLabel: "Download Narrative PDF",
    icon: FileText,
    previewAccent: "from-primary/70 via-primary/40 to-primary/10",
    highlights: {
      "7": "Captures the latest narratives so you can brief teams quickly on emerging decisions.",
      "30": "Spot evolving themes across the month with highlighted momentum indicators.",
      quarter: "Quarterly rollups spotlight strategic inflection points and narrative shifts.",
      all: "Comprehensive historical narrative library with filters for author, topic, and archetype.",
    },
  },
  {
    id: "stats",
    title: "Download Stats PDF",
    description:
      "Dive into quantitative performance, portfolio health, and pattern recognition with visual dashboards.",
    actionLabel: "Download Stats PDF",
    icon: BarChart3,
    previewAccent: "from-orange-500/60 via-orange-400/30 to-transparent",
    highlights: {
      "7": "Weekly pulse charts reveal fresh volatility and stability ratings.",
      "30": "Monthly deltas surface wins, risks, and ROI momentum.",
      quarter: "Quarterly benchmarks compare team, initiative, and strategic outcomes.",
      all: "Full history with trend lines, z-scores, and benchmark overlays for every metric.",
    },
  },
  {
    id: "csv",
    title: "Export CSV",
    description:
      "Flexible data export for custom analysis. Load into spreadsheets, BI tools, or automate workflows.",
    actionLabel: "Export CSV",
    icon: FileDown,
    previewAccent: "from-emerald-500/60 via-emerald-400/30 to-transparent",
    highlights: {
      "7": "Grab the freshest entries for quick ad-hoc exploration.",
      "30": "Review month-to-month shifts with calculated columns included.",
      quarter: "Bundle quarter-to-date portfolio moves with metadata fields intact.",
      all: "Download the full historical dataset with schema documentation.",
    },
  },
  {
    id: "summary",
    title: "Download Portfolio Summary One Pager",
    description:
      "A crisp executive snapshot with decision posture, pressure index, and recommended next steps.",
    actionLabel: "Download One Pager",
    icon: FileChartColumn,
    previewAccent: "from-sky-500/60 via-sky-400/30 to-transparent",
    highlights: {
      "7": "Surface immediate opportunities and blockers from the past week.",
      "30": "Show momentum, resourcing asks, and confidence trends for the month.",
      quarter: "Quarterly spotlight on portfolio allocation, returns, and strategic bets.",
      all: "Full program overview with evergreen guidance and highlight reel.",
    },
  },
];

const timeframeDescriptions: Record<Timeframe, string> = {
  "7": "Focused on the last seven days of decisions and outcomes.",
  "30": "Aggregated insights from the previous thirty days.",
  quarter: "Rollup of the current quarter's activity and learnings.",
  all: "Complete historical view across your entire decision portfolio.",
};

export default function ReportsPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("7");

  const timeframeLabel = useMemo(
    () => TIMEFRAMES.find(({ value }) => value === selectedTimeframe)?.label ?? "Last 7 Days",
    [selectedTimeframe],
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="rounded-2xl border bg-card/80 p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <AnimatedCompass className="h-12 w-12" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                The Decision NAVigator
              </p>
              <h1 className="text-3xl font-bold">Reports &amp; Exports Command Center</h1>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit">Centralize every downloadable insight in one place.</Badge>
        </div>
        <p className="mt-6 max-w-3xl text-base text-muted-foreground">
          Access curated deliverables that translate your D-NAV intelligence into shareable assets. Choose a timeframe to
          instantly tailor the narrative, stats, data tables, and executive-ready overviews.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Filter by timeframe</h2>
            <p className="text-sm text-muted-foreground">{timeframeDescriptions[selectedTimeframe]}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIMEFRAMES.map(({ value, label }) => (
              <Button
                key={value}
                variant={selectedTimeframe === value ? "default" : "outline"}
                onClick={() => setSelectedTimeframe(value)}
                className={cn("px-4", selectedTimeframe === value ? "shadow-sm" : "bg-muted/60")}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        {reports.map(({ id, title, description, actionLabel, icon: Icon, previewAccent, highlights }) => (
          <Card key={id} className="overflow-hidden border-muted/60 bg-card/90 shadow-sm">
            <CardHeader className="border-b bg-muted/40">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-semibold">{title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Badge variant="outline" className="self-start">
                  {timeframeLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-5">
                <div className="rounded-xl border border-dashed border-muted bg-background/40 p-4 text-sm text-muted-foreground">
                  {highlights[selectedTimeframe]}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">What this includes:</span>
                  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <li className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Tailored to {timeframeLabel.toLowerCase()}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/70" />
                      Seamless download in one click
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-orange-400/80" /> Ready for stakeholder sharing
                    </li>
                  </ul>
                </div>
                <Button className="w-full sm:w-auto" size="lg">
                  <Icon className="mr-2 h-5 w-5" />
                  {actionLabel}
                </Button>
              </div>
              <div className="relative hidden rounded-xl border border-muted/50 bg-muted/40 p-4 lg:block">
                <div
                  className={cn(
                    "relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br",
                    previewAccent,
                  )}
                >
                  <div className="absolute inset-0 bg-background/70" />
                  <div className="relative flex h-full w-full flex-col justify-between rounded-lg border border-muted bg-background/80 p-4 text-[10px] shadow-inner">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-primary/10" />
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          The Decision NAVigator
                        </div>
                      </div>
                      <div className="h-2 w-3/4 rounded bg-muted" />
                      <div className="h-2 w-2/3 rounded bg-muted/70" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 rounded bg-muted/80" />
                      <div className="h-2 rounded bg-muted/60" />
                      <div className="h-2 rounded bg-muted/40" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="h-10 flex-1 rounded bg-primary/20" />
                        <div className="h-10 flex-1 rounded bg-orange-200/40" />
                      </div>
                      <div className="h-2 rounded bg-muted/50" />
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>{title}</span>
                      <span>{timeframeLabel}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center text-xs text-muted-foreground">
                  Preview mockup – actual export reflects live data
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
