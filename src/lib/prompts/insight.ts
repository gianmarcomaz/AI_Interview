import { InsightSchema } from "@/lib/validate/schema";

export function insightPrompt(args: {
  rollingSummary: string;
  snippet: string;
  facts?: { id: string; text: string }[];
  schemaJson: string;
}) {
  const { rollingSummary, snippet, facts, schemaJson } = args;
  return `
ROLE: You are an interview co-pilot. Output STRICT JSON matching the schema. No extra text.

TASK:
- Summarize the last turn in ≤20 words and ≤120 characters.
- Choose 1–3 tags from ALLOWED_TAGS (provided in schema).
- If facts are provided and used, include their IDs as "citations".
- Be neutral and factual.
- ALWAYS provide a follow-up question (either for clarification if answer was shallow, or to introduce a new topic if answer was thorough).

CONTEXT:
- Rolling summary: "${rollingSummary}"
- Latest transcript snippet (last ~15s): "${snippet}"
- Retrieved facts (optional): ${JSON.stringify(facts ?? [])}

SCHEMA:
${schemaJson}

RETURN: JSON ONLY.
`;
}

export function retryPrompt(original: string, snippet: string) {
  return `${original}

IMPORTANT:
- Return VALID JSON only (no prose)
- Ensure the "summary" reflects this snippet: "${snippet}"
- ALWAYS include a follow-up question in the response
`;
}

export const SCHEMA_JSON = JSON.stringify(InsightSchema.shape, null, 2);

