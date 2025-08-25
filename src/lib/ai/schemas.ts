import { z } from "zod";

export const InsightSchema = z.object({
  schema_version: z.literal(1),
  turn_id: z.string().min(1),
  summary: z.string().max(120),
  tags: z.array(z.string().min(1)).max(3),
  citations: z.array(z.string()).max(3).optional(),
  followup: z.string().max(140).optional(), // <= ~15 words
});

export type Insight = z.infer<typeof InsightSchema>;

export const SessionSummarySchema = z.object({
  schema_version: z.literal(1),
  session_id: z.string(),
  overview: z.string().max(600),
  strengths: z.array(z.string()).max(5),
  risks: z.array(z.string()).max(5),
  topics: z.array(z.string()).max(8).optional()
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;
