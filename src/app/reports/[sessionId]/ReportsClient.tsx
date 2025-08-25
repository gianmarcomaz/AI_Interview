'use client';

import { useSession } from "@/lib/store/session";

// Import the report generation functions
import { pdfReport } from "@/lib/reports/pdf";
import { pptReport } from "@/lib/reports/ppt";

type ReportsClientProps = {
  sessionId: string;
  campaignId?: string;
  loading?: boolean;
  onGeneratePDF?: () => void;
  onGeneratePPT?: () => void;
};

export default function ReportsClient({
  sessionId,
  campaignId,
  loading,
  onGeneratePDF,
  onGeneratePPT,
}: ReportsClientProps) {
  // Narrow selectors to reduce render work
  const lastInsight   = useSession(s => s.lastInsight);
  const tagTally      = useSession(s => s.tagTally);
  const transcript    = useSession(s => s.transcript);
  const finalSummary  = useSession(s => s.finalSummary);

  const data = {
    sessionId,
    campaignId,
    summary: lastInsight?.summary ?? finalSummary?.summary ?? finalSummary?.overview,
    tags: (tagTally as Record<string, number>) || {},
    // If `final` is not present on transcript items, include them by default
    quotes: (transcript || [])
      .filter((t: any) => ('final' in t ? t.final : true))
      .slice(-10)
      .map((t: any) => ({ ts: t.ts, text: t.text })),
  };

  const canExport = Boolean(
    data.summary || (data.quotes && data.quotes.length)
  );
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="frosted gradient-surface rounded-2xl p-5 border border-white/20">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            📄 Reports — Session
            <span className="font-mono text-white/90 bg-blue-900/40 px-2.5 py-1 rounded-md border border-white/10 text-sm">
              {sessionId}
            </span>
          </h1>
          {campaignId && (
            <p className="text-blue-200 text-sm mt-1">
              Campaign: <span className="font-mono">{campaignId}</span>
            </p>
          )}
        </div>
  
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">⬇️</span>
            </div>
            <h2 className="text-white font-semibold">Export</h2>
          </div>
  
          <div className="flex gap-3">
            <button
              className="h-12 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onGeneratePDF ? onGeneratePDF : () => pdfReport(data)}
              // If parent provided a handler, keep it clickable; otherwise fall back to old gating
              disabled={loading ?? (!onGeneratePDF && !canExport)}
            >
              {loading ? "Preparing…" : "Generate PDF"}
            </button>
  
            <button
              className="h-12 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold hover:from-indigo-700 hover:to-violet-700 shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onGeneratePPT ? onGeneratePPT : () => pptReport(data)}
              disabled={loading ?? (!onGeneratePPT && !canExport)}
            >
              {loading ? "Preparing…" : "Generate PowerPoint"}
            </button>
          </div>
  
          <p className="text-blue-200 text-sm mt-3">
            Exports include current insights, tag tallies, and latest quotes captured.
          </p>
          {loading ? (
            <p className="text-xs text-blue-200/80 mt-2">Loading transcript…</p>
          ) : null}
        </div>
  
        {/* Final Session Summary */}
        {finalSummary ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">📊</span>
              </div>
              <h2 className="text-white font-bold text-xl">Final Summary</h2>
            </div>
  
            <p className="text-blue-100 mb-4 text-lg">
              {finalSummary.overview ?? finalSummary.summary}
            </p>
  
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-green-300 font-semibold mb-2 text-lg">Strengths</h3>
                <ul className="list-disc ml-5 text-green-100 space-y-1">
                  {finalSummary.strengths?.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-amber-300 font-semibold mb-2 text-lg">Risks</h3>
                <ul className="list-disc ml-5 text-amber-100 space-y-1">
                  {finalSummary.risks?.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
  
            {finalSummary.topics?.length ? (
              <div className="mt-6">
                <h3 className="text-blue-300 font-semibold mb-2 text-lg">Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {finalSummary.topics.map((t: string, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-lg bg-blue-900/40 border border-blue-700/40 text-blue-100 text-sm"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}