import OpenAI from "openai";
import { NextResponse } from "next/server";

type SentencePayload = {
  sourceId: string;
  fileName?: string;
  page?: number;
  sentence: string;
};

type ApiDecisionCandidate = {
  id: string;
  decision: string;
  rationale?: string;
  source: {
    fileName?: string;
    page?: number;
    sourceId: string;
  };
  extractConfidence: number;
};

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const extractJson = (content: string) => {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (error) {
    console.error("Failed to parse decision candidate JSON.", error);
    return null;
  }
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
  }

  let sentences: SentencePayload[] = [];
  try {
    const body = (await request.json()) as { sentences?: SentencePayload[] };
    sentences = Array.isArray(body.sentences) ? body.sentences : [];
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (sentences.length === 0) {
    return NextResponse.json({ error: "No sentences provided." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = [
    "You distill decision statements from source sentences.",
    "Only include committed intent under constraint.",
    "Prefer action + object + timing.",
    "Rewrite into active voice starting with a verb (Begin / Launch / Expand / Commission / Prepare / Invest).",
    "Reject hedged fluff ('may', 'could', 'depends on factors') unless still a planned action.",
    "Merge duplicates, keep best phrasing, preserve source citations.",
    "Return ONLY JSON with this schema:",
    "{ \"candidates\": [{ \"id\": \"string\", \"decision\": \"string\", \"rationale\": \"string?\", \"source\": { \"fileName\": \"string?\", \"page\": number?, \"sourceId\": \"string\" }, \"extractConfidence\": number }] }",
    "Return 25-60 items. No extra keys, no markdown.",
  ].join(" ");

  const userPrompt = `Source sentences JSON:\n${JSON.stringify(sentences, null, 2)}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson(content) as { candidates?: ApiDecisionCandidate[] } | null;
  if (!parsed?.candidates || !Array.isArray(parsed.candidates)) {
    return NextResponse.json({ error: "Invalid AI response." }, { status: 502 });
  }

  const cleaned = parsed.candidates
    .map((candidate) => {
      const decision = typeof candidate.decision === "string" ? candidate.decision.trim() : "";
      const source = candidate.source ?? ({} as ApiDecisionCandidate["source"]);
      const sourceId = typeof source.sourceId === "string" ? source.sourceId : "";
      const fileName = typeof source.fileName === "string" ? source.fileName : undefined;
      const page = typeof source.page === "number" ? source.page : undefined;
      if (!decision || !sourceId) return null;
      const rationale = typeof candidate.rationale === "string" ? candidate.rationale.trim() : undefined;
      const confidence =
        typeof candidate.extractConfidence === "number" ? clamp(candidate.extractConfidence) : 0.6;
      const id =
        typeof candidate.id === "string" && candidate.id
          ? candidate.id
          : `decision-${hashString(`${decision}-${sourceId}-${fileName ?? ""}-${page ?? ""}`)}`;

      return {
        id,
        decision,
        rationale,
        source: {
          fileName,
          page,
          sourceId,
        },
        extractConfidence: confidence,
      } satisfies ApiDecisionCandidate;
    })
    .filter(Boolean) as ApiDecisionCandidate[];

  return NextResponse.json({ candidates: cleaned.slice(0, 60) });
}
