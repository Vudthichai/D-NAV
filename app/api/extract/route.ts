import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type DecisionCandidate = {
  id: string;
  title: string;
  decision: string;
  rationale: string;
  category?: string;
  evidence_quotes?: string[];
  source?: string;
  extract_confidence?: number;
};

type ExtractionResult = {
  decisions: DecisionCandidate[];
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeStringArray(value: unknown, maxItems?: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  const sliced = typeof maxItems === "number" ? items.slice(0, maxItems) : items;
  return sliced;
}

function normalizeDecision(
  obj: unknown,
  sourceFallback?: string | null,
): DecisionCandidate | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  const decision = typeof record.decision === "string" ? record.decision.trim() : "";
  const rationale = typeof record.rationale === "string" ? record.rationale.trim() : "";

  if (!title || !decision || !rationale) return null;

  const category = typeof record.category === "string" ? record.category.trim() : undefined;
  const source = typeof record.source === "string" ? record.source.trim() : undefined;
  const evidenceQuotes = normalizeStringArray(record.evidence_quotes, 3) ?? [];
  const extractConfidenceRaw = typeof record.extract_confidence === "number" ? record.extract_confidence : undefined;
  const extractConfidence = extractConfidenceRaw !== undefined ? clamp(extractConfidenceRaw, 0, 1) : undefined;

  return {
    id: hashId(`${title}|${decision}`),
    title,
    decision,
    rationale,
    category: category || undefined,
    evidence_quotes: evidenceQuotes,
    source: source || sourceFallback || undefined,
    extract_confidence: extractConfidence,
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
      return new Response(JSON.stringify({ error: "Expected application/json body." }), {
        status: 415,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text : "";
    const meta = typeof body?.meta === "object" && body?.meta !== null ? (body.meta as Record<string, unknown>) : null;

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "No text provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (text.length > 200_000) {
      return new Response(
        JSON.stringify({ error: "Text too large. Please submit smaller chunks (max 200k chars)." }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }

    const sourceName = typeof meta?.sourceName === "string" ? meta.sourceName : null;
    const chunkIndex = typeof meta?.chunkIndex === "number" ? meta.chunkIndex : null;
    const totalChunks = typeof meta?.totalChunks === "number" ? meta.totalChunks : null;
    const sourceFallback = sourceName
      ? `${sourceName}${chunkIndex ? ` (chunk ${chunkIndex}${totalChunks ? `/${totalChunks}` : ""})` : ""}`
      : null;

    const prompt = `You are a decision extraction engine for D-NAV.

A decision MUST satisfy ALL of the following:
- A committed allocation of intent under constraint.
- Multiple futures were possible at commitment time (non-degenerate option space).
- There was uncertainty at commitment time.
- The commitment reduces optionality.

Exclude:
- Routine actions ("walked to the gym").
- Observations and status reports.
- Vague aspirations without commitment.

Include:
- Approvals, plans, policies, strategic direction, timelines, capex decisions, launches, cancellations, hiring/firing, investment/divestment, targets with implied action.

Output rules:
- Return ONLY valid JSON matching the schema.
- If no decisions, return { "decisions": [] }.

Source label (if provided): ${sourceFallback ?? "none"}

TEXT:
${text}`;

    const jsonSchema = {
      name: "decision_candidates",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          decisions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                decision: { type: "string" },
                rationale: { type: "string" },
                category: { type: ["string", "null"] },
                evidence_quotes: {
                  type: "array",
                  items: { type: "string" },
                },
                source: { type: ["string", "null"] },
                extract_confidence: { type: "number" },
              },
              required: ["title", "decision", "rationale", "evidence_quotes", "extract_confidence"],
            },
          },
        },
        required: ["decisions"],
      },
      strict: true,
    };

    let response;
    try {
      response = await client.responses.create({
        model: "gpt-5-mini",
        input: prompt,
        store: false,
        response_format: { type: "json_schema", json_schema: jsonSchema },
      });
    } catch (error) {
      response = await client.responses.create({
        model: "gpt-5-mini",
        input: prompt,
        store: false,
        response_format: { type: "json_object" },
      });
    }

    const raw = getResponseText(response);
    const parsed = safeJsonParse(raw);

    if (!parsed.ok || !parsed.value || typeof parsed.value !== "object") {
      return new Response(
        JSON.stringify({
          error: "Model did not return valid JSON.",
          detail: parsed.ok ? "Unexpected shape." : parsed.error,
          raw: raw.slice(0, 2000),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
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
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const normalized = decisionsRaw
      .map((item) => normalizeDecision(item, sourceFallback))
      .filter((item): item is DecisionCandidate => Boolean(item));

    const deduped = new Map<string, DecisionCandidate>();
    for (const item of normalized) {
      const existing = deduped.get(item.id);
      if (!existing) {
        deduped.set(item.id, item);
        continue;
      }
      const existingConfidence = existing.extract_confidence ?? 0;
      const nextConfidence = item.extract_confidence ?? 0;
      if (nextConfidence > existingConfidence) {
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

    return new Response(JSON.stringify({ error: "Extraction failed.", detail }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
