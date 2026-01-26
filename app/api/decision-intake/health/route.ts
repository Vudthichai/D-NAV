import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const model = process.env.OPENAI_MODEL ?? null;
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

  return NextResponse.json({
    ok: true,
    hasOpenAIKey,
    model,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
  });
}
