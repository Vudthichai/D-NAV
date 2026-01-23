// app/api/extract/route.ts
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL_NAME = "gpt-5-mini";
const REQUEST_TIMEOUT_MS = 25_000;

type DecisionCandidate = {
  id: string;
  title: string;
  decision: string;
  rationale: string;
  category: string | null;
  constraints: string[];
  evidence_quotes: string[];
  source: string | null;
  extract_confidence: number;
};

type ExtractionResponse = {
  decisions: DecisionCandidate[];
  meta: {
    model: string;
    truncated: boolean;
    input_chars: number;
  };
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

function normalizeStringArray(value: unknown, maxItems?: number): string[] {
  if (!Array.isArray(value)) return [];
  const items = value
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  return typeof maxItems === "number" ? items.slice(0, maxItems) : items;
}

function normalizeCategory(value: unknown): string | null {
  const allowed = new Set([
    "Product",
    "Finance",
    "Legal",
    "Ops",
    "Hiring",
    "Strategy",
    "Other",
  ]);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (allowed.has(trimmed)) return trimmed;
  return trimmed ? "Other" : null;
}

function normalizeDecision(obj: unknown): DecisionCandidate | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  const decision = typeof record.decision === "string" ? record.decision.trim() : "";
  const rationale = typeof record.rationale === "string" ? record.rationale.trim() : "";
  const category = normalizeCategory(record.category);
  const constraints = normalizeStringArray(record.constraints);
  const evidenceQuotes = normalizeStringArray(record.evidence_quotes, 2);
  const source = typeof record.source === "string" ? record.source.trim() : null;
  const extractConfidence = coerceNumber(record.extract_confidence);

  if (!title || !decision || !rationale) return null;
  if (extractConfidence === null) return null;

  return {
    id: hashId(`${title}|${decision}`),
    title,
    decision,
    rationale,
    category,
    constraints,
    evidence_quotes: evidenceQuotes,
    source,
    extract_confidence: clamp(extractConfidence, 0, 1),
  };
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

  const repair = await client.responses.create({
    model: MODEL_NAME,
    input: repairPrompt,
    store: false,
    signal,
  });

  return getResponseText(repair);
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY env var on server." }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Expected JSON payload." }), {
        status: 415,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text : "";
    const sourceMeta = typeof body?.source_meta === "object" && body.source_meta ? body.source_meta : null;
    const truncatedFlag = Boolean((sourceMeta as { truncated?: boolean } | null)?.truncated);

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "No text provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const schemaHint = {
      decisions: [
        {
          id: "stable_string_id",
          title: "Short decision label",
          decision: "What was committed/chosen",
          rationale: "Why it was chosen (stated or strongly implied)",
          category: "Strategy",
          constraints: ["Budget limit", "Regulatory deadline"],
          evidence_quotes: ["Short quote 1", "Short quote 2"],
          source: "Section or page",
          extract_confidence: 0.8,
        },
      ],
      meta: {
        model: MODEL_NAME,
        truncated: false,
        input_chars: 1234,
      },
    } satisfies ExtractionResponse;

    const prompt = `You are a decision extraction engine for D-NAV.\n\nD-NAV DECISION ONTOLOGY (must satisfy all):\n- A committed allocation of intent under constraint.\n- Multiple futures plausibly existed at commitment time (optionality).\n- Uncertainty existed at commitment time.\n\nFILTERING RULES:\n- Do NOT include routine actions unless explicitly framed as a deliberate commitment under constraint.\n- Exclude facts, observations, and status updates without a commitment.\n- Exclude degenerate choices where refusing annihilates all futures (e.g., escaping a fire).\n- Deduplicate near-duplicates; keep the most specific version.\n- Prefer launches, ramps, targets, timelines, capex decisions, factory commissioning, product milestones, policy/strategy commitments.\n\nOUTPUT RULES (STRICT):\n- Output MUST be valid JSON only, no markdown or commentary.\n- Output MUST be exactly: { "decisions": [DecisionCandidate, ...] }\n- Use the DecisionCandidate schema shown below.\n- evidence_quotes: up to 2 short quotes max; may be empty array.\n- category/source may be null if not inferable.\n- constraints may be empty array.\n- extract_confidence must be 0.0-1.0.\n- If no valid decisions, return { "decisions": [] }.\n\nDecisionCandidate schema example (shape only):\n${JSON.stringify(schemaHint, null, 2)}\n\nSOURCE META:\n${JSON.stringify(sourceMeta ?? {}, null, 2)}\n\nTEXT:\n${text}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let responseText = "";
    try {
      const response = await client.responses.create({
        model: MODEL_NAME,
        input: prompt,
        store: false,
        signal: controller.signal,
      });
      responseText = getResponseText(response);
    } catch (err) {
      if (controller.signal.aborted) {
        return new Response(
          JSON.stringify({ error: "Model request timed out." }),
          { status: 504, headers: { "Content-Type": "application/json" } },
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    let parsed = safeJsonParse(responseText);

    if (!parsed.ok) {
      const repaired = await repairJson(responseText, controller.signal);
      responseText = repaired;
      parsed = safeJsonParse(repaired);
    }

    if (!parsed.ok || !parsed.value || typeof parsed.value !== "object") {
      return new Response(
        JSON.stringify({
          error: "Model did not return valid JSON.",
          detail: parsed.ok ? "Unexpected shape." : parsed.error,
          raw: responseText.slice(0, 2000),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const value = parsed.value as Record<string, unknown>;
    const decisionsRaw = value.decisions;
    if (!Array.isArray(decisionsRaw)) {
      // Unit-ish check: invalid model output should report missing decisions array for debugging.
      return new Response(
        JSON.stringify({
          error: "Model JSON missing decisions array.",
          raw: responseText.slice(0, 2000),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const normalized = decisionsRaw
      .map((item) => normalizeDecision(item))
      .filter((item): item is DecisionCandidate => Boolean(item));

    const deduped = new Map<string, DecisionCandidate>();
    for (const item of normalized) {
      const existing = deduped.get(item.id);
      if (!existing || item.extract_confidence > existing.extract_confidence) {
        deduped.set(item.id, item);
      }
    }

    const result: ExtractionResponse = {
      decisions: Array.from(deduped.values()),
      meta: {
        model: MODEL_NAME,
        truncated: truncatedFlag,
        input_chars: text.length,
      },
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
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
