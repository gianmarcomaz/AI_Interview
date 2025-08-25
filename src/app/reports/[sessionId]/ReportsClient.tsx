'use client';

import { useSession } from "@/lib/store/session";
import { pdfReport } from "@/lib/reports/pdf";
import { pptReport } from "@/lib/reports/ppt";

export default function ReportsClient({
  sessionId,
  campaignId,
}: {
  sessionId: string;
  campaignId?: string;
}) {
  const { lastInsight, tagTally, transcript } = useSession();

  const data = {
    sessionId,
    campaignId,
    summary: lastInsight?.summary,
    tags: (tagTally as Record<string, number>) || {},
    quotes: (transcript || [])
      .filter((t: any) => t.final)
      .slice(-10)
      .map((t: any) => ({ ts: t.ts, text: t.text })),
  };
  const canExport = Boolean(data.summary || (data.quotes && data.quotes.length));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="frosted gradient-surface rounded-2xl p-5 border border-white/20">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">📄 Reports — Session
            <span className="font-mono text-white/90 bg-blue-900/40 px-2.5 py-1 rounded-md border border-white/10 text-sm">{sessionId}</span>
          </h1>
          {campaignId && (
            <p className="text-blue-200 text-sm mt-1">Campaign: <span className="font-mono">{campaignId}</span></p>
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
            <button className="h-12 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 shadow-glow disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => pdfReport(data)} disabled={!canExport}>
              Generate PDF
            </button>
            <button className="h-12 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold hover:from-indigo-700 hover:to-violet-700 shadow-glow disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => pptReport(data)} disabled={!canExport}>
              Generate PowerPoint
            </button>
          </div>
          <p className="text-blue-200 text-sm mt-3">Exports include current insights, tag tallies, and latest quotes captured.</p>
        </div>
      </main>
    </div>
  );
}
