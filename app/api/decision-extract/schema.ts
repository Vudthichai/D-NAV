import { z } from "zod";

export const strengthSchema = z.enum(["hard", "soft"]);

export const categorySchema = z.enum([
  "Operations",
  "Finance",
  "Product",
  "Hiring",
  "Legal",
  "Strategy",
  "Sales/Go-to-market",
  "Other",
]);

const scoreSchema = z.object({
  score: z.number().int().min(1).max(10),
  evidence: z.string().min(1),
});

export const decisionCandidateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  strength: strengthSchema,
  category: categorySchema,
  decision: z.string().min(1),
  rationale: z.string().min(1),
  constraints: z.object({
    impact: scoreSchema,
    cost: scoreSchema,
    risk: scoreSchema,
    urgency: scoreSchema,
    confidence: scoreSchema,
  }),
  evidence: z.object({
    page: z.number().int().positive(),
    quote: z.string().min(1).max(280),
    locationHint: z.string().optional(),
  }),
  tags: z.array(z.string()),
});

export const decisionExtractResponseSchema = z.object({
  doc: z.object({
    name: z.string().min(1),
    pageCount: z.number().int().positive(),
  }),
  candidates: z.array(decisionCandidateSchema),
  meta: z.object({
    pagesReceived: z.number().int().min(0),
    totalChars: z.number().int().min(0),
  }),
});

const legacyRequestSchema = z.object({
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

const requestOptionsSchema = z
  .object({
    maxCandidatesPerPage: z.number().int().positive().optional(),
    model: z.string().min(1).optional(),
  })
  .optional();

const newRequestSchema = z.object({
  docName: z.string().min(1),
  pages: z
    .array(
      z.object({
        page: z.number().int().positive(),
        text: z.string(),
      }),
    )
    .min(1, "At least one page is required."),
  options: requestOptionsSchema,
});

export const decisionExtractRequestSchema = z.union([legacyRequestSchema, newRequestSchema]);

export type DecisionCandidate = z.infer<typeof decisionCandidateSchema>;
export type DecisionExtractResponse = z.infer<typeof decisionExtractResponseSchema>;
export type DecisionExtractRequest = z.infer<typeof decisionExtractRequestSchema>;
