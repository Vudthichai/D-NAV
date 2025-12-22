// D-NAV Calculation Logic
export interface DecisionVariables {
  impact: number;
  cost: number;
  risk: number;
  urgency: number;
  confidence: number;
}

export interface DecisionMetrics {
  return: number;
  stability: number;
  pressure: number;
  merit: number;
  energy: number;
  dnav: number;
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

export interface ArchetypeInfo {
  name: string;
  description: string;
  pressureType: string;
  stabilityType: string;
  returnType: string;
}

export function getArchetype(metrics: DecisionMetrics): ArchetypeInfo {
  const pS = sign3(metrics.pressure);
  const sS = sign3(metrics.stability);
  const rS = sign3(metrics.return);
  const key = [pS, sS, rS].join('|');
  const name = oneWordArchetypes[key] || 'Unclassified';

  const Pword = (s: number) => s > 0 ? 'Pressured' : (s < 0 ? 'Calm' : 'Balanced');
  const Sword = (s: number) => s > 0 ? 'Stable' : (s < 0 ? 'Fragile' : 'Uncertain');
  const Rword = (s: number) => s > 0 ? 'Gain' : (s < 0 ? 'Loss' : 'Flat');

  const description = `${Rword(rS)} with ${Sword(sS).toLowerCase()} footing — ${Pword(pS).toLowerCase()} execution.`;

  return {
    name,
    description,
    pressureType: Pword(pS),
    stabilityType: Sword(sS),
    returnType: Rword(rS),
  };
}

export function getScoreTagText(n: number): string {
  if (n >= 80) return "Very high D-NAV";
  if (n >= 50) return "High D-NAV";
  if (n >= 25) return "Moderate D-NAV";
  return "Low D-NAV";
}

export function coachHint(vars: DecisionVariables, metrics: DecisionMetrics): string {
  const et = energyTier(vars.urgency, vars.confidence);
  let sugs: string[] = [];
  
  const needRaiseImpact = (vars.impact <= vars.cost) && (metrics.return <= 0);
  const needLowerCosts = (vars.impact <= vars.cost) && (metrics.return <= 0);
  const needLowerRisks = (vars.risk >= vars.confidence);
  const needAddEvidence = (metrics.stability <= 0);
  const needNarrowScope = (metrics.pressure > 0);
  const needAddCapacity = (metrics.pressure > 0 && (et.short === "overdrive" || et.short === "high"));
  
  if (needRaiseImpact) sugs.push("raise impact");
  if (needLowerCosts) sugs.push("lower costs");
  if (needLowerRisks) sugs.push("lower risks");
  if (needAddEvidence) sugs.push("add evidence");
  if (needNarrowScope) sugs.push("narrow scope");
  if (needAddCapacity) sugs.push("add capacity");
  
  const hasCosts = sugs.includes("lower costs");
  const hasRisks = sugs.includes("lower risks");
  if (hasCosts || hasRisks) {
    sugs = sugs.filter(s => s !== "lower costs" && s !== "lower risks");
    sugs.push(hasCosts && hasRisks ? "lower costs and/or risks" : (hasCosts ? "lower costs" : "lower risks"));
  }
  
  sugs = [...new Set(sugs)].slice(0, 2);
  const leverLine = sugs.length ? " — " + sugs.join("; ") + "." : ".";
  
  if (metrics.return < 0) {
    const base = (et.short === "high" || et.short === "overdrive") 
      ? "High energy chasing negative return — stop or pivot" 
      : "Negative return — improve unit economics";
    return base + leverLine;
  }
  
  if (metrics.return === 0) {
    let base = "Neutral return";
    if (metrics.pressure > 0 && metrics.stability <= 0) base += " under pressure on fragile footing";
    else if (metrics.pressure > 0) base += " under pressure";
    else if (metrics.stability <= 0) base += " but fragile";
    return base + leverLine;
  }
  
  if (metrics.stability <= 0 && metrics.pressure > 0) return "Upside with fragile footing and pressure" + leverLine;
  if (metrics.stability <= 0) return "Upside but fragile — shore up footing before scaling" + leverLine;
  if (metrics.pressure > 0) return "Good profile, but pressured" + leverLine;
  return sugs.length ? "Greenlight profile" + leverLine : "Greenlight profile — execute with discipline.";
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
