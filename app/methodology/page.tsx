export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-10">
          <header className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">Methodology</h1>
            <p className="text-muted-foreground">
              A plain-language guide to what D-NAV measures, how inputs are scaled, and how regime
              labels are assigned.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What D-NAV measures</h2>
            <p className="text-muted-foreground">
              D-NAV focuses on judgment quality — the balance of return potential, pressure, and
              stability behind a decision — rather than the final outcome alone.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Inputs and ranges</h2>
            <p className="text-muted-foreground">
              Each decision captures Return (R), Pressure (P), and Stability (S) on a shared range
              from −9 to +9. D-NAV scores extend beyond this range to capture compounded effects.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Normalization</h2>
            <p className="text-muted-foreground">
              Normalization keeps every input comparable so that high-pressure situations and high
              return potential can be evaluated on the same scale.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Aggregation</h2>
            <p className="text-muted-foreground">
              Pressure contributes negatively to the overall score, while Return and Stability push
              the score upward. The aggregate provides a single D-NAV value for the decision.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Regimes</h2>
            <p className="text-muted-foreground">
              Regime labels are applied after scores are computed. They summarize the dominant
              decision posture in plain language for fast scanning.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Variance</h2>
            <p className="text-muted-foreground">
              Variance highlights how consistently a system makes decisions with similar quality.
              High variance signals uneven judgment patterns that deserve review.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
