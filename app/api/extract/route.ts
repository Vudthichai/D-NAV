// app/api/extract/route.ts
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CommitmentType =
  | "explicit_action"
  | "explicit_refusal"
  | "implicit_commitment";

type DegeneracyCheck = "non_degenerate" | "degenerate_excluded";

type DecisionJudgment = {
  id: string;
  title: string;
  decision: string;
  rationale: string;
  category: string | null;
  evidence_quotes: string[];
  source: string | null;
  future_space: string[];
  commitment_type: CommitmentType;
  constraints: string[];
  uncertainty_sources: string[];
  degeneracy_check: DegeneracyCheck;
  decision_density: number;
  extract_confidence: number;
  dnav: {
    impact: number | null;
    cost: number | null;
    risk: number | null;
    urgency: number | null;
    confidence: number | null;
  } | null;
};

type ExtractionResult = {
  decisions: DecisionJudgment[];
};

type SafeJsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

function safeJsonParse(text: string): SafeJsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const candidate = text.slice(start, end + 1);
      try {
        return { ok: true, value: JSON.parse(candidate) };
      } catch (innerErr) {
        return {
          ok: false,
          error:
            innerErr instanceof Error
              ? innerErr.message
              : "Failed to parse JSON candidate.",
        };
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse JSON.",
    };
  }
}

function hashId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `dnav_${Math.abs(hash).toString(36)}`;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeStringArray(value: unknown, maxItems?: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  const sliced = typeof maxItems === "number" ? items.slice(0, maxItems) : items;
  return sliced;
}

function normalizeJudgment(obj: unknown): DecisionJudgment | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  const decision =
    typeof record.decision === "string" ? record.decision.trim() : "";
  const rationale =
    typeof record.rationale === "string" ? record.rationale.trim() : "";
  const futureSpace = normalizeStringArray(record.future_space);
  const constraints = normalizeStringArray(record.constraints) ?? [];
  const uncertainty = normalizeStringArray(record.uncertainty_sources) ?? [];
  const evidenceQuotes =
    normalizeStringArray(record.evidence_quotes, 2) ?? [];

  const commitmentType = record.commitment_type as CommitmentType | undefined;
  const degeneracyCheck = record.degeneracy_check as
    | DegeneracyCheck
    | undefined;

  const decisionDensity = coerceNumber(record.decision_density);
  const extractConfidence = coerceNumber(record.extract_confidence);

  if (!title || !decision || !rationale) return null;
  if (!futureSpace || futureSpace.length === 0) return null;
  if (
    commitmentType !== "explicit_action" &&
    commitmentType !== "explicit_refusal" &&
    commitmentType !== "implicit_commitment"
  ) {
    return null;
  }
  if (
    degeneracyCheck !== "non_degenerate" &&
    degeneracyCheck !== "degenerate_excluded"
  ) {
    return null;
  }
  if (decisionDensity === null || extractConfidence === null) return null;

  const category =
    typeof record.category === "string" ? record.category.trim() : null;
  const source = typeof record.source === "string" ? record.source.trim() : null;

  const dnavValue = record.dnav;
  let dnav: DecisionJudgment["dnav"] = null;
  if (dnavValue && typeof dnavValue === "object") {
    const dnavRecord = dnavValue as Record<string, unknown>;
    const impact = coerceNumber(dnavRecord.impact);
    const cost = coerceNumber(dnavRecord.cost);
    const risk = coerceNumber(dnavRecord.risk);
    const urgency = coerceNumber(dnavRecord.urgency);
    const confidence = coerceNumber(dnavRecord.confidence);

    dnav = {
      impact: impact === null ? null : clamp(impact, 1, 10),
      cost: cost === null ? null : clamp(cost, 1, 10),
      risk: risk === null ? null : clamp(risk, 1, 10),
      urgency: urgency === null ? null : clamp(urgency, 1, 10),
      confidence: confidence === null ? null : clamp(confidence, 1, 10),
    };
  }

  const normalized: DecisionJudgment = {
    id: hashId(`${title}|${decision}`),
    title,
    decision,
    rationale,
    category: category || null,
    evidence_quotes: evidenceQuotes,
    source: source || null,
    future_space: futureSpace,
    commitment_type: commitmentType,
    constraints,
    uncertainty_sources: uncertainty,
    degeneracy_check: degeneracyCheck,
    decision_density: clamp(decisionDensity, 0, 1),
    extract_confidence: clamp(extractConfidence, 0, 1),
    dnav,
  };

  if (normalized.degeneracy_check === "degenerate_excluded") return null;

  return normalized;
}

function getResponseText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const record = response as Record<string, unknown>;
  const outputText = record.output_text;
  if (typeof outputText === "string") {
    return outputText.trim();
  }

  const output = record.output;
  const outputArray = Array.isArray(output) ? output : [];
  const chunks: string[] = [];
  for (const outputItem of outputArray) {
    const content = (outputItem as Record<string, unknown>)?.content;
    if (!Array.isArray(content)) continue;
    for (const contentItem of content) {
      const contentRecord = contentItem as Record<string, unknown>;
      if (contentRecord.type === "output_text" && contentRecord.text) {
        chunks.push(String(contentRecord.text));
      }
    }
  }

  return chunks.join("\n").trim();
}

async function repairJson(raw: string, signal: AbortSignal): Promise<string> {
  const repairPrompt = `Fix the following to valid JSON only.\n\nRules:\n- Output ONLY JSON.\n- Preserve the existing structure and fields.\n- Do not add commentary.\n\nBROKEN JSON:\n${raw}`;

  const repair = await client.responses.create(
    {
      model: "gpt-5-mini",
      input: repairPrompt,
      store: false,
    },
    { signal }
  );

  return getResponseText(repair);
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY env var on server." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const controller = new AbortController();
    const { signal } = controller;
    const contentType = req.headers.get("content-type") || "";
    let text = "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      text = String(body?.text || "");
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();

      const maybeText = form.get("text");
      if (typeof maybeText === "string") text = maybeText;

      const files = form.getAll("file");
      for (const f of files) {
        if (f instanceof File) {
          const fileText = await f.text().catch(() => "");
          if (fileText) text += `\n\n--- FILE: ${f.name} ---\n${fileText}`;
        }
      }
    } else {
      text = await req.text();
    }

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "No text provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const schemaHint: ExtractionResult = {
      decisions: [
        {
          id: "dnav_abc123",
          title: "Short decision label",
          decision: "What was committed/chosen",
          rationale: "Why it was chosen (stated or strongly implied)",
          category: "Strategy",
          evidence_quotes: ["Short quote 1", "Short quote 2"],
          source: "Section or page",
          future_space: ["Alternative A", "Alternative B"],
          commitment_type: "explicit_action",
          constraints: ["Budget limit", "Regulatory deadline"],
          uncertainty_sources: ["Market response", "Vendor delivery"],
          degeneracy_check: "non_degenerate",
          decision_density: 0.7,
          extract_confidence: 0.8,
          dnav: {
            impact: 7,
            cost: 5,
            risk: 6,
            urgency: 4,
            confidence: 6,
          },
        },
      ],
    };

    const prompt = `You are a decision extraction engine for D-NAV.\n\nOnly extract DECISIONS that satisfy ALL of the following D-NAV definition:\n- A committed allocation of intent under constraint.\n- Multiple futures plausibly existed at commitment time.\n- Uncertainty existed at commitment time.\n- Agency is present.\n- Degeneracy check: EXCLUDE "fake choices" where refusing annihilates all futures (e.g., breathing, escaping a fire). Only include if the future space is non-degenerate.\n\nFILTERING RULES:\n- Exclude trivial daily actions unless they materially allocate resources/intent under constraint with meaningful future divergence.\n- Exclude facts, observations, and status updates that are not commitments.\n- Exclude degenerate cases.\n- Deduplicate aggressively.\n\nOUTPUT RULES (STRICT):\n- Output MUST be valid JSON only, no markdown or commentary.\n- Output MUST be exactly: { "decisions": [DecisionJudgment, ...] }\n- Use the DecisionJudgment schema shown below.\n- evidence_quotes: up to 2 short quotes max; may be empty array.\n- category/source may be null if not inferable.\n- dnav may be null if not inferable.\n- If no valid decisions, return { "decisions": [] }.\n\nDecisionJudgment schema example (shape only):\n${JSON.stringify(schemaHint, null, 2)}\n\nTEXT:\n${text}`;

    const response = await client.responses.create(
      {
        model: "gpt-5-mini",
        input: prompt,
        store: false,
      },
      { signal }
    );

    let raw = getResponseText(response);
    let parsed = safeJsonParse(raw);

    if (!parsed.ok) {
      const repaired = await repairJson(raw, signal);
      raw = repaired;
      parsed = safeJsonParse(repaired);
    }

    if (!parsed.ok || !parsed.value || typeof parsed.value !== "object") {
      return new Response(
        JSON.stringify({
          error: "Model did not return valid JSON.",
          detail: parsed.ok ? "Unexpected shape." : parsed.error,
          raw: raw.slice(0, 2000),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const value = parsed.value as Record<string, unknown>;
    const decisionsRaw = value.decisions;
    if (!Array.isArray(decisionsRaw)) {
      return new Response(
        JSON.stringify({
          error: "Model JSON missing decisions array.",
          raw: raw.slice(0, 2000),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const normalized = decisionsRaw
      .map((item) => normalizeJudgment(item))
      .filter((item): item is DecisionJudgment => Boolean(item));

    const deduped = new Map<string, DecisionJudgment>();
    for (const item of normalized) {
      const existing = deduped.get(item.id);
      if (!existing || item.extract_confidence > existing.extract_confidence) {
        deduped.set(item.id, item);
      }
    }

    const result: ExtractionResult = {
      decisions: Array.from(deduped.values()),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "string"
        ? err
        : (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return "Unknown error";
            }
          })();

    return new Response(
      JSON.stringify({ error: "Extraction failed.", detail }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
