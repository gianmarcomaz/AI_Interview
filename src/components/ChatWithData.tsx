'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import elasticlunr from 'elasticlunr';
import { useSession } from '@/lib/store/session';
import { localLLM } from '@/lib/llm/local';
import { cloudLLM } from '@/lib/llm/cloud';
import { chatPrompt } from '@/lib/prompts/chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// ----- Types -----
type Doc = { id: string; text: string };
type ElasticIndex = ReturnType<typeof elasticlunr>;

// elasticlunr can be exported as default or as the module itself depending on bundler/interops.
// Create a robust callable that works in both cases.
const elasticlunrFn: any = elasticlunr;

export default function ChatWithData({ campaignId }: { campaignId: string }) {
  const { transcript, llmMode } = useSession() as any;

  const [extraDocs, setExtraDocs] = useState<Doc[]>([]);
  const [q, setQ] = useState('');
  const [ans, setAns] = useState<string>('');

  // Keep the index in a ref; initialize with null and guard usages.
  const idxRef = useRef<ElasticIndex | null>(null);

  // Build the corpus: final turns (from local transcript) + any uploaded .txt docs
  const corpus: Doc[] = useMemo(() => {
    const sessionDocs: Doc[] = (transcript || [])
      .filter((t: any) => t?.final)
      .map((t: any) => ({ id: `sess#local:t${t.ts}`, text: String(t.text || '') }));
    return [...sessionDocs, ...extraDocs];
  }, [transcript, extraDocs]);

  // (Re)build the elasticlunr index whenever corpus changes
  useEffect(() => {
    const idx = elasticlunrFn(function (this: any) {
      this.addField('text');
      this.setRef('id');
    }) as ElasticIndex;

    corpus.forEach((d) => idx.addDoc(d));
    idxRef.current = idx;

    return () => {
      idxRef.current = null;
    };
  }, [corpus]);

  function topFacts(query: string, k = 6): Doc[] {
    const idx = idxRef.current;
    if (!idx) return [];
    const hits = idx.search(query, { expand: true }) as Array<{ ref: string }>;
    return hits
      .slice(0, k)
      .map((r) => corpus.find((d) => d.id === r.ref) ?? null)
      .filter((d): d is Doc => d !== null);
  }

  async function ask() {
    const facts = topFacts(q, 8);
    const prompt = chatPrompt(q, facts);
    const out = await (llmMode === 'cloud' ? cloudLLM(prompt) : localLLM(prompt));
    const text = typeof out === 'string' ? out : (out?.text ?? JSON.stringify(out));
    setAns(text);
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm">💬</span>
        </div>
        <h3 className="text-lg font-semibold text-white">Chat with your data</h3>
      </div>

      <div className="flex gap-2">
        <Input
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
          placeholder="Ask anything about these interviews…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button onClick={ask} disabled={!q.trim()} cta="primary" shadow>
          Ask
        </Button>
      </div>

      <div className="mt-3">
        <Textarea className="min-h-[180px] bg-white/5 border-white/20 text-white" readOnly value={ans || '—'} />
      </div>

      <div className="mt-4">
        <label className="text-xs text-blue-200">Add context (.txt)</label>
        <input
          type="file"
          accept=".txt"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const txt = await f.text();
            const lines = txt.split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 400);
            const docs: Doc[] = lines.map((t, i) => ({ id: `JD#${i + 1}`, text: t.slice(0, 500) }));
            setExtraDocs(docs);
          }}
          className="file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-blue-600 file:text-white file:px-4 file:py-2 file:cursor-pointer text-white"
        />
      </div>
    </div>
  );
}
