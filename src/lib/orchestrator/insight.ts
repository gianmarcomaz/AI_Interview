'use client';
import { InsightSchema, type Insight, SessionSummarySchema, type SessionSummary } from "../ai/schemas";

export type InsightInput = {
  mode: "cloud" | "rules";
  turnId: string;
  rollingSummary: string;
  snippet: string;
  facts: { id: string; text: string }[];
  tokenBudgetLeft: number; // pass from store
};

async function callCloudJSON(system: string, user: string, max_tokens = 120) {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, user, json: true, max_tokens })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ text: string; usage?: { total_tokens: number } }>;
}

function rulesInsight(turnId: string, snippet: string, facts: {id:string;text:string}[]): Insight {
  const s = snippet.trim();
  const sum =
    s.length < 40 ? "answer is brief; ask for a concrete example." :
    /(\d|percent|%)/i.test(s) ? "mentions metrics; explore how impact was measured." :
    "summarizes experience; probe for specific outcomes.";
  const tags = Array.from(new Set(
    [/latency|perf|cache/i.test(s) ? "performance" : null,
     /system|scale|kafka|queue/i.test(s) ? "systems" : null,
     /team|lead|mentor/i.test(s) ? "leadership" : null].filter(Boolean) as string[]
  ));
  const cites = facts.slice(0,2).map(f => f.id);
  
  // Enhanced follow-up logic for rules mode
  const needsDepth = s.length < 60 || /general|generic|unsure/i.test(s);
  const fu = needsDepth ? "Can you share a concrete example with numbers?" : undefined;
  
  return { schema_version: 1, turn_id: turnId, summary: sum.slice(0, 120), tags: tags.slice(0,3), citations: cites, followup: fu };
}

export async function generateInsight(input: InsightInput): Promise<{ json: Insight; latency: number; usedTokens: number }> {
  const { mode, turnId } = input;
  const t0 = performance.now();

  const snippet = (input.snippet || "").slice(-400);
  const roll = (input.rollingSummary || "").slice(-240);
  const facts = (input.facts || []).slice(0,3);
  const factsBullets = facts.map(f => `- (${f.id}) ${f.text.slice(0,120)}`).join("\n");

  if (mode === "rules" || input.tokenBudgetLeft <= 0) {
    const json = rulesInsight(turnId, snippet, facts);
    return { json, latency: performance.now() - t0, usedTokens: 0 };
  }

  const system = [
    "You are an interview insight engine.",
    "Return STRICT JSON only:",
    "{ schema_version:1, turn_id:string, summary<=120, tags:string[<=3], citations?:string[<=3], followup?:string<=140 }",
    "followup: at most ~15 words, only if the candidate's answer needs depth/clarity; otherwise omit.",
  ].join("\n");

  const user = [
    `TURN: ${turnId}`,
    `ROLLING_SUMMARY: ${roll}`,
    `ANSWER_SNIPPET: ${snippet}`,
    facts.length ? `FACTS:\n${factsBullets}` : "FACTS: (none)",
    "Return JSON ONLY."
  ].join("\n");

  try {
    const { text, usage } = await callCloudJSON(system, user, 120);
    const parsed = InsightSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("schema_fail");
    return { json: parsed.data, latency: performance.now() - t0, usedTokens: usage?.total_tokens ?? 0 };
  } catch {
    // one retry with tighter instruction
    try {
      const { text, usage } = await callCloudJSON(system + "\nSTRICT: Do not include any text outside JSON.", user, 120);
      const parsed = InsightSchema.safeParse(JSON.parse(text));
      if (!parsed.success) throw new Error("schema_fail_2");
      return { json: parsed.data, latency: performance.now() - t0, usedTokens: usage?.total_tokens ?? 0 };
    } catch {
      const json = rulesInsight(turnId, snippet, facts);
      return { json, latency: performance.now() - t0, usedTokens: 0 };
    }
  }
}

// FINAL SESSION SUMMARY

export async function generateFinalSummary(params: {
  mode: "cloud" | "rules";
  sessionId: string;
  transcript: { role: "ai" | "user"; text: string }[];
  insights: Insight[];
  tokenBudgetLeft: number;
}): Promise<{ json: SessionSummary; usedTokens: number }> {
  const { mode, sessionId, transcript, insights, tokenBudgetLeft } = params;
  if (mode === "rules" || tokenBudgetLeft <= 0) {
    // simple rules summary
    const all = transcript.filter(t => t.role === "user").map(t => t.text).join(" ");
    const strengths = [/lead|mentor|owner/i.test(all) ? "leadership" : null,
      /perf|latency|scal/i.test(all) ? "systems-performance" : null,
      /ml|model|rag/i.test(all) ? "ml-rag" : null].filter(Boolean) as string[];
    const risks = [all.length < 400 ? "brevity—probe for depth" : null].filter(Boolean) as string[];
    const topics = Array.from(new Set(insights.flatMap(i => i.tags ?? []))).slice(0,8);
    const json: SessionSummary = { schema_version: 1, session_id: sessionId, overview: "Interview completed; see strengths/risks.", strengths: strengths.slice(0,5), risks: risks.slice(0,5), topics };
    return { json, usedTokens: 0 };
  }

  const lastK = transcript.slice(-16).map(t => `${t.role.toUpperCase()}: ${t.text}`).join("\n").slice(-2000);
  const tagsLine = Array.from(new Set(insights.flatMap(i => i.tags || []))).slice(0,8).join(", ");

  const system = [
    "You are an interview summarizer. Return STRICT JSON only:",
    "{ schema_version:1, session_id:string, overview:string<=600, strengths:string[<=5], risks:string[<=5], topics?:string[<=8] }",
    "Summarize the candidate's performance, not the agent."
  ].join("\n");

  const user = [
    `SESSION: ${sessionId}`,
    `TAGS: ${tagsLine}`,
    `TRANSCRIPT_LAST:`,
    lastK,
    "Return JSON ONLY."
  ].join("\n");

  const { text, usage } = await callCloudJSON(system, user, 240);
  try {
    const parsed = SessionSummarySchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("schema_fail");
    return { json: parsed.data, usedTokens: usage?.total_tokens ?? 0 };
  } catch {
    // fallback rules
    const all = transcript.filter(t => t.role === "user").map(t => t.text).join(" ");
    const strengths = [/lead|mentor|owner/i.test(all) ? "leadership" : null,
      /perf|latency|scal/i.test(all) ? "systems-performance" : null,
      /ml|model|rag/i.test(all) ? "ml-rag" : null].filter(Boolean) as string[];
    const risks = [all.length < 400 ? "brevity—probe for depth" : null].filter(Boolean) as string[];
    const topics = Array.from(new Set(insights.flatMap(i => i.tags ?? []))).slice(0,8);
    const json: SessionSummary = { schema_version: 1, session_id: sessionId, overview: "Interview completed; see strengths/risks.", strengths: strengths.slice(0,5), risks: risks.slice(0,5), topics };
    return { json, usedTokens: 0 };
  }
}


