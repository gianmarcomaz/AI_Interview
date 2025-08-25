import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const preferredRegion = ["iad1", "cdg1", "sin1"]; // reduce cold-starts near users

type LlmReq = {
  system: string;
  user: string;
  json: boolean;
  max_tokens?: number;
  temperature?: number;
  model?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as LlmReq;
  const apiKey = process.env.OPENAI_API_KEY;
  const provider = process.env.LLM_PROVIDER || "openai";
  const model = body.model || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (provider !== "openai" || !apiKey) {
    return NextResponse.json({ error: "Cloud LLM disabled" }, { status: 400 });
  }

  // Responses API w/ JSON output
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: body.temperature ?? 0.2,
      max_tokens: body.max_tokens ?? 120,
      response_format: body.json ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: body.system },
        { role: "user", content: body.user }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json({ error: text }, { status: 500 });
  }

  const data = await resp.json();
  // Normalize output text & token usage
  const text = data.choices?.[0]?.message?.content || "";
  const usage = {
    input_tokens: data.usage?.prompt_tokens ?? 0,
    output_tokens: data.usage?.completion_tokens ?? 0,
    total_tokens: (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
  };

  return NextResponse.json({ text, usage });
}
