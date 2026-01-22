// app/api/extract/route.ts
import OpenAI from "openai";

export const runtime = "nodejs"; // important for Next.js App Router

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // <-- key comes from env var, NOT hardcoded
});

type Decision = {
  title: string;
  decision: string;
  rationale: string;
  category?: string;
  evidence_quotes?: string[];
  source?: string;
};

export async function POST(req: Request) {
  try {
    // Accept either JSON { text } or form-data (fallback)
    const contentType = req.headers.get("content-type") || "";

    let text = "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      text = String(body?.text || "");
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      // Expect: form field "text" OR one/many "file" inputs (basic)
      const maybeText = form.get("text");
      if (typeof maybeText === "string") text = maybeText;

      // If files were uploaded, concatenate their plain text (best-effort).
      // NOTE: PDFs won't auto-extract text here — this is a minimal first pass.
      const files = form.getAll("file");
      for (const f of files) {
        if (f instanceof File) {
          const fileText = await f.text().catch(() => "");
          if (fileText) text += `\n\n--- FILE: ${f.name} ---\n${fileText}`;
        }
      }
    } else {
      // last resort
      text = await req.text();
    }

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ error: "No text provided." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const schema = {
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
              category: { type: "string" },
              evidence_quotes: { type: "array", items: { type: "string" } },
              source: { type: "string" }
            },
            required: ["title", "decision", "rationale"]
          }
        }
      },
      required: ["decisions"]
    };

    const prompt = `
You are extracting "decisions" from a document.

A "decision" is: a committed choice, plan, policy, strategic direction, approval, rejection, investment, divestment, target, timeline, or stance with implied or explicit action.

Extract distinct decisions. Deduplicate. Keep them concise.
For each decision:
- title: short label
- decision: what is being decided / committed to
- rationale: why (as stated or strongly implied)
- category: optional (e.g., Product, Finance, Legal, Ops, Hiring, Strategy)
- evidence_quotes: optional: up to 2 short quotes that support it
- source: optional: section/page if you can infer (otherwise omit)

Return ONLY valid JSON that matches the schema.
TEXT:
${text}
`.trim();

    const resp = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      // don't store by default (good hygiene for sensitive docs)
      store: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "decision_extraction",
          schema
        }
      }
    });

    const out = resp.output_text?.trim() || "";
    return new Response(out, {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Extraction failed.",
        detail: err?.message || String(err)
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
