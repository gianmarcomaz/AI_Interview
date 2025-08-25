export type CloudProvider = "openai" | "groq" | "cloudflare";

export async function cloudLLM(prompt: string) {
  const key = `llm:${prompt}`;
  // simple in-flight de-dupe to avoid duplicate network calls
  const w = (window as any);
  w.__inflight ||= new Map<string, Promise<any>>();
  if (w.__inflight.has(key)) {
    return w.__inflight.get(key);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const p = (async () => {
    try {
      const r = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
        cache: "no-store",
        keepalive: true,
      });
      const json = await r.json();
      return json;
    } finally {
      clearTimeout(timeoutId);
      w.__inflight.delete(key);
    }
  })();

  w.__inflight.set(key, p);
  return p;
}


