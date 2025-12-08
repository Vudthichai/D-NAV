"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Distribution {
  positive: number;
  neutral: number;
  negative: number;
}

const SegmentBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <span>{value.toFixed(1)}%</span>
    </div>
    <div className="h-2 rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
    </div>
  </div>
);

export default function StabilityDistributionCard({ distribution }: { distribution: Distribution }) {
  return (
    <Card className="border bg-card/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Stability Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <SegmentBar label="Stable" value={distribution.positive} color="#22c55e" />
        <SegmentBar label="Uncertain" value={distribution.neutral} color="#eab308" />
        <SegmentBar label="Fragile" value={distribution.negative} color="#ef4444" />
      </CardContent>
    </Card>
  );
}
