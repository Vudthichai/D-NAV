export type PageText = { page: number; text: string };

export type DecisionCandidateDraft = {
  id: string;
  title: string;
  strength: "hard" | "soft";
  category:
    | "Operations"
    | "Finance"
    | "Product"
    | "Hiring"
    | "Legal"
    | "Strategy"
    | "Sales/Go-to-market"
    | "Other";
  decision: string;
  evidence: { page: number; quote: string };
  tags: string[];
  score: number;
};

const HARD_MARKERS = [
  "will",
  "begin",
  "ramp",
  "launch",
  "launched",
  "completed",
  "complete",
  "scheduled",
  "planned",
  "on track",
  "expect",
  "expects",
  "preparation is underway",
  "preparations are underway",
  "remain on track",
  "to start",
  "deliveries beginning",
  "volume production",
] as const;

const SOFT_MARKERS = [
  "aim",
  "aims",
  "focus",
  "prioritize",
  "investment",
  "invest",
  "expand capacity",
  "supply constrained",
  "review every aspect",
  "manage the business",
  "liquidity to fund",
  "cost reduction",
  "capex efficient",
  "roadmap",
] as const;

const TIME_MARKERS = [
  "q1",
  "q2",
  "q3",
  "q4",
  "this quarter",
  "later this year",
  "in 2025",
  "2025",
  "2026",
  "first half",
  "by end of",
  "beginning in early",
] as const;

const CATEGORY_HINTS: Array<{ cat: DecisionCandidateDraft["category"]; re: RegExp }> = [
  { cat: "Product", re: /\b(model|vehicle|fsd|robotaxi|cybercab|software|feature|launch|deliveries)\b/i },
  { cat: "Operations", re: /\b(factory|megafactory|construction|ramp|production|deploy|capacity|refinery|commission)\b/i },
  { cat: "Finance", re: /\b(liquidity|balance sheet|cash flow|capex|profit|margin|financing|tax credit)\b/i },
  { cat: "Sales/Go-to-market", re: /\b(launch in|markets|countries|sales in|configurator)\b/i },
  { cat: "Strategy", re: /\b(strategy|platform|roadmap|priorit|capex efficient|focus)\b/i },
];

function clampQuote(s: string, max = 280) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 3).trim()}...`;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string) {
  const cleaned = text.replace(/\r/g, "\n");
  const chunks = cleaned
    .split(/\n{2,}/g)
    .flatMap((p) => p.split(/(?<=[.!?])\s+/g))
    .map((s) => s.trim())
    .filter((s) => s.length >= 40);
  return chunks;
}

function scoreSentence(s: string) {
  const n = normalize(s);
  let score = 0;

  for (const k of HARD_MARKERS) if (n.includes(k)) score += 6;
  for (const k of SOFT_MARKERS) if (n.includes(k)) score += 3;
  for (const k of TIME_MARKERS) if (n.includes(k)) score += 2;

  if (/\b(to|for)\b\s+\b(begin|start|launch|ramp|commission|deliver)\b/i.test(s)) score += 2;

  if (/\bchart|table|photo|million|percent|unaudited\b/i.test(s)) score -= 2;

  return score;
}

function bestCategory(s: string): DecisionCandidateDraft["category"] {
  for (const hint of CATEGORY_HINTS) if (hint.re.test(s)) return hint.cat;
  return "Other";
}

function makeTitle(decision: string) {
  const words = decision.trim().replace(/\s+/g, " ").split(" ").slice(0, 10);
  let t = words.join(" ");
  t = t.replace(/[“”"]/g, "");
  if (!/[.!?]$/.test(t)) t += ".";
  return t;
}

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function tokenSet(s: string) {
  return new Set(
    normalize(s)
      .split(" ")
      .filter((w) => w.length > 3 && !["this", "that", "with", "from", "will", "have", "were", "they", "them"].includes(w)),
  );
}

export function localExtractDecisionCandidates(
  pages: PageText[],
  opts?: { maxCandidates?: number; minScore?: number },
): DecisionCandidateDraft[] {
  const maxCandidates = opts?.maxCandidates ?? 25;
  const minScore = opts?.minScore ?? 6;

  const scored: Array<{ page: number; sentence: string; score: number }> = [];
  for (const p of pages) {
    for (const s of splitSentences(p.text)) {
      const score = scoreSentence(s);
      if (score >= minScore) scored.push({ page: p.page, sentence: s, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const merged: Array<{ page: number; text: string; score: number }> = [];
  const used = new Set<string>();

  for (let i = 0; i < scored.length; i++) {
    const key = `${scored[i].page}:${normalize(scored[i].sentence).slice(0, 120)}`;
    if (used.has(key)) continue;

    let text = scored[i].sentence;
    let score = scored[i].score;

    for (let j = i + 1; j < Math.min(scored.length, i + 6); j++) {
      if (scored[j].page !== scored[i].page) continue;
      const a = tokenSet(text);
      const b = tokenSet(scored[j].sentence);
      if (jaccard(a, b) >= 0.22) {
        text = `${text} ${scored[j].sentence}`.replace(/\s+/g, " ").trim();
        score += Math.floor(scored[j].score * 0.6);
        used.add(`${scored[j].page}:${normalize(scored[j].sentence).slice(0, 120)}`);
      }
    }

    merged.push({ page: scored[i].page, text, score });
    used.add(key);
  }

  const out: DecisionCandidateDraft[] = [];
  for (const item of merged) {
    const candTokens = tokenSet(item.text);
    const dupIdx = out.findIndex((c) => jaccard(tokenSet(c.decision), candTokens) >= 0.33);
    if (dupIdx !== -1) {
      if (item.score > out[dupIdx].score) {
        out[dupIdx] = {
          ...out[dupIdx],
          decision: item.text,
          evidence: { page: item.page, quote: clampQuote(item.text) },
          score: item.score,
        };
      }
      continue;
    }

    const strength: "hard" | "soft" =
      HARD_MARKERS.some((k) => normalize(item.text).includes(k)) ? "hard" : "soft";

    const decision = item.text.trim();
    out.push({
      id: `local-${item.page}-${Math.abs(normalize(decision).split("").reduce((a, c) => a + c.charCodeAt(0), 0))}`,
      title: makeTitle(decision),
      strength,
      category: bestCategory(decision),
      decision,
      evidence: { page: item.page, quote: clampQuote(decision) },
      tags: [],
      score: item.score,
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, maxCandidates);
}
