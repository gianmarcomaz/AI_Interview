'use client';
import { useState, useEffect } from "react";

export type LLMMode = "local"|"cloud"|"rules";

export default function ModeToggle({ value, onChange }:{ value:LLMMode; onChange:(m:LLMMode)=>void }) {
  const [m, setM] = useState<LLMMode>(value);
  // keep local in sync and avoid mount-loop
  useEffect(() => { setM(value); }, [value]);
  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <span className="text-blue-200">Mode</span>
      <div className="bg-white/5 border border-white/20 rounded-full p-1 inline-flex">
        {(["local","cloud","rules"] as LLMMode[]).map((x)=>{
          const active = m===x;
          return (
            <button
              key={x}
              onClick={()=>{ if (x!==m) { setM(x); onChange(x); } }}
              className={`px-3 py-1.5 rounded-full capitalize transition-all ${active
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-glow'
                : 'text-blue-200 hover:bg-white/10'}
              `}
            >
              {x}
            </button>
          );
        })}
      </div>
    </div>
  );
}


