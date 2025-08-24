'use client';
import { useParams, useSearchParams } from 'next/navigation';
import CSVUpload from '@/components/CSVUpload';
import { useMemo } from 'react';
import { getAll } from '@/lib/metrics/local';

export default function CampaignDashboard() {
  const params = useParams();
  const id = String((params as any)?.id || '');
  const q = useSearchParams();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const mode = ((q && q.get('m')) as 'structured'|'conversational') || 'structured';
  const sampleSession = useMemo(() => `${origin}/i/demo123?c=${id}&m=${mode}`, [origin, id, mode]);
  const embedSnippet = `<script src="${origin}/embed.js" data-campaign="${id}" data-mode="${mode}"></script>\n<div id="yourapp-embed"></div>`;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 pt-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Campaign Dashboard
          </h1>
          <p className="text-xl text-blue-200">
            Manage your interview campaign: <span className="font-mono text-blue-300 bg-blue-900/50 px-3 py-1 rounded-lg">{id}</span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <h2 className="text-2xl font-bold text-white mb-4">🚀 Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <a 
              href={sampleSession} 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white p-4 rounded-xl text-center transition-all duration-200 hover:scale-105"
            >
              <div className="text-2xl mb-2">🎤</div>
              <div className="font-semibold">Test Interview</div>
              <div className="text-sm opacity-90">Try it yourself first</div>
            </a>
            
            <button onClick={() => document.getElementById('questions')?.scrollIntoView({ behavior: 'smooth' })} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-4 rounded-xl text-center transition-all duration-200 hover:scale-105">
              <div className="text-2xl mb-2">📋</div>
              <div className="font-semibold">View Questions</div>
              <div className="text-sm opacity-90">See the question bank</div>
            </button>
            
            <button onClick={() => document.getElementById('analytics')?.scrollIntoView({ behavior: 'smooth' })} className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white p-4 rounded-xl text-center transition-all duration-200 hover:scale-105">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-semibold">Analytics</div>
              <div className="text-sm opacity-90">View responses & insights</div>
            </button>
          </div>
        </div>

        {/* Share & Embed Section */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-2xl">🔗</div>
              <h3 className="text-xl font-bold text-white">Share Link</h3>
            </div>
            <p className="text-blue-200 text-sm mb-4">
              Send this link to candidates to start their interview
            </p>
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
              <p className="text-blue-300 font-mono text-sm break-all">{sampleSession}</p>
            </div>
            <button 
              onClick={() => navigator.clipboard.writeText(sampleSession)}
              className="mt-3 h-10 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:from-blue-700 hover:to-purple-700 shadow-glow text-sm"
            >
              📋 Copy Link
            </button>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-2xl">📱</div>
              <h3 className="text-xl font-bold text-white">Embed Widget</h3>
            </div>
            <p className="text-blue-200 text-sm mb-4">
              Add interviews to your website or application
            </p>
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
              <pre className="text-blue-300 text-xs overflow-x-auto">{embedSnippet}</pre>
            </div>
            <button 
              onClick={() => navigator.clipboard.writeText(embedSnippet)}
              className="mt-3 h-10 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:from-purple-700 hover:to-pink-700 shadow-glow text-sm"
            >
              📋 Copy Code
            </button>
          </div>
        </section>

        {/* CSV Upload Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl">📁</div>
            <h3 className="text-xl font-bold text-white">Bulk Invite Generation</h3>
          </div>
          <p className="text-blue-200 text-sm mb-4">
            Upload a CSV with candidate names/emails to generate multiple invite links at once
          </p>
          <CSVUpload campaignId={id} mode={mode} />
        </div>

        {/* Stats Section */}
        <section id="analytics" className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-2xl">📊</div>
            <h3 className="text-2xl font-bold text-white">Campaign Statistics</h3>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl p-4">
                <div className="text-3xl font-bold text-blue-300 mb-2">{(() => {
                  const m = typeof window !== "undefined" ? getAll(id) : { responses: 0 };
                  return m.responses;
                })()}</div>
                <div className="text-blue-200 font-semibold">Total Responses</div>
                <div className="text-blue-300 text-sm">Interviews completed</div>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-green-600/20 border border-green-500/30 rounded-xl p-4">
                <div className="text-3xl font-bold text-green-300 mb-2">{(() => {
                  const m = typeof window !== "undefined" ? getAll(id) : { minutes: 0 };
                  return m.minutes;
                })()}</div>
                <div className="text-green-200 font-semibold">Minutes</div>
                <div className="text-green-300 text-sm">Total interview time</div>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-purple-600/20 border border-purple-500/30 rounded-xl p-4">
                <div className="text-3xl font-bold text-purple-300 mb-2">{(() => {
                  const m = typeof window !== "undefined" ? getAll(id) : { invites: 0 };
                  return m.invites;
                })()}</div>
                <div className="text-purple-200 font-semibold">Invites</div>
                <div className="text-purple-300 text-sm">CSV uploads</div>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-orange-600/20 border border-orange-500/30 rounded-xl p-4">
                <div className="text-3xl font-bold text-orange-300 mb-2">{(() => {
                  const m = typeof window !== "undefined" ? getAll(id) : { responses: 0, invites: 0 };
                  const connectionRate = m.invites ? Math.round((m.responses / m.invites) * 100) : 0;
                  return connectionRate;
                })()}%</div>
                <div className="text-orange-200 font-semibold">Questions</div>
                <div className="text-orange-300 text-sm">In question bank</div>
              </div>
            </div>
          </div>
          {/* Navigation Links */}
          <div className="mt-6 flex gap-3 justify-center">
            <a 
              href={`/chat/${id}`} 
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 shadow-glow text-sm"
            >
              💬 Chat with your data
            </a>
            <a 
              href={`/reports/demo123?c=${id}`} 
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:from-green-700 hover:to-emerald-700 shadow-glow text-sm"
            >
              📄 Reports
            </a>
            <a 
              href={`/campaign/${id}/outbound`} 
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-medium hover:from-purple-700 hover:to-fuchsia-700 shadow-glow text-sm"
            >
              📞 Outbound (beta)
            </a>
          </div>
        </section>

        {/* Question Bank Preview */}
        <section id="questions" className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-2xl">❓</div>
            <h3 className="text-2xl font-bold text-white">Question Bank Preview</h3>
          </div>
          <p className="text-blue-200 text-sm mb-4">
            Your campaign includes these 8 technical and behavioral questions:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-600">
              <div className="text-blue-300 text-sm font-semibold mb-2">INTRO</div>
              <p className="text-white">Give me a 30s overview of your background.</p>
            </div>
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-600">
              <div className="text-green-300 text-sm font-semibold mb-2">SYSTEMS</div>
              <p className="text-white">How would you keep p95 &lt;1s in a live STT to summary pipeline?</p>
            </div>
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-600">
              <div className="text-purple-300 text-sm font-semibold mb-2">ML</div>
              <p className="text-white">ARIMA vs LSTM for time-series; when does ARIMA win?</p>
            </div>
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-600">
              <div className="text-orange-300 text-sm font-semibold mb-2">BEHAVIORAL</div>
              <p className="text-white">Walk through a time you reduced latency. Baseline, actions, result.</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-blue-200 text-sm">
              + 4 more questions covering systems design, ML, and behavioral scenarios
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
