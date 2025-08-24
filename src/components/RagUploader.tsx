'use client';
import { useState } from "react";
import { buildIndex, FactDoc } from "@/lib/rag/bm25";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function RagUploader({ onIndex }:{ onIndex:(search:(q:string,k?:number)=>FactDoc[])=>void }) {
  const [raw, setRaw] = useState("");

  function makeDocs(txt:string): FactDoc[] {
    // Split into bullet-like facts
    const lines = txt.split(/\n+/).map(s=>s.trim()).filter(Boolean);
    return lines.map((text, i)=> ({ id: `JD#${i+1}`, text: text.slice(0, 240) }));
  }

  return (
    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm">🔍</span>
        </div>
        <h3 className="text-lg font-semibold text-white">Knowledge Base</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-white text-sm font-medium mb-2 block">Job Description / Resume</label>
          <Textarea 
            rows={6} 
            placeholder="Paste job requirements, skills, or project details here to enable AI-powered insights and citations..." 
            value={raw} 
            onChange={e=>setRaw(e.target.value)}
            className="bg-white/5 border-white/20 text-white placeholder-white/40 focus:border-blue-500/50 transition-colors duration-200"
          />
        </div>
        
        <div className="flex gap-3">
          <Button 
            onClick={()=>{ const idx = buildIndex(makeDocs(raw)); onIndex(idx); }}
            cta="success" shadow
            disabled={!raw.trim()}
            className="px-6 flex items-center gap-2"
          >
            <span className="text-sm">📚</span>
            Index Text
          </Button>
          
          <div className="relative">
            <input 
              type="file" 
              accept=".txt" 
              onChange={async e=>{
                const f = e.target.files?.[0]; if(!f) return;
                const txt = await f.text(); const idx = buildIndex(makeDocs(txt)); onIndex(idx);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button 
              variant="secondary"
              cta="info" shadow className="px-6 flex items-center gap-2"
            >
              <span className="text-sm">📁</span>
              Upload File
            </Button>
          </div>
        </div>
        
        {raw.trim() && (
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 text-sm">💡</span>
              <p className="text-blue-200 text-xs">
                <strong>Tip:</strong> The AI will use this context to provide more relevant insights and citations during your interview.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


