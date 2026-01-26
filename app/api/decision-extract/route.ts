import OpenAI from "openai";
import { createHash } from "crypto";
import { z } from "zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOTAL_CHARS = 250_000;
const CHUNK_CHAR_LIMIT = 12_000;

const pageSchema = z.object({
  page: z.number().int().positive(),
  text: z.string().min(1, "Page text must not be empty."),
});

const requestSchema = z.object({
  docId: z.string().optional(),
  pages: z.array(pageSchema).min(1, "At least one page is required."),
});

type RequestPayload = z.infer<typeof requestSchema>;

type DecisionEvidence = { page: number; quote: string };

type CandidateDraft = {
  title: string;
  summary: string;
  evidence: DecisionEvidence[];
};

type DecisionResponse = {
  id: string;
  title: string;
  type: "commitment" | "plan" | "policy" | "tradeoff" | "risk" | "unknown";
  category: "Operations" | "Finance" | "Product" | "Hiring" | "Legal" | "Strategy" | "Other";
  summary: string;
  evidence: DecisionEvidence[];
  constraints: {
    impact?: string;
    cost?: string;
    risk?: string;
    urgency?: string;
    confidence?: string;
  };
  dnScore?: { impact: number; cost: number; risk: number; urgency: number; confidence: number };
  openQuestions: string[];
};

const errorResponse = (status: number, step: string, message: string, details?: unknown) =>
  Response.json({ ok: false, step, message, details }, { status });

const parseJsonObject = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const slice = value.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      return null;
    }
  }
};

const chunkPages = (pages: RequestPayload["pages"]) => {
  const chunks: string[] = [];
  let current = "";

  pages.forEach((page) => {
    const header = `=== Page ${page.page} ===\n${page.text.trim()}\n`;
    if (current.length + header.length > CHUNK_CHAR_LIMIT && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += `${header}\n`;
  });

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
};

const candidateDraftSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z
    .array(
      z.object({
        page: z.number(),
        quote: z.string().min(1),
      }),
    )
    .min(1),
});

const candidateDraftsSchema = z.object({
  candidates: z.array(candidateDraftSchema),
});

const decisionSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["commitment", "plan", "policy", "tradeoff", "risk", "unknown"]),
  category: z.enum(["Operations", "Finance", "Product", "Hiring", "Legal", "Strategy", "Other"]),
  summary: z.string().min(1),
  evidence: z
    .array(
      z.object({
        page: z.number(),
        quote: z.string().min(1),
      }),
    )
    .min(1),
  constraints: z
    .object({
      impact: z.string().optional(),
      cost: z.string().optional(),
      risk: z.string().optional(),
      urgency: z.string().optional(),
      confidence: z.string().optional(),
    })
    .default({}),
  dnScore: z
    .object({
      impact: z.number(),
      cost: z.number(),
      risk: z.number(),
      urgency: z.number(),
      confidence: z.number(),
    })
    .optional(),
  openQuestions: z.array(z.string()).default([]),
});

const decisionResponseSchema = z.object({
  decisions: z.array(decisionSchema),
});

const getTotalChars = (pages: RequestPayload["pages"]) =>
  pages.reduce((total, page) => total + page.text.length, 0);

const createDocId = (docId: string | undefined, pages: RequestPayload["pages"]) => {
  if (docId?.trim()) return docId;
  const hash = createHash("sha256")
    .update(pages.map((page) => `${page.page}:${page.text}`).join("|"))
    .digest("hex")
    .slice(0, 16);
  return `doc_${hash}`;
};

const createDecisionId = (decision: Omit<DecisionResponse, "id">) => {
  const hash = createHash("sha256")
    .update(`${decision.title}|${decision.summary}|${JSON.stringify(decision.evidence)}`)
    .digest("hex")
    .slice(0, 12);
  return `dec_${hash}`;
};

export async function GET() {
  return Response.json({ ok: true, route: "decision-extract", methods: ["GET", "POST"] }, { status: 200 });
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return errorResponse(500, "env", "OPENAI_API_KEY missing");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "parse", "Invalid JSON payload.");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation", "Request body failed validation.", parsed.error.flatten());
  }

  const totalChars = getTotalChars(parsed.data.pages);
  if (totalChars > MAX_TOTAL_CHARS) {
    return errorResponse(
      400,
      "validation",
      `Total text exceeds ${MAX_TOTAL_CHARS.toLocaleString()} characters.`,
      { totalChars },
    );
  }

  const docId = createDocId(parsed.data.docId, parsed.data.pages);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const pass1System = `You extract decision candidates from documents.
A decision candidate is an explicit commitment under constraint: an intended action + object + (timing/constraint when present).
Return JSON only.`;

  const pass1Candidates: CandidateDraft[] = [];
  const chunks = chunkPages(parsed.data.pages);

  for (const chunk of chunks) {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: pass1System },
      {
        role: "user",
        content: `Extract decision candidates from the text below.
Return JSON only in this schema:
{
  "candidates": [
    {
      "title": "string",
      "summary": "string",
      "evidence": [
        { "page": number, "quote": "string" }
      ]
    }
  ]
}

Rules:
- Every candidate must include at least one evidence quote.
- Evidence quotes must be copied verbatim from the page text.
- Evidence must include the correct page number from the headers.

Text:
${chunk}`,
      },
    ];

    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "";
    const parsedJson = parseJsonObject(content);
    const candidateResult = candidateDraftsSchema.safeParse(parsedJson);
    if (candidateResult.success) {
      pass1Candidates.push(...candidateResult.data.candidates);
    }
  }

  if (pass1Candidates.length === 0) {
    return Response.json(
      {
        ok: true,
        docId,
        stats: { pages: parsed.data.pages.length, totalChars, candidates: 0 },
        decisions: [],
      },
      { status: 200 },
    );
  }

  const pass2System = `You normalize decision candidates into final decisions.
Return JSON only.`;

  const refinementMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: pass2System },
    {
      role: "user",
      content: `Normalize, dedupe, and enrich the decision candidates below.
Tasks:
- Merge near-duplicates.
- Keep decisions verb-first and concrete.
- Assign type and category.
- Summarize constraints in plain language.
- Provide confidence scores only if the evidence supports them.
- Always include openQuestions (empty array if none).

Return JSON only in this schema:
{
  "decisions": [
    {
      "title": "string",
      "type": "commitment|plan|policy|tradeoff|risk|unknown",
      "category": "Operations|Finance|Product|Hiring|Legal|Strategy|Other",
      "summary": "string",
      "evidence": [
        { "page": number, "quote": "string" }
      ],
      "constraints": {
        "impact": "string (optional)",
        "cost": "string (optional)",
        "risk": "string (optional)",
        "urgency": "string (optional)",
        "confidence": "string (optional)"
      },
      "dnScore": {
        "impact": number,
        "cost": number,
        "risk": number,
        "urgency": number,
        "confidence": number
      },
      "openQuestions": ["string"]
    }
  ]
}

Candidates:
${JSON.stringify({ docId, candidates: pass1Candidates })}`,
    },
  ];

  const refinementResponse = await openai.chat.completions.create({
    model,
    messages: refinementMessages,
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const refinementContent = refinementResponse.choices[0]?.message?.content ?? "";
  const refinementParsed = parseJsonObject(refinementContent);
  const decisionsParsed = decisionResponseSchema.safeParse(refinementParsed);

  if (!decisionsParsed.success) {
    return errorResponse(500, "parse", "Failed to parse model output.", decisionsParsed.error.flatten());
  }

  const decisions: DecisionResponse[] = decisionsParsed.data.decisions.map((decision) => ({
    ...decision,
    constraints: decision.constraints ?? {},
    openQuestions: decision.openQuestions ?? [],
    id: createDecisionId(decision),
  }));

  return Response.json(
    {
      ok: true,
      docId,
      stats: { pages: parsed.data.pages.length, totalChars, candidates: pass1Candidates.length },
      decisions,
    },
    { status: 200 },
  );
}
