import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useFeedbackLoops } from "@/hooks/useFeedbackLoops";

export default function FeedbackLoops({ series }: { series: number[] }) {
  const { unlocked, needed, momentum, lci, sigma } = useFeedbackLoops(series);

  return (
    <section id="feedback-loops" className="space-y-4">
      <h3 className="text-xl font-semibold">Feedback Loops</h3>

      {!unlocked ? (
        <Card>
          <CardHeader className="pb-2">Feedback Loops</CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              Log <span className="font-semibold">{needed}</span> more decision(s) to unlock your Feedback Loops — see how you
              recover, grow, and stabilize over time.
            </p>
            <p className="text-xs text-muted-foreground">
              Once unlocked, you’ll see how quickly you bounce back from dips, how your decision quality is trending, and how steady
              your judgment has been.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">Recovery (LCI)</CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lci ? (
                <>
                  <div className="text-2xl font-semibold">{lci.lci.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Recovery efficiency after dips. Combines how much you rebound and how fast.</p>
                  <p className="text-xs">
                    Completeness {lci.completeness.toFixed(2)} · Speed {lci.speed.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lci.lci > 1
                      ? "Over-recovery"
                      : Math.abs(lci.lci - 1) <= 0.05
                      ? "Full"
                      : "Under"}
                  </p>
                </>
              ) : (
                <p>No recent drawdown detected.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">Momentum</CardHeader>
            <CardContent className="space-y-2 text-sm">
              {momentum.length ? (
                <>
                  {momentum.map((m) => (
                    <div key={m.n} className="flex items-center justify-between">
                      <span>
                        {m.label} (n={m.n})
                      </span>
                      <span>{m.slope.toFixed(2)} D-NAV/decision</span>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Trend velocity over the last n decisions (slope of moving average). Short = steering · Mid = course · Long = climate.
                  </p>
                </>
              ) : (
                <p>Need more data for momentum windows.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">Consistency</CardHeader>
            <CardContent className="space-y-2 text-sm">
              {sigma !== null ? (
                <>
                  <div className="text-2xl font-semibold">{sigma.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Volatility of recent D-NAV. Lower = more steady.</p>
                </>
              ) : (
                <p>Need more data.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Recovery = bounce-back efficiency · Momentum = improvement trajectory · Consistency = stability of judgment.
      </p>
    </section>
  );
}
