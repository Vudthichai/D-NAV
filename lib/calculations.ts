// D-NAV Calculation Logic
export interface DecisionVariables {
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
}

export type LeverageKey = keyof DecisionVariables | "interaction";

export interface DecisionMetrics {
  return: number;
  stability: number;
  pressure: number;
  merit: number;
  energy: number;
  dnav: number;
}

export type JudgmentSignalKey =
  | "fragileExecution"
  | "narrativeInflation"
  | "rushedWithoutNecessity"
  | "underexploitedLeverage";

export interface JudgmentSignal {
  key: JudgmentSignalKey;
  label: string;
  explanation: string;
  correctiveMove: string;
}

export interface DecisionEntry extends DecisionVariables, DecisionMetrics {
  ts: number;
  name: string;
  category: string;
  id?: string;
  title?: string;
  createdAt?: number;
  dNav?: number | string | null;
  R?: number | string | null;
  P?: number | string | null;
  S?: number | string | null;
  "D-NAV"?: number | string | null;
  DNAV?: number | string | null;
  D_NAV?: number | string | null;
  D?: number | string | null;
  "Return"?: number | string | null;
  "Pressure"?: number | string | null;
  "Stability"?: number | string | null;
  impact0?: number;
  cost0?: number;
  risk0?: number;
  urgency0?: number;
  confidence0?: number;
  impact1?: number;
  cost1?: number;
  risk1?: number;
  urgency1?: number;
  confidence1?: number;
  return0?: number;
  pressure0?: number;
  stability0?: number;
  return1?: number;
  pressure1?: number;
  stability1?: number;
  dnavScore?: number;
  regime?: string | null;
  regimeLabel?: string | null;
  policy?: string | null;
  policyLabel?: string | null;
  vehicleSegment?: string | null;
  archetype?: string | null;
  label?: string | null;
  resolutionWindow?: number | string;
  resolvedAt?: number | null;
}

export interface EnergyTier {
  e: number;
  name: string;
  short: string;
}

// One-word archetypes (keyed by P|S|R)
export const oneWordArchetypes: Record<string, string> = {
  "1|1|1": "Breakthrough", "0|1|1": "Advance", "-1|1|1": "Harvest",
  "1|0|1": "Sprint", "0|0|1": "Build", "-1|0|1": "Coast",
  "1|-1|1": "Gamble", "0|-1|1": "Moonshot", "-1|-1|1": "Prospect",
  "1|1|0": "Grind", "0|1|0": "Maintain", "-1|1|0": "Idle",
  "1|0|0": "Firefight", "0|0|0": "Routine", "-1|0|0": "Drift",
  "1|-1|0": "Strain", "0|-1|0": "Wobble", "-1|-1|0": "Teeter",
  "1|1|-1": "Overreach", "0|1|-1": "Erode", "-1|1|-1": "Complacency",
  "1|0|-1": "Burn", "0|0|-1": "Waste", "-1|0|-1": "Leak",
  "1|-1|-1": "Meltdown", "0|-1|-1": "Collapse", "-1|-1|-1": "Decay"
};

export type RpsSignal = -1 | 0 | 1;

const archetypeSignalsByName: Record<string, { r: RpsSignal; p: RpsSignal; s: RpsSignal }> =
  Object.entries(oneWordArchetypes).reduce(
    (acc, [key, name]) => {
      const [p, s, r] = key.split("|").map((value) => Number(value) as RpsSignal);
      acc[name] = { r, p, s };
      return acc;
    },
    {} as Record<string, { r: RpsSignal; p: RpsSignal; s: RpsSignal }>
  );

export function getArchetypeSignals(archetypeName: string): { r: RpsSignal; p: RpsSignal; s: RpsSignal } | null {
  return archetypeSignalsByName[archetypeName] ?? null;
}

export function sign3(x: number): number {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

export function energyTier(u: number, c: number): EnergyTier {
  const e = (u || 0) * (c || 0);
  if (e >= 71) return { e, name: "Overdrive energy", short: "overdrive" };
  if (e >= 41) return { e, name: "High energy", short: "high" };
  if (e >= 16) return { e, name: "Moderate energy", short: "moderate" };
  return { e, name: "Low energy", short: "low" };
}

export function computeMetrics(vars: DecisionVariables): DecisionMetrics {
  const ret = vars.impact - vars.cost;
  const stability = vars.confidence - vars.risk;
  const pressure = vars.urgency - vars.confidence;
  const merit = vars.impact - vars.cost - vars.risk;
  const eInfo = energyTier(vars.urgency, vars.confidence);
  const dnav = merit + eInfo.e;
  
  return {
    return: ret,
    stability,
    pressure,
    merit,
    energy: eInfo.e,
    dnav
  };
}

export function detectJudgmentSignal(vars: DecisionVariables, metrics: DecisionMetrics): JudgmentSignal | null {
  const { confidence, risk, urgency } = vars;
  const { pressure, return: ret, stability } = metrics;

  const candidates: Array<JudgmentSignal & { severity: number; priority: number }> = [];

  if (pressure >= 2 && stability <= 0) {
    candidates.push({
      key: "fragileExecution",
      label: "Pressure is high with fragile Stability.",
      explanation:
        "Urgency is outpacing Confidence while Risk is not contained by that Confidence.",
      correctiveMove: "Reduce Urgency, raise Confidence, or lower Risk before committing.",
      severity: pressure - stability + 1,
      priority: 0,
    });
  }

  if (confidence >= 7 && ret <= 1) {
    candidates.push({
      key: "narrativeInflation",
      label: "Return is flat or negative with strong Stability.",
      explanation:
        "Confidence is running ahead of the upside and Cost is not yet covered.",
      correctiveMove: "Increase Impact or reduce Cost before raising Confidence further.",
      severity: confidence - ret,
      priority: 1,
    });
  }

  if ((urgency >= 7 && risk <= 3) || (pressure >= 2 && risk <= 3)) {
    const pressureBoost = pressure >= 2 ? pressure - 1 : 0;
    candidates.push({
      key: "rushedWithoutNecessity",
      label: "Pressure is elevated while Stability is steady.",
      explanation:
        "Urgency is climbing even though Risk stays low and Confidence is not leading the pace.",
      correctiveMove: "Lower Urgency or raise Confidence while keeping Risk explicit.",
      severity: urgency + pressureBoost - risk,
      priority: 2,
    });
  }

  if (ret >= 6 && stability >= 2 && pressure <= 1) {
    candidates.push({
      key: "underexploitedLeverage",
      label: "Return is strong with stable Stability and low Pressure.",
      explanation:
        "Upside is clear and Risk feels contained, but Urgency is not pulling action.",
      correctiveMove: "Increase Impact while keeping Cost and Risk constrained.",
      severity: ret + stability - pressure,
      priority: 3,
    });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    return a.priority - b.priority;
  });

  const strongest = candidates[0];

  if (strongest.severity <= 0) return null;

  const { severity, priority, ...signal } = strongest;
  void severity;
  void priority;
  return signal;
}

export interface ArchetypeInfo {
  name: string;
  description: string;
  pressureType: string;
  stabilityType: string;
  returnType: string;
}

export interface ReadoutLines {
  condition: string;
  meaning: string;
  action: string;
}

export function getArchetype(metrics: DecisionMetrics): ArchetypeInfo {
  const pS = sign3(metrics.pressure);
  const sS = sign3(metrics.stability);
  const rS = sign3(metrics.return);
  const key = [pS, sS, rS].join('|');
  const name = oneWordArchetypes[key] || 'Unclassified';

  const returnLine =
    rS > 0
      ? "Return is leading."
      : rS < 0
      ? "Return is dragging."
      : "Return is neutral.";
  const stabilityLine =
    sS > 0
      ? "Stability is steady."
      : sS < 0
      ? "Stability is fragile."
      : "Stability is mixed.";
  const pressureLine =
    pS > 0
      ? "Pressure is driving the pace."
      : pS < 0
      ? "Pressure is light."
      : "Pressure is balanced.";
  const description = `${returnLine} ${stabilityLine} ${pressureLine}`;

  return {
    name,
    description,
    pressureType: pS > 0 ? "Urgency > Confidence" : pS < 0 ? "Confidence > Urgency" : "Urgency = Confidence",
    stabilityType: sS > 0 ? "Confidence > Risk" : sS < 0 ? "Risk > Confidence" : "Confidence = Risk",
    returnType: rS > 0 ? "Impact > Cost" : rS < 0 ? "Cost > Impact" : "Impact = Cost",
  };
}

export function getScoreTagText(n: number): string {
  if (n >= 80) return "Very high D-NAV";
  if (n >= 50) return "High D-NAV";
  if (n >= 25) return "Moderate D-NAV";
  return "Low D-NAV";
}

export function getReadoutLines(
  metrics: DecisionMetrics,
  judgmentSignal?: JudgmentSignal | null,
): ReadoutLines {
  if (judgmentSignal) {
    return {
      condition: judgmentSignal.label,
      meaning: judgmentSignal.explanation ?? "Signal detected in the current D-NAV balance.",
      action: judgmentSignal.correctiveMove ?? "Adjust Impact, Cost, Risk, Urgency, or Confidence to resolve it.",
    };
  }

  const returnState = metrics.return >= 2 ? "positive" : metrics.return <= -2 ? "negative" : "flat";
  const pressureState = metrics.pressure >= 2 ? "elevated" : metrics.pressure <= -2 ? "low" : "balanced";
  const stabilityState = metrics.stability >= 2 ? "steady" : metrics.stability <= -2 ? "fragile" : "uncertain";

  const returnMeaning =
    returnState === "positive"
      ? "the upside is carrying the decision"
      : returnState === "negative"
      ? "the upside is not covering the spend"
      : "the upside is not decisive yet";
  const pressureMeaning =
    pressureState === "elevated"
      ? "time pressure is setting the pace"
      : pressureState === "low"
      ? "time pressure is light"
      : "timing is not the deciding factor";
  const stabilityMeaning =
    stabilityState === "steady"
      ? "evidence is holding against exposure"
      : stabilityState === "fragile"
      ? "evidence is not holding against exposure"
      : "evidence and exposure are close";

  return {
    condition: `Return is ${returnState} with ${pressureState} Pressure and ${stabilityState} Stability.`,
    meaning: `${returnMeaning}, ${pressureMeaning}, and ${stabilityMeaning}.`,
    action:
      returnState === "negative"
        ? "Increase Impact or reduce Cost before moving."
        : stabilityState === "fragile"
        ? "Raise Confidence or reduce Risk before committing."
        : pressureState === "elevated"
        ? "Reduce Urgency or raise Confidence to ease Pressure."
        : pressureState === "low"
        ? "Validate Urgency, then raise Impact or Confidence before adding Cost or Risk."
        : returnState === "flat"
        ? "Increase Impact or reduce Cost to make Return decisive."
        : "Increase Impact while keeping Cost and Risk constrained.",
  };
}

// Math helpers
export function ema(arr: number[], span: number): number {
  if (!arr.length) return 0;
  const alpha = 2 / (span + 1);
  let e = arr[0];
  for (let i = 1; i < arr.length; i++) {
    e = alpha * arr[i] + (1 - alpha) * e;
  }
  return e;
}

export function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1);
  return Math.sqrt(v);
}

export function corr(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const xs = x.slice(0, n), ys = y.slice(0, n);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx, vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return 0;
  return num / den;
}

// CSV parsing
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0, cur: string[] = [], val = '', inQ = false;
  
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { val += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      val += c; i++; continue;
    } else {
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { cur.push(val); val = ''; i++; continue; }
      if (c === '\n') { cur.push(val); rows.push(cur); cur = []; val = ''; i++; continue; }
      if (c === '\r') {
        if (text[i + 1] === '\n') { i += 2; cur.push(val); rows.push(cur); cur = []; val = ''; continue; }
        cur.push(val); rows.push(cur); cur = []; val = ''; i++; continue;
      }
      val += c; i++; continue;
    }
  }
  cur.push(val); rows.push(cur);
  while (rows.length && rows[rows.length - 1].every(x => x === '')) rows.pop();
  return rows;
}

export function formatLocal(ts: number): string {
  const d = new Date(ts);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}

export function escapeHtml(s: string = ''): string {
  return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
}
