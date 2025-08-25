import { z } from "zod";

export const ALLOWED_TAGS = [
  "intro","experience","projects","leadership","impact",
  "systems","ml","latency","reliability","security",
  "ownership","communication","culture","off_topic","review"
] as const;

export const InsightSchema = z.object({
  schema_version: z.literal(1),
  turn_id: z.string().min(1),
  summary: z.string().max(120),
  tags: z.array(z.enum(ALLOWED_TAGS)).min(1).max(4),
  citations: z.array(z.string()).max(3).optional(),
  flags: z.array(z.enum(["risky_topic","pii","format_fix"])).optional(),
  followup: z.string().max(140).optional() // AI-generated follow-up question
});

export type Insight = z.infer<typeof InsightSchema>;

export function withinCaps(s: string) {
  return s.length <= 120 && s.trim().split(/\s+/).filter(Boolean).length <= 20;
}


