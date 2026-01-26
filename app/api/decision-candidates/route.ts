import OpenAI from "openai";
import { NextResponse } from "next/server";

type DecisionPayload = {
  id: string;
  decision: string;
  evidence: string;
  source?: {
    fileName?: string;
    page?: number;
  };
};

type ApiRefinedCandidate = {
  id: string;
  rewrittenDecision: string;
  reasonKeep?: string;
  mergedFromIds?: string[];
};

type ApiRefinementResponse = {
  kept_candidates?: ApiRefinedCandidate[];
  drop_ids?: string[];
  notes?: string;
};

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const extractJson = (content: string) => {
  try {
    return JSON.parse(content);
  } catch (error) {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (nestedError) {
      console.error("Failed to parse decision candidate JSON.", nestedError);
      return null;
    }
  }
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
  }

  let candidates: DecisionPayload[] = [];
  try {
    const body = (await request.json()) as { candidates?: DecisionPayload[] };
    candidates = Array.isArray(body.candidates) ? body.candidates : [];
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No candidates provided." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = [
    "You refine decision candidates into crisp decision statements.",
    "Only keep committed intent under constraint (action + object + timing/constraint).",
    "Rewrite into active voice starting with a verb (Begin / Launch / Expand / Commission / Prepare / Invest).",
    "Drop vague or hedged fluff ('may', 'could', 'depends on factors') unless still a planned action.",
    "Merge duplicates, keep best phrasing, and reference merged ids.",
    "You MUST use only the ids provided in the input list.",
    "Return ONLY JSON with this schema:",
    "{ \"kept_candidates\": [{ \"id\": \"string\", \"rewrittenDecision\": \"string\", \"reasonKeep\": \"string?\", \"mergedFromIds\": [\"string\"]? }], \"drop_ids\": [\"string\"], \"notes\": \"string?\" }",
    "Keep roughly 40-80% of items unless nearly all are strong. No extra keys, no markdown.",
  ].join(" ");

  const userPrompt = `Decision candidates JSON:\n${JSON.stringify(candidates, null, 2)}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson(content) as ApiRefinementResponse | null;
  if (!parsed) {
    return NextResponse.json({ error: "Invalid AI response." }, { status: 502 });
  }

  const allowedIds = new Set(candidates.map((candidate) => candidate.id));

  const kept = Array.isArray(parsed.kept_candidates) ? parsed.kept_candidates : [];
  const cleanedKept = kept
    .map((candidate) => {
      const id = typeof candidate.id === "string" ? candidate.id : "";
      const rewrittenDecision =
        typeof candidate.rewrittenDecision === "string" ? candidate.rewrittenDecision.trim() : "";
      if (!id || !rewrittenDecision || !allowedIds.has(id)) return null;
      const reasonKeep = typeof candidate.reasonKeep === "string" ? candidate.reasonKeep.trim() : undefined;
      const mergedFromIds = Array.isArray(candidate.mergedFromIds)
        ? candidate.mergedFromIds.filter((mergeId) => allowedIds.has(mergeId))
        : undefined;
      return {
        id,
        rewrittenDecision,
        reasonKeep,
        mergedFromIds,
      } satisfies ApiRefinedCandidate;
    })
    .filter(Boolean) as ApiRefinedCandidate[];

  const dropIds = Array.isArray(parsed.drop_ids)
    ? parsed.drop_ids.filter((id) => typeof id === "string" && allowedIds.has(id))
    : [];

  return NextResponse.json({
    kept_candidates: cleanedKept,
    drop_ids: dropIds,
    notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
  });
}
