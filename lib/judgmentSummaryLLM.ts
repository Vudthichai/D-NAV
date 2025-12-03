import {
  type ArchetypeSummaryOutput,
  type CompanySummaryInput,
  type CompanySummaryOutput,
  type SingleArchetypeSummaryInput,
} from "@/types/company";

const LLM_ENDPOINT = process.env.NEXT_PUBLIC_JUDGMENT_LLM_ENDPOINT;

interface LlmResponse<T> {
  result?: T;
  data?: T;
  output?: T;
}

const safeParse = <T>(payload: unknown): T | null => {
  if (payload && typeof payload === "object") {
    return payload as T;
  }
  return null;
};

async function callLLM<T>(systemPrompt: string, userContent: string): Promise<T | null> {
  if (!LLM_ENDPOINT) {
    return null;
  }

  try {
    const response = await fetch(LLM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt, userContent }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status}`);
    }

    const parsed = (await response.json()) as LlmResponse<T>;
    return parsed.result ?? parsed.data ?? parsed.output ?? safeParse<T>(parsed);
  } catch (error) {
    console.error("LLM summary request failed", error);
    return null;
  }
}

const buildCompanyFallback = (input: CompanySummaryInput): CompanySummaryOutput => {
  const summaryLines = [
    `${input.company.companyName} (${input.company.timeframeLabel}) shows an average Return of ${input.company.avgReturn.toFixed(2)}, ` +
      `Pressure of ${input.company.avgPressure.toFixed(2)}, and Stability of ${input.company.avgStability.toFixed(2)} across ${input.company.totalDecisions} decisions.`,
  ];

  const topArchetype = input.archetypes[0];
  if (topArchetype) {
    summaryLines.push(
      `${topArchetype.name} appears most often, averaging R ${topArchetype.avgR.toFixed(2)}, P ${topArchetype.avgP.toFixed(2)}, S ${topArchetype.avgS.toFixed(2)}.`,
    );
  }

  const strengths = input.topCategories.slice(0, 3).map((category) =>
    `${category.name} features ${category.count} decisions (${category.share.toFixed(1)}%) with avg D-NAV ${category.avgDNAV.toFixed(1)}.`,
  );

  const vulnerabilities = input.archetypes
    .filter((archetype) => archetype.avgS < 0)
    .slice(0, 3)
    .map(
      (archetype) =>
        `${archetype.name} trends fragile (Avg S ${archetype.avgS.toFixed(1)}); monitor decisions in ${archetype.topCategories.join(", ")}.`,
    );

  return {
    summary: summaryLines.join(" "),
    strengths: strengths.length ? strengths : ["Add more decisions to surface strengths."],
    vulnerabilities: vulnerabilities.length ? vulnerabilities : ["No clear vulnerabilities detected in this snapshot."],
  };
};

const buildArchetypeFallback = (
  input: SingleArchetypeSummaryInput,
): ArchetypeSummaryOutput => ({
  title: `${input.archetype.name} – portfolio signal`,
  summary: `${input.company.companyName}'s ${input.archetype.name} decisions average R ${input.archetype.avgR.toFixed(
    2,
  )}, P ${input.archetype.avgP.toFixed(2)}, S ${input.archetype.avgS.toFixed(2)} across ${input.archetype.count} entries.`,
  isStrength: input.archetype.avgS >= 0 && input.archetype.avgR >= 0,
  notes:
    input.sampleTitles.length > 0
      ? input.sampleTitles.map((title) => `Representative decision: ${title}`)
      : ["Log more decisions in this archetype to improve the read."],
});

export async function generateCompanySummary(
  input: CompanySummaryInput,
): Promise<CompanySummaryOutput> {
  const systemPrompt = `
You are D-NAV, a judgment analyst.
You analyze decision portfolios scored on Return (R), Pressure (P), and Stability (S),
with decisions grouped into archetypes (e.g. Breakthrough, Gamble, Harvest, etc.).

You will receive a JSON object describing:
- The company context (name, type, sector, stage, timeframe)
- Aggregate R/P/S metrics
- Top decision categories
- Top archetypes with their metrics.

Produce a company-level readout in this structure:
1) A 2–3 paragraph narrative that follows this arc:
   - Paragraph 1: Describe the company's judgment signature (impact, confidence, urgency) and the dominant categories/archetypes.
   - Paragraph 2: Call out where friction or vulnerability shows up (archetypes or categories that underperform or add pressure).
   - Paragraph 3: Summarize the overall posture (e.g., "sovereign planner" vs. "high-pressure tactician"), naming the core strength and main risk.
2) A **Strengths** section with 3–5 concise bullets drawn from the data.
3) A **Vulnerabilities** section with 3–5 concise bullets drawn from the data.

Use only the information in the JSON. Do not invent external facts or company claims.
Use whatever optional context is present, but do not assume anything that is missing.
Write in clear, opinionated business language without hype.
  `.trim();

  const userContent = JSON.stringify(input, null, 2);

  const llmResult = await callLLM<CompanySummaryOutput>(systemPrompt, userContent);
  if (llmResult) {
    return llmResult;
  }

  return buildCompanyFallback(input);
}

export async function generateArchetypeSummary(
  input: SingleArchetypeSummaryInput,
): Promise<ArchetypeSummaryOutput> {
  const systemPrompt = `
You are D-NAV, a judgment analyst. 
You analyze a single decision archetype (e.g. Breakthrough, Gamble) for one company.

You will receive JSON describing:
- Basic company context.
- The archetype name.
- Count of decisions in this archetype.
- Average Return (R), Pressure (P), Stability (S), and D-NAV within this archetype.
- Top categories where this archetype appears.
- A few sample decision titles.

Write:
1) A short title like "Gamble – Gain with fragile footing".
2) A 1–2 paragraph summary explaining what this archetype represents for this company 
   and whether it is mostly a strength or a vulnerability.
3) A boolean flag: is this archetype overall a strength (true) or a risk (false)?
4) 2–4 bullet notes about how leadership should think about decisions in this mode.

Use only the data provided, do not invent external facts.
Use whatever optional context is present, but do not assume anything that is missing.
  `.trim();

  const userContent = JSON.stringify(input, null, 2);

  const llmResult = await callLLM<ArchetypeSummaryOutput>(systemPrompt, userContent);
  if (llmResult) {
    return llmResult;
  }

  return buildArchetypeFallback(input);
}
