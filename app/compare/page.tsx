"use client";

import { Suspense } from "react";

import DecisionCompareSection from "@/components/DecisionCompareSection";

export default function ComparePage() {
  return (
    <main className="container mx-auto max-w-6xl space-y-8 px-4 py-8">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading compare…</div>}>
        <DecisionCompareSection />
      </Suspense>
    </main>
  );
}
