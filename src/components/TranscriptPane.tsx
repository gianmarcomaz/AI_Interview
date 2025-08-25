'use client';
import { useSession } from '@/lib/store/session';
import StatusPill from '@/components/ui/StatusPill';

type Props = {
  partial: string;
  listening?: boolean; // new
};


export default function TranscriptPane({ partial, listening = false }: Props) {

  const transcript = useSession(s => s.transcript);
  const lastInsight = useSession(s => s.lastInsight);
  const llmMode = useSession(s => s.llmMode);
  const tokensUsed = useSession(s => s.tokensUsed);
  const softCap = useSession(s => s.softCap);
  
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-6 h-full shadow-glow">
<div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white">📄</div>
    <h3 className="text-white text-xl font-extrabold leading-none">Live Transcript</h3>
  </div>

  <StatusPill
    on={!!listening}
    labelOn="Recording…"
    labelOff="Stopped"
    size="sm"
  />
</div>
      
      <div className="bg-slate-800/30 rounded-2xl border border-slate-600 h-80 overflow-auto p-6 custom-scrollbar">
        {transcript.length === 0 && !partial ? (
          <div className="text-center text-blue-200 py-16">
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-float">
              <span className="text-4xl">🎤</span>
            </div>
            <p className="text-xl font-semibold mb-3">Ready to Start</p>
            <p className="text-base">Click "Start" to begin recording your interview responses</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transcript.map((t, i) => (
              <div key={i} className="bg-slate-700/30 p-4 rounded-xl border border-slate-600 animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-blue-400 text-sm font-mono bg-blue-900/20 px-3 py-1 rounded-lg">
                    [{new Date(t.ts).toLocaleTimeString()}]
                  </span>
                  <span className="bg-green-600/20 border border-green-500/30 text-green-300 px-3 py-1 rounded-full text-xs font-semibold">
                    Final
                  </span>
                </div>
                <p className="text-white leading-relaxed text-base">{t.text}</p>
              </div>
            ))}
            {partial && (
              <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-600 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-blue-400 text-sm font-mono bg-blue-900/20 px-3 py-1 rounded-lg">
                    [{new Date().toLocaleTimeString()}]
                  </span>
                  <span className="bg-blue-600/20 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold">
                    Partial
                  </span>
                </div>
                <p className="text-blue-200 leading-relaxed text-base italic">{partial}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* AI Insights Section */}
      {lastInsight && (
        <div className="mt-6 p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl border border-purple-600/50">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-purple-400">🤖</span>
            <span className="text-purple-200 text-sm font-semibold">AI Insight</span>
            <span className={`ml-auto px-2 py-1 rounded-full text-xs font-semibold ${
              llmMode === 'cloud' ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300' : 'bg-amber-600/20 border border-amber-500/30 text-amber-300'
            }`}>
              {llmMode === 'cloud' ? 'Cloud LLM' : 'Rules Mode'}
            </span>
          </div>
          <p className="text-purple-100 text-sm leading-relaxed mb-3">
            {lastInsight.summary}
          </p>
          {lastInsight.tags && lastInsight.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {lastInsight.tags.map((tag, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-purple-900/40 border border-purple-700/40 text-purple-200 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {lastInsight.citations && lastInsight.citations.length > 0 && (
            <div className="text-xs text-purple-300">
              Citations: {lastInsight.citations.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* System Status */}
      <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-600">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-blue-400">💡</span>
          <span className="text-blue-200 text-sm font-semibold">System Status</span>
        </div>
        <div className="space-y-2 text-blue-200 text-sm">
          <p>{transcript.length} final responses recorded. Partial text appears in <span className="italic">italics</span> while you're speaking.</p>
          <div className="flex items-center gap-4 text-xs">
            <span suppressHydrationWarning>Mode: <span className="font-mono" suppressHydrationWarning>{llmMode}</span></span>
            <span suppressHydrationWarning>Tokens: <span className="font-mono" suppressHydrationWarning>{tokensUsed}/{softCap}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
