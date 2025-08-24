export function chatPrompt(q: string, facts: { id: string; text: string }[]) {
  return `
ROLE: Analyst over interview transcripts + JD facts. Cite sources.

QUESTION: ${q}

FACTS (JSON):
${JSON.stringify(facts)}

INSTRUCTIONS:
- Answer concisely in <= 8 sentences.
- Include inline citations using the provided ids, e.g., [sess#12:t1712345678901], [JD#3].
- If unsure, say so briefly.

RETURN: Plain text with citations.
`;
}
