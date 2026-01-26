import OpenAI from "openai";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOTAL_CHARS = 250_000;

const pageSchema = z.object({
  page: z.number().int().positive(),
  text: z.string(),
  charCount: z.number().int().min(0).optional(),
});

const optionsSchema = z.object({
  maxCandidatesPerPage: z.number().int().positive().default(6),
  model: z.string().min(1).default("gpt-4o-mini"),
});

const requestSchema = z.object({
  doc: z.object({
    name: z.string().min(1),
    source: z.literal("pdf"),
    pageCount: z.number().int().positive(),
  }),
  pages: z.array(pageSchema).min(1, "At least one page is required."),
  options: optionsSchema,
});

const alternateRequestSchema = z.object({
  docName: z.string().min(1),
  pages: z.array(pageSchema).min(1, "At least one page is required."),
  options: optionsSchema.optional(),
});

const candidateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  strength: z.enum(["hard", "soft"]),
  category: z.enum([
    "Operations",
    "Finance",
    "Product",
    "Hiring",
    "Legal",
    "Strategy",
    "Sales/Go-to-market",
    "Other",
  ]),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  constraints: z.object({
    impact: z.object({
      score: z.number().int().min(1).max(10),
      evidence: z.string().min(1),
    }),
    cost: z.object({
      score: z.number().int().min(1).max(10),
      evidence: z.string().min(1),
    }),
    risk: z.object({
      score: z.number().int().min(1).max(10),
      evidence: z.string().min(1),
    }),
    urgency: z.object({
      score: z.number().int().min(1).max(10),
      evidence: z.string().min(1),
    }),
    confidence: z.object({
      score: z.number().int().min(1).max(10),
      evidence: z.string().min(1),
    }),
  }),
  evidence: z.object({
    page: z.number().int().positive(),
    quote: z.string().min(1).max(280),
    locationHint: z.string().min(1).optional(),
  }),
  tags: z.array(z.string()).default([]),
});

const responseSchema = z.object({
  doc: z.object({
    name: z.string().min(1),
    pageCount: z.number().int().positive(),
  }),
  candidates: z.array(candidateSchema),
  meta: z.object({
    pagesReceived: z.number().int().min(0),
    totalChars: z.number().int().min(0),
  }),
});

const modelResponseSchema = z.object({
  candidates: z.array(candidateSchema),
});

const HARD_SYSTEM_PROMPT = [
  "You extract ONLY explicit commitments and concrete decisions.",
  "Include only statements with clear commitment verbs (will, launch, begin, approved, signed, committed, decided, execute).",
  "Output JSON with a top-level object {\"candidates\": [...]} and each item follows the DecisionCandidate schema.",
  "Keep quotes <= 280 chars. Provide page numbers from the input. Do not hallucinate.",
].join(" ");

const SOFT_SYSTEM_PROMPT = [
  "You extract implicit strategic decisions (intent, priorities, posture, sequencing, investment focus, deprioritization).",
  "These are still decisions, but with lower confidence.",
  "Output JSON with a top-level object {\"candidates\": [...]} and each item follows the DecisionCandidate schema.",
  "No hallucinations: every candidate must include a direct quote and page number.",
  "Keep quotes <= 280 chars.",
].join(" ");

const USER_PROMPT_PREFIX = [
  "Extract decision candidates from the provided document pages.",
  "Use this DecisionCandidate schema exactly:",
  "{",
  '  "id": "uuid-like string",',
  '  "title": "short, verb-led",',
  '  "strength": "hard" | "soft",',
  '  "category": "Operations" | "Finance" | "Product" | "Hiring" | "Legal" | "Strategy" | "Sales/Go-to-market" | "Other",',
  '  "decision": "1-2 sentence plain english",',
  '  "rationale": "why this is a decision / what constraint it implies",',
  '  "constraints": {',
  '    "impact": { "score": 1-10, "evidence": "short justification" },',
  '    "cost": { "score": 1-10, "evidence": "short justification" },',
  '    "risk": { "score": 1-10, "evidence": "short justification" },',
  '    "urgency": { "score": 1-10, "evidence": "short justification" },',
  '    "confidence": { "score": 1-10, "evidence": "short justification" }',
  "  },",
  '  "evidence": { "page": 1, "quote": "verbatim quote", "locationHint": "optional" },',
  '  "tags": ["concise", "tags"]',
  "}",
  "Scores must be integers 1-10. Quotes must be copied from the page text and <= 280 chars.",
  "Return at most {maxCandidatesPerPage} candidates per page.",
  "Document pages:",
].join("\n");

export async function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}

type DecisionCandidate = z.infer<typeof candidateSchema>;

const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const extractTerms = (text: string) =>
  new Set((text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter(Boolean));

const overlapScore = (a: Set<string>, b: Set<string>) => {
  let overlap = 0;
  for (const term of a) {
    if (b.has(term)) overlap += 1;
  }
  return overlap;
};

const isDuplicate = (a: DecisionCandidate, b: DecisionCandidate) => {
  if (a.evidence.page !== b.evidence.page) return false;
  if (normalizeTitle(a.title) === normalizeTitle(b.title)) return true;
  const termsA = extractTerms(`${a.title} ${a.decision}`);
  const termsB = extractTerms(`${b.title} ${b.decision}`);
  if (termsA.size === 0 || termsB.size === 0) return false;
  const overlap = overlapScore(termsA, termsB);
  return overlap >= 2;
};

const mergeCandidates = (existing: DecisionCandidate, incoming: DecisionCandidate) => {
  const existingConfidence = existing.constraints.confidence.score;
  const incomingConfidence = incoming.constraints.confidence.score;
  const pick = existingConfidence >= incomingConfidence ? existing : incoming;
  const tags = Array.from(new Set([...(existing.tags ?? []), ...(incoming.tags ?? [])])).filter(Boolean);
  return {
    ...pick,
    strength: existing.strength === "hard" || incoming.strength === "hard" ? "hard" : "soft",
    tags,
  };
};

const clampQuotes = (candidates: DecisionCandidate[]) =>
  candidates.map((candidate) => ({
    ...candidate,
    evidence: {
      ...candidate.evidence,
      quote: candidate.evidence.quote.slice(0, 280),
    },
  }));

const openAiClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const issues = [{ message: "Invalid JSON payload.", path: [], code: "custom" }];
    console.warn("decision-extract invalid json", issues);
    return Response.json({ error: "Invalid request", issues }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  const alternateParsed = parsed.success ? null : alternateRequestSchema.safeParse(body);
  if (!parsed.success && !alternateParsed?.success) {
    console.warn("decision-extract validation issues", parsed.error.issues);
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const resolved = parsed.success
    ? parsed.data
    : {
        doc: {
          name: alternateParsed!.data.docName,
          source: "pdf" as const,
          pageCount: alternateParsed!.data.pages.length,
        },
        pages: alternateParsed!.data.pages,
        options: alternateParsed!.data.options ?? optionsSchema.parse({}),
      };

  const pages = resolved.pages.map((page) => ({
    ...page,
    charCount: typeof page.charCount === "number" ? page.charCount : page.text.length,
  }));
  const totalChars = pages.reduce((total, page) => total + page.charCount, 0);

  if (process.env.NODE_ENV !== "production") {
    console.info("decision-extract request", {
      docName: resolved.doc.name,
      pages: pages.length,
      totalChars,
    });
  }

  if (totalChars > MAX_TOTAL_CHARS) {
    return Response.json(
      {
        error: "Payload too large",
        message: `Total text exceeds ${MAX_TOTAL_CHARS.toLocaleString()} characters.`,
        totalChars,
        limit: MAX_TOTAL_CHARS,
      },
      { status: 413 },
    );
  }

  const responseBody = {
    doc: { name: resolved.doc.name, pageCount: resolved.doc.pageCount },
    candidates: [],
    meta: { pagesReceived: pages.length, totalChars },
  };

  const client = openAiClient();
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("decision-extract missing OPENAI_API_KEY");
    }
    return Response.json(responseBody, { status: 200 });
  }

  const model = resolved.options.model;
  const maxCandidatesPerPage = resolved.options.maxCandidatesPerPage;

  const userPrompt = [
    USER_PROMPT_PREFIX.replace("{maxCandidatesPerPage}", maxCandidatesPerPage.toString()),
    JSON.stringify({
      docName: resolved.doc.name,
      pages: pages.map((page) => ({ page: page.page, text: page.text })),
    }),
  ].join("\n");

  const runExtraction = async (systemPrompt: string) => {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "";
    let parsedContent: unknown = null;
    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("decision-extract json parse failed", error);
      }
      return { ok: false as const, error: "invalid_json" };
    }

    const validation = modelResponseSchema.safeParse(parsedContent);
    if (!validation.success) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("decision-extract model validation failed", validation.error.issues);
      }
      return { ok: false as const, error: "invalid_schema" };
    }

    return { ok: true as const, candidates: clampQuotes(validation.data.candidates) };
  };

  const hardResult = await runExtraction(HARD_SYSTEM_PROMPT);
  const softResult = await runExtraction(SOFT_SYSTEM_PROMPT);

  if (!hardResult.ok || !softResult.ok) {
    console.error("decision-extract response validation failed", {
      hard: hardResult.ok ? "ok" : hardResult.error,
      soft: softResult.ok ? "ok" : softResult.error,
    });
    return Response.json(responseBody, { status: 200 });
  }

  const hardCandidates = hardResult.candidates.map((candidate) => ({
    ...candidate,
    strength: "hard" as const,
  }));
  const softCandidates = softResult.candidates.map((candidate) => ({
    ...candidate,
    strength: "soft" as const,
  }));

  const mergedCandidates = [...hardCandidates];
  for (const candidate of softCandidates) {
    const existingIndex = mergedCandidates.findIndex((existing) => isDuplicate(existing, candidate));
    if (existingIndex === -1) {
      mergedCandidates.push(candidate);
    } else {
      mergedCandidates[existingIndex] = mergeCandidates(mergedCandidates[existingIndex], candidate);
    }
  }

  const dedupedCandidates = mergedCandidates.slice(0, pages.length * maxCandidatesPerPage);

  if (process.env.NODE_ENV !== "production") {
    console.log("decision-extract candidates", {
      hardCandidates: hardCandidates.length,
      softCandidates: softCandidates.length,
      mergedCandidates: dedupedCandidates.length,
      sampleTitles: dedupedCandidates.slice(0, 2).map((candidate) => candidate.title),
    });
  }

  responseBody.candidates = dedupedCandidates;

  const responseValidation = responseSchema.safeParse(responseBody);
  if (!responseValidation.success) {
    console.error("decision-extract response validation failed", responseValidation.error.issues);
    return Response.json(
      { error: "Invalid response", issues: responseValidation.error.issues },
      { status: 500 },
    );
  }

  return Response.json(responseValidation.data, { status: 200 });
}
