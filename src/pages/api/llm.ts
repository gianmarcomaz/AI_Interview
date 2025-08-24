import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { prompt } = req.body || {};
  try {
    const provider = process.env.LLM_PROVIDER as 'openai'|'groq'|'cloudflare'|undefined; // optional
    if (!provider) return res.status(200).json({ error: "No provider configured" });

    if (provider === "openai") {
      const key = process.env.OPENAI_API_KEY!;
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type":"application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role:"user", content: prompt }],
          temperature: 0.2
        })
      });
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content || "{}";
      try { return res.status(200).json(JSON.parse(txt)); } catch { return res.status(200).json({ error:"bad_json", raw:txt }); }
    }

    if (provider === "groq") {
      const key = process.env.GROQ_API_KEY!;
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type":"application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role:"user", content: prompt }],
          temperature: 0.2
        })
      });
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content || "{}";
      try { return res.status(200).json(JSON.parse(txt)); } catch { return res.status(200).json({ error:"bad_json", raw:txt }); }
    }

    if (provider === "cloudflare") {
      const acct = process.env.CF_ACCOUNT_ID!;
      const key = process.env.CF_API_TOKEN!;
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/meta/llama-3.1-8b-instruct`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type":"application/json" },
        body: JSON.stringify({ messages: [{ role:"user", content: prompt }] })
      });
      const j = await r.json();
      const txt = j?.result?.response || "{}";
      try { return res.status(200).json(JSON.parse(txt)); } catch { return res.status(200).json({ error:"bad_json", raw:txt }); }
    }

    return res.status(200).json({ error: "Unknown provider" });
  } catch (e:any) {
    return res.status(200).json({ error: "llm_error", message: e?.message });
  }
}


