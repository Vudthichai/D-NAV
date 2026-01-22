// app/api/extract/route.ts
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Decision = {
  title: string;
  decision: string;
  rationale: string;
  category?: string;
  evidence_quotes?: string[];
  source?: string;
};

type ExtractionResult = {
  decisions: Decision[];
};

function safeJsonParse(text: string): ExtractionResult | null {
  // Try raw parse
  try {
    return JSON.parse(text) as ExtractionResult;
  } catch {
    // Try to extract the first JSON object in the output
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const candidate = text.slice(start, end + 1);
      try {
        return JSON.parse(candidate) as ExtractionResult;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY env var on server." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

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

    const schemaHint = {
      decisions: [
        {
          title: "short label",
          decision: "what is being decided/committed to",
          rationale: "why (as stated or strongly implied)",
          category: "optional",
          evidence_quotes: ["optional quote 1", "optional quote 2"],
          source: "optional section/page",
        },
      ],
    };

    const system = `You extract distinct DECISIONS from documents.

A "decision" is: a committed choice, plan, policy, strategic direction, approval, rejection, investment, divestment, target, timeline, or stance with implied or explicit action.

Rules:
- Output MUST be valid JSON only (no markdown, no commentary).
- Output MUST match this shape: { "decisions": [ ... ] }
- Deduplicate decisions.
- Keep decisions concise.
- evidence_quotes: max 2 short quotes if available.
- If a field is unknown, omit it (except required ones).`;

    const user = `Return ONLY JSON.

JSON shape example (not content, just shape):
${JSON.stringify(schemaHint, null, 2)}

TEXT:
${text}`;

    const completion = await client.chat.completions.create({
      // Use a widely-supported model name to avoid SDK/version weirdness
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const parsed = safeJsonParse(raw);

    if (!parsed || !Array.isArray(parsed.decisions)) {
      return new Response(
        JSON.stringify({
          error: "Model did not return valid JSON in the expected shape.",
          raw: raw.slice(0, 2000),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
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
