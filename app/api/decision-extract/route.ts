import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOTAL_CHARS = 250_000;

const requestSchema = z.object({
  doc: z.object({
    name: z.string().min(1),
    source: z.literal("pdf"),
    pageCount: z.number().int().positive(),
  }),
  pages: z
    .array(
      z.object({
        page: z.number().int().positive(),
        text: z.string(),
        charCount: z.number().int().min(0),
      }),
    )
    .min(1, "At least one page is required."),
  options: z.object({
    maxCandidatesPerPage: z.number().int().positive(),
    model: z.string().min(1),
  }),
});

const candidateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["decision", "constraint", "assumption"]),
  category: z.enum(["Operations", "Finance", "Product", "Hiring", "Legal", "Strategy", "Other"]),
  signal: z.object({
    impact: z.number(),
    cost: z.number(),
    risk: z.number(),
    urgency: z.number(),
    confidence: z.number(),
  }),
  evidence: z.object({
    page: z.number().int().positive(),
    quote: z.string().min(1),
  }),
  notes: z.string(),
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

export async function GET() {
  return Response.json(
    {
      ok: true,
      route: "decision-extract",
      methods: ["GET", "POST"],
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}

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
  if (!parsed.success) {
    console.warn("decision-extract validation issues", parsed.error.issues);
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { doc, pages } = parsed.data;
  const totalChars = pages.reduce((total, page) => total + page.charCount, 0);

  console.info("decision-extract request", {
    docName: doc.name,
    pages: pages.length,
    totalChars,
  });

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
    doc: { name: doc.name, pageCount: doc.pageCount },
    candidates: [],
    meta: { pagesReceived: pages.length, totalChars },
  };

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
