import { computeMetrics, getDeltas, makeNarrative, smallestNudge, Sliders } from "@/lib/metrics";

type Props = { base: Sliders; scenario: Sliders; title: string };

export default function ComparePanel({ base, scenario, title }: Props) {
  const baseMetrics = computeMetrics(base);
  const scenarioMetrics = computeMetrics(scenario);
  const deltas = getDeltas(baseMetrics, scenarioMetrics);
  const { headline, tradeoffs } = makeNarrative(deltas);
  const verdictDelta = deltas.find((delta) => delta.metric === "dnav")?.delta ?? 0;
  const nudge = smallestNudge(scenario);
  const sign = verdictDelta > 0 ? "win" : verdictDelta < 0 ? "loss" : "flat";
  const magnitude = Math.min(100, Math.abs(verdictDelta) * 10);

  return (
    <section className="compare-card">
      <header className="compare-header">
        <h3>{title}</h3>
        <div className={`verdict ${sign}`}>
          <span className="verdict-label">
            {verdictDelta > 0
              ? `Higher D-NAV (+${formatDelta(verdictDelta)})`
              : verdictDelta < 0
              ? `Lower D-NAV (-${formatDelta(Math.abs(verdictDelta))})`
              : "Same D-NAV"}
          </span>
          <div className="verdict-bar">
            <div className="verdict-fill" style={{ width: `${magnitude}%` }} />
          </div>
        </div>
      </header>

      <p className="narrative">{ensurePeriod(headline)}</p>

      {tradeoffs.length > 0 ? (
        <ul className="tradeoffs">
          {tradeoffs.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <ul className="tradeoffs">
          <li>No major trade-offs detected.</li>
        </ul>
      )}

      <div className="nudge">
        <strong>Smallest nudge:</strong>{" "}
        {nudge.dnavGain <= 0
          ? "No single +/-1 change improves D-NAV."
          : `${capitalize(nudge.slider)} ${nudge.direction > 0 ? "+1" : "-1"} → +${formatDelta(nudge.dnavGain)} D-NAV (to ${formatDelta(
              nudge.newDnav
            )})`}
      </div>

      <details className="details">
        <summary>See metric details</summary>
        <table className="delta-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Base</th>
              <th>Scenario</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {deltas.map((delta) => (
              <tr key={delta.metric}>
                <td>{label(delta.metric)}</td>
                <td>{fmt(delta.base)}</td>
                <td>{fmt(delta.scenario)}</td>
                <td className={delta.delta > 0 ? "pos" : delta.delta < 0 ? "neg" : undefined}>{signed(delta.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function label(metric: string) {
  return metric.toUpperCase().replace("DNAV", "D-NAV");
}

function fmt(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function signed(value: number) {
  if (value === 0) return "0";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${fmt(value)}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ensurePeriod(text: string) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function formatDelta(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}
