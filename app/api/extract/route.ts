import { NextResponse } from "next/server";
import OpenAI from "openai";
import crypto from "crypto";

export const runtime = "nodejs";

type DistilledChunk = {
  sourceId: string;
  pageStart: number | null;
  pageEnd: number | null;
  text: string;
};

type ExtractedDecision = {
  id: string;
  decision: string;
  evidence: string;
  sourceId: string;
  pageStart: number | null;
  pageEnd: number | null;
  extractConfidence: number;
  decisionness: number;
};

const MAX_DECISIONS_DEFAULT = 12;
const MAX_DECISIONS_LIMIT = 20;

const decisionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          decision: { type: "string" },
          evidence: { type: "string" },
          extractConfidence: { type: "number" },
          decisionness: { type: "number" },
        },
        required: ["decision", "evidence", "extractConfidence", "decisionness"],
      },
    },
  },
  required: ["decisions"],
} as const;

const SYSTEM_PROMPT = `You extract committed decisions from business text.

Definition: A DECISION is a committed allocation of intent under constraint, where multiple futures were possible and uncertainty existed at commitment time. A decision is the act of committing to one future (including "do nothing").

Include commitments signaled by: will, plan, expect, aim, on track, scheduled, begin, ramp, launch, continue, prepare, target.
Convert vague statements into explicit commitments (e.g., "remain on track for X" -> "Commit to X timeline").
Exclude generic statements, beliefs, accounting lines, definitions, or purely descriptive reporting.
Write concise, executive decision statements.`;

const normalizeDecision = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const clampScore = (value: number, fallback = 0.5) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
};

const buildDecisionId = (value: string, sourceId: string, pageStart: number | null, pageEnd: number | null) => {
  const hash = crypto.createHash("sha256").update(`${sourceId}-${pageStart}-${pageEnd}-${value}`).digest("hex");
  return `decision-${hash.slice(0, 12)}`;
};

const parseOpenAiJson = (raw: unknown) => {
  if (raw && typeof raw === "object" && "decisions" in raw) {
    return raw as { decisions: Array<Record<string, unknown>> };
  }
  return { decisions: [] };
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    console.error("Failed to parse OpenAI JSON response", error);
    return null;
  }
};

export async function POST(request: Request) {
  let payload: { chunks?: DistilledChunk[]; maxDecisionsPerChunk?: number };
  try {
    payload = (await request.json()) as { chunks?: DistilledChunk[]; maxDecisionsPerChunk?: number };
  } catch (error) {
    console.error("Failed to parse extract payload", error);
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload?.chunks || !Array.isArray(payload.chunks) || payload.chunks.length === 0) {
    return NextResponse.json({ error: "Missing chunks payload." }, { status: 400 });
  }

  const maxDecisionsPerChunk = Math.min(
    MAX_DECISIONS_LIMIT,
    Math.max(1, payload.maxDecisionsPerChunk ?? MAX_DECISIONS_DEFAULT),
  );

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_DECISION_MODEL ?? "gpt-4.1-mini";

  const results: ExtractedDecision[] = [];
  const queue = [...payload.chunks];
  const concurrency = Math.min(2, queue.length);

  const workers = Array.from({ length: concurrency }).map(async () => {
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (!chunk) return;
      try {
        const response = await client.responses.create({
          model,
          input: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Extract up to ${maxDecisionsPerChunk} decisions from the text below. Return JSON only.\n\nSOURCE: ${chunk.sourceId} (${chunk.pageStart ?? "memo"}-${chunk.pageEnd ?? "memo"})\n\nTEXT:\n${chunk.text}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "decision_extraction",
              schema: decisionSchema,
              strict: true,
            },
          },
          temperature: 0.2,
        });

        const outputText =
          response.output_text ??
          response.output?.[0]?.content?.find((item) => item.type === "output_text")?.text ??
          "";
        const parsed = parseOpenAiJson(outputText ? safeJsonParse(outputText) : null);
        const chunkDecisions = Array.isArray(parsed.decisions) ? parsed.decisions : [];

        for (const entry of chunkDecisions.slice(0, maxDecisionsPerChunk)) {
          const decision = typeof entry.decision === "string" ? entry.decision.trim() : "";
          const evidence = typeof entry.evidence === "string" ? entry.evidence.trim() : "";
          if (!decision || !evidence) continue;
          const extractConfidence = clampScore(Number(entry.extractConfidence), 0.6);
          const decisionness = clampScore(Number(entry.decisionness), 0.6);
          results.push({
            id: buildDecisionId(decision, chunk.sourceId, chunk.pageStart, chunk.pageEnd),
            decision,
            evidence,
            sourceId: chunk.sourceId,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            extractConfidence,
            decisionness,
          });
        }
      } catch (error) {
        console.error("Failed to extract decisions for chunk", {
          sourceId: chunk.sourceId,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          error,
        });
      }
    }
  });

  await Promise.all(workers);

  const deduped = new Map<string, ExtractedDecision>();
  for (const decision of results) {
    const key = normalizeDecision(decision.decision);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, decision);
      continue;
    }
    const winner =
      decision.decisionness > existing.decisionness ||
      (decision.decisionness === existing.decisionness && decision.extractConfidence >= existing.extractConfidence)
        ? decision
        : existing;
    deduped.set(key, winner);
  }

  const ordered = [...deduped.values()].sort((a, b) => b.decisionness - a.decisionness);

  return NextResponse.json({ decisions: ordered });
}
