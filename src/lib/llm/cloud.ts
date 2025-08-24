export type CloudProvider = "openai" | "groq" | "cloudflare";

export async function cloudLLM(prompt: string) {
  const r = await fetch("/api/llm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  const json = await r.json();
  return json;
}


