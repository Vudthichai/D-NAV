import { NextResponse } from "next/server";
import { getModel } from "../model";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: getModel(),
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    runtime,
  });
}
