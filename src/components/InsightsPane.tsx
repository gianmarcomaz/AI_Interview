'use client';
import { useMemo, useState } from "react";
import { useSession } from "@/lib/store/session";

export default function InsightsPane() {
  const { lastInsight, lastLatencyMs, tagTally, transcript } = useSession();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const matchingQuotes = useMemo(() => {
    if (!selectedTag) return [] as { ts: number; text: string }[];
    const needle = selectedTag.toLowerCase();
    return (transcript || [])
      .filter((t) => t.final && String(t.text || '').toLowerCase().includes(needle))
      .slice(-10)
      .map((t) => ({ ts: t.ts, text: t.text }));
  }, [selectedTag, transcript]);
  return (
    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm">🧠</span>
        </div>
        <h3 className="text-lg font-semibold text-white">AI Insights</h3>
        <div className="ml-auto">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/20">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-white text-xs font-medium">
              {lastLatencyMs ? Math.round(lastLatencyMs) : 0}ms
            </span>
          </div>
        </div>
      </div>
      
             {!lastInsight ? (
         <div className="text-center py-8">
           <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
             <span className="text-white/50 text-2xl">⚡</span>
           </div>
           <p className="text-white/50 text-sm font-medium mb-1">Waiting for Insights</p>
           <p className="text-white/30 text-xs">AI will analyze your responses and provide real-time insights</p>
         </div>
               ) : lastInsight.summary === "Needs human review" || lastInsight.flags?.includes("model_unavailable") ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-amber-400 text-2xl">⚠️</span>
            </div>
            <p className="text-amber-300 text-sm font-medium mb-1">AI Model Unavailable</p>
            <p className="text-amber-200 text-xs mb-3">Using fallback mode. Switch to 'rules' mode for better results.</p>
            
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 max-w-md mx-auto">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 text-sm">🔧</span>
                <div className="text-left">
                  <p className="text-amber-200 text-xs font-medium mb-1">Troubleshooting:</p>
                  <ul className="text-amber-200 text-xs space-y-1">
                    <li>• Use Chrome/Edge with WebGPU support</li>
                    <li>• Check browser console for errors</li>
                    <li>• Try 'rules' mode for immediate results</li>
                    <li>• Ensure stable internet connection</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
       ) : (
        <div className="space-y-4">
          {/* Main Summary */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-400 text-sm">📝</span>
              <span className="text-white text-xs font-medium">Summary</span>
            </div>
            <p className="text-white text-sm leading-relaxed">{lastInsight.summary}</p>
          </div>
          
                     {/* Tags */}
           {lastInsight.tags && lastInsight.tags.length > 0 && (
             <div className="bg-white/5 rounded-xl p-4 border border-white/10">
               <div className="flex items-center gap-2 mb-3">
                 <span className="text-purple-400 text-sm">🏷️</span>
                 <span className="text-white text-xs font-medium">Key Topics</span>
               </div>
               <div className="flex gap-2 flex-wrap">
                 {lastInsight.tags.map((t, i) => (
                   <button
                     key={i}
                     className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 text-xs font-medium border border-purple-500/30 cursor-pointer hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                     title={`Click to review ${t}`}
                     onClick={() => { setSelectedTag(t); setOpen(true); }}
                   >
                     {t}
                   </button>
                 ))}
               </div>
             </div>
           )}
          
          {/* Citations */}
          {lastInsight.citations && lastInsight.citations.length > 0 && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-400 text-sm">🔗</span>
                <span className="text-white text-xs font-medium">References</span>
              </div>
              <div className="text-green-300 text-xs">
                {lastInsight.citations.join(", ")}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Tag Coverage Heatmap */}
      {Object.keys(tagTally).length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-400 text-sm">📊</span>
            <span className="text-white text-xs font-medium">Topic Coverage</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(tagTally).map(([k, v]) => (
              <div key={k} className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-xs font-medium capitalize">{k}</span>
                  <span className="text-blue-300 text-xs font-bold">{v as number}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((v as number) * 20, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Review Modal */}
      {open && selectedTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl mx-auto p-6 rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/90 to-blue-900/90 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-semibold">Insight Review — <span className="capitalize text-purple-300">{selectedTag}</span></h4>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-sm px-2 py-1 rounded border border-white/20">Close</button>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-white/70 text-xs mb-1">Summary</div>
                <div className="text-white text-sm">{lastInsight?.summary || '—'}</div>
              </div>
              {!!(lastInsight?.citations && lastInsight.citations.length) && (
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="text-white/70 text-xs mb-1">Citations</div>
                  <div className="text-green-300 text-xs break-words">{lastInsight.citations.join(', ')}</div>
                </div>
              )}
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-white/70 text-xs mb-2">Matching Quotes</div>
                {matchingQuotes.length ? (
                  <ul className="space-y-2">
                    {matchingQuotes.map((q) => (
                      <li key={q.ts} className="text-white/90 text-sm">
                        <span className="text-white/40 mr-2">[{new Date(q.ts).toLocaleTimeString()}]</span>
                        {q.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-white/60 text-sm">No matching transcript found for this tag.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
