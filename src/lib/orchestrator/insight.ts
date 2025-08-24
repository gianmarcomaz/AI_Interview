'use client';
import { InsightSchema } from "@/lib/validate/schema";
import { redactPII } from "@/lib/validate/safety";
import { cosineSim } from "@/lib/validate/similarity";
import { insightPrompt, retryPrompt, SCHEMA_JSON } from "@/lib/prompts/insight";
import { localLLM } from "@/lib/llm/local";
import { cloudLLM } from "@/lib/llm/cloud";

export type Fact = { id: string; text: string };

export async function generateInsight(opts:{
  mode: "local"|"cloud"|"rules";
  turnId: string;
  rollingSummary: string;
  snippet: string;
  facts?: Fact[];
}) {
  const start = performance.now();
  const snippetSafe = redactPII(opts.snippet);

  if (opts.mode === "rules") {
    const summary = truncate20(snippetSafe);
    const json = { schema_version:1 as const, turn_id: opts.turnId, summary, tags:["review"] };
    const end = performance.now();
    return { json, latency: end-start };
  }

  const prompt = insightPrompt({
    rollingSummary: opts.rollingSummary,
    snippet: snippetSafe,
    facts: opts.facts,
    schemaJson: SCHEMA_JSON
  });

  const out = await (opts.mode === "local" ? localLLM(prompt) : cloudLLM(prompt));

  const parsed = InsightSchema.safeParse(out);
  const sumOk = parsed.success && withinCaps(parsed.data.summary);
  const simOk = parsed.success && cosineSim(opts.snippet, parsed.data.summary) >= 0.70;
  const citOk = ensureCitations(parsed.success ? parsed.data : undefined, opts.facts);

  if (!(parsed.success && sumOk && simOk && citOk)) {
    const retry = await (opts.mode==="local" ? localLLM(retryPrompt(prompt, opts.snippet)) : cloudLLM(retryPrompt(prompt, opts.snippet)));
    const parsed2 = InsightSchema.safeParse(retry);
    const sumOk2 = parsed2.success && withinCaps(parsed2.data.summary);
    const simOk2 = parsed2.success && cosineSim(opts.snippet, parsed2.data.summary) >= 0.70;
    const citOk2 = ensureCitations(parsed2.success ? parsed2.data : undefined, opts.facts);
    if (parsed2.success && sumOk2 && simOk2 && citOk2) {
      const end = performance.now();
      return { json: parsed2.data, latency: end-start };
    }
    const end = performance.now();
    return { json: { schema_version:1 as const, turn_id: opts.turnId, summary: "Needs human review", tags:["review"], flags:["format_fix"] }, latency: end-start };
  }

  const end = performance.now();
  return { json: parsed.data, latency: end-start };
}

function withinCaps(s:string){ return s.length<=120 && s.trim().split(/\s+/).length<=20; }

function ensureCitations(data:any|undefined, facts?:Fact[]) {
  if (!data) return false;
  if (!facts || facts.length===0) return true;
  if (!data.citations || !Array.isArray(data.citations)) return false;
  const ids = new Set(facts.map(f=>f.id));
  return data.citations.every((c:string)=>ids.has(c));
}

function truncate20(s:string){
  const words = s.trim().split(/\s+/).slice(0,20);
  let t = words.join(' ');
  if (t.length>120) t = t.slice(0,120);
  return t;
}


