import { InfoTooltip } from "@/components/InfoTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeedbackLoops } from "@/hooks/useFeedbackLoops";
import { ConsistencyIcon, MomentumIcon, RecoveryIcon } from "./icons/feedback";

export default function FeedbackLoops({ series }: { series: number[] }) {
  const { unlocked, needed, momentum, lci, sigma } = useFeedbackLoops(series);

  return (
    <section id="feedback-loops" className="space-y-4">
      <Card>
        <CardHeader className="pb-0">
          <InfoTooltip term="Feedback Loops">
            <CardTitle className="text-base cursor-help">Feedback Loops</CardTitle>
          </InfoTooltip>
        </CardHeader>
        {!unlocked ? (
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
        ) : (
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 rounded-lg bg-primary/10 p-2 text-primary">
                  <RecoveryIcon className="h-6 w-6" />
                </span>
                <div className="space-y-2 text-sm">
                  <InfoTooltip term="Recovery (LCI)">
                    <p className="text-sm font-medium text-muted-foreground cursor-help">Recovery (LCI)</p>
                  </InfoTooltip>
                  {lci ? (
                    <>
                      <p className="text-2xl font-semibold text-foreground">{lci.lci.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        Recovery efficiency after dips. Combines how much you rebound and how fast.
                      </p>
                      <p className="text-xs">
                        Completeness {lci.completeness.toFixed(2)} · Speed {lci.speed.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lci.lci > 1 ? "Over-recovery" : Math.abs(lci.lci - 1) <= 0.05 ? "Full" : "Under"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent drawdown detected.</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-1 rounded-lg bg-primary/10 p-2 text-primary">
                  <MomentumIcon className="h-6 w-6" />
                </span>
                <div className="space-y-2 text-sm w-full">
                  <InfoTooltip term="Momentum">
                    <p className="text-sm font-medium text-muted-foreground cursor-help">Momentum</p>
                  </InfoTooltip>
                  {momentum.length ? (
                    <div className="space-y-1">
                      {momentum.map((m) => (
                        <div key={m.n} className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-foreground">
                            {m.label} <span className="text-muted-foreground">(n={m.n})</span>
                          </span>
                          <span className="font-medium text-foreground">{m.slope.toFixed(2)} D-NAV/decision</span>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Trend velocity over the last n decisions (slope of moving average). Short = steering · Mid = course · Long =
                        climate.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Need more data for momentum windows.</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-1 rounded-lg bg-primary/10 p-2 text-primary">
                  <ConsistencyIcon className="h-6 w-6" />
                </span>
                <div className="space-y-2 text-sm">
                  <InfoTooltip term="Consistency">
                    <p className="text-sm font-medium text-muted-foreground cursor-help">Consistency</p>
                  </InfoTooltip>
                  {sigma !== null ? (
                    <>
                      <p className="text-2xl font-semibold text-foreground">{sigma.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Volatility of recent D-NAV. Lower = more steady.</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Need more data.</p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Recovery = bounce-back efficiency · Momentum = improvement trajectory · Consistency = stability of judgment.
            </p>
          </CardContent>
        )}
      </Card>
    </section>
  );
}
