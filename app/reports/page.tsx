"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
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

type ReportFormat = {
  type: "pdf" | "csv";
  label: string;
};

type Report = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  highlights: Record<Timeframe, string>;
  formats: ReportFormat[];
};

const reports: Report[] = [
  {
    id: "narrative",
    title: "Narrative Summary",
    description:
      "Stakeholder-ready storytelling that captures sentiment, context, and emerging decision themes.",
    icon: FileText,
    highlights: {
      "7": "Captures the latest narratives so you can brief teams quickly on emerging decisions.",
      "30": "Spot evolving themes across the month with highlighted momentum indicators.",
      quarter: "Quarterly rollups spotlight strategic inflection points and narrative shifts.",
      all: "Comprehensive historical narrative library with filters for author, topic, and archetype.",
    },
    formats: [{ type: "pdf", label: "Download PDF" }],
  },
  {
    id: "stats",
    title: "Performance Dashboard",
    description:
      "Quantitative insights, benchmarks, and trends that illuminate overall portfolio health.",
    icon: BarChart3,
    highlights: {
      "7": "Weekly pulse charts reveal fresh volatility and stability ratings.",
      "30": "Monthly deltas surface wins, risks, and ROI momentum.",
      quarter: "Quarterly benchmarks compare team, initiative, and strategic outcomes.",
      all: "Full history with trend lines, z-scores, and benchmark overlays for every metric.",
    },
    formats: [
      { type: "pdf", label: "Download PDF" },
      { type: "csv", label: "Export CSV" },
    ],
  },
  {
    id: "csv",
    title: "Raw Data Export",
    description:
      "Flexible data export for custom analysis. Load into spreadsheets, BI tools, or automate workflows.",
    icon: FileDown,
    highlights: {
      "7": "Grab the freshest entries for quick ad-hoc exploration.",
      "30": "Review month-to-month shifts with calculated columns included.",
      quarter: "Bundle quarter-to-date portfolio moves with metadata fields intact.",
      all: "Download the full historical dataset with schema documentation.",
    },
    formats: [{ type: "csv", label: "Download CSV" }],
  },
  {
    id: "summary",
    title: "Executive One-Pager",
    description:
      "A crisp executive snapshot outlining decision posture, pressure index, and recommended next steps.",
    icon: FileChartColumn,
    highlights: {
      "7": "Surface immediate opportunities and blockers from the past week.",
      "30": "Show momentum, resourcing asks, and confidence trends for the month.",
      quarter: "Quarterly spotlight on portfolio allocation, returns, and strategic bets.",
      all: "Full program overview with evergreen guidance and highlight reel.",
    },
    formats: [{ type: "pdf", label: "Download PDF" }],
  },
];

const timeframeDescriptions: Record<Timeframe, string> = {
  "7": "Focused on the last seven days of decisions and outcomes.",
  "30": "Aggregated insights from the previous thirty days.",
  quarter: "Rollup of the current quarter's activity and learnings.",
  all: "Complete historical view across your entire decision portfolio.",
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const createCsvContent = ({
  report,
  timeframeLabel,
  highlight,
}: {
  report: Report;
  timeframeLabel: string;
  highlight: string;
}) => {
  const rows = [
    ["Report", report.title],
    ["Timeframe", timeframeLabel],
    [],
    ["Key Highlight"],
    [highlight],
  ];

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell ?? "";
          const escaped = value.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(","),
    )
    .join("\n");
};

const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const candidateWidth = font.widthOfTextAtSize(candidate, size);

    if (candidateWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const createPdfContent = async ({
  report,
  timeframeLabel,
  highlight,
}: {
  report: Report;
  timeframeLabel: string;
  highlight: string;
}) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { height, width } = page.getSize();

  const [regularFont, boldFont] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
  ]);

  page.drawText("D-NAV Report", {
    x: 48,
    y: height - 64,
    size: 12,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  page.drawText(report.title, {
    x: 48,
    y: height - 92,
    size: 26,
    font: boldFont,
    color: rgb(0.09, 0.09, 0.13),
  });

  page.drawText(`Timeframe: ${timeframeLabel}`, {
    x: 48,
    y: height - 124,
    size: 14,
    font: regularFont,
    color: rgb(0.22, 0.22, 0.24),
  });

  const bodyStartY = height - 170;
  const bodySize = 12;
  const maxWidth = width - 96;
  const highlightLines = wrapText(highlight, regularFont, bodySize, maxWidth);
  let cursorY = bodyStartY;

  page.drawText("Highlight", {
    x: 48,
    y: cursorY,
    size: 14,
    font: boldFont,
    color: rgb(0.09, 0.34, 0.61),
  });

  cursorY -= 22;

  highlightLines.forEach((line) => {
    page.drawText(line, {
      x: 48,
      y: cursorY,
      size: bodySize,
      font: regularFont,
      color: rgb(0.18, 0.18, 0.2),
    });
    cursorY -= 18;
  });

  cursorY -= 10;

  const checklist = [
    "Stakeholder-ready formatting",
    "Automated download from D-NAV",
    `Context tailored to ${timeframeLabel.toLowerCase()}`,
  ];

  page.drawText("Quick Facts", {
    x: 48,
    y: cursorY,
    size: 14,
    font: boldFont,
    color: rgb(0.09, 0.34, 0.61),
  });

  cursorY -= 24;

  checklist.forEach((item) => {
    page.drawText(`• ${item}`, {
      x: 52,
      y: cursorY,
      size: bodySize,
      font: regularFont,
      color: rgb(0.18, 0.18, 0.2),
    });
    cursorY -= 18;
  });

  return pdfDoc.save();
};

export default function ReportsPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("7");
  const [downloading, setDownloading] = useState<string | null>(null);

  const timeframeLabel = useMemo(
    () => TIMEFRAMES.find(({ value }) => value === selectedTimeframe)?.label ?? "Last 7 Days",
    [selectedTimeframe],
  );

  const handleDownload = async (report: Report, format: ReportFormat["type"]) => {
    const key = `${report.id}-${format}`;
    setDownloading(key);

    try {
      const highlight = report.highlights[selectedTimeframe];

      if (format === "csv") {
        const csvContent = createCsvContent({
          report,
          timeframeLabel,
          highlight,
        });
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const filename = `dnav-${slugify(report.title)}-${selectedTimeframe}.csv`;
        downloadBlob(blob, filename);
      } else {
        const pdfBytes = await createPdfContent({
          report,
          timeframeLabel,
          highlight,
        });
        const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
        const blob = new Blob([ab], { type: "application/pdf" });
        const filename = `dnav-${slugify(report.title)}-${selectedTimeframe}.pdf`;
        downloadBlob(blob, filename);
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border bg-card/80 p-6 shadow-sm">
        <div className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit uppercase tracking-wide">
            Reports Hub
          </Badge>
          <h1 className="text-3xl font-semibold">Download the report you need in a single click</h1>
          <p className="text-sm text-muted-foreground">
            Pick a timeframe, then grab the narrative, performance, or raw data export that best supports your next
            decision review.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border bg-card/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Filter by timeframe</h2>
            <p className="text-xs text-muted-foreground">{timeframeDescriptions[selectedTimeframe]}</p>
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

      <section className="grid gap-4 lg:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          const isDownloading = (format: ReportFormat["type"]) => downloading === `${report.id}-${format}`;

          return (
            <Card key={report.id} className="border-muted/60 bg-card/90 shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl">{report.title}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">{report.description}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border border-dashed border-muted/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  {report.highlights[selectedTimeframe]}
                </div>
                <div className="flex flex-wrap gap-2">
                  {report.formats.map(({ type, label }) => (
                    <Button
                      key={type}
                      variant={type === "csv" ? "outline" : "default"}
                      disabled={isDownloading(type)}
                      onClick={() => handleDownload(report, type)}
                    >
                      {isDownloading(type) ? "Preparing..." : label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
