'use client';

import { useParams } from 'next/navigation';
import Papa from 'papaparse';
import { useMemo, useState } from 'react';

type Job = { when: string; targets: number; status: 'queued' | 'done' };

export default function OutboundStub() {
  const params = useParams<{ id: string }>();
  // Normalize to a string; avoids destructuring from possibly-null params
  const id = useMemo(() => String(params?.id ?? ''), [params]);

  const [when, setWhen] = useState<string>('');
  const [targets, setTargets] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  function schedule() {
    const j: Job = { when, targets: targets.length, status: 'queued' };
    setJobs((prev) => [j, ...prev]);
  }

  if (!id) {
    // Route not ready (should be instant, but keeps TS & runtime safe)
    return (
      <main className="max-w-4xl mx-auto p-6">
        <p className="text-sm text-gray-600">Loading campaign…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="frosted gradient-surface rounded-2xl p-5 border border-white/20">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">📞 Outbound Campaign (Beta)
            <span className="font-mono text-white/90 bg-blue-900/40 px-2.5 py-1 rounded-md border border-white/10 text-sm">{id}</span>
          </h1>
          <p className="text-blue-200 text-sm mt-2">This is a non-dialing stub to demonstrate scheduling and queue management. No calls are placed.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 space-y-4">
            <h2 className="text-white font-semibold">Schedule</h2>
            <input
              type="datetime-local"
              className="rounded-lg bg-white/10 border border-white/20 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />

            <div>
              <label className="text-blue-200 text-sm mb-2 block">Upload CSV (email/phone)</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  Papa.parse(f, {
                    header: true,
                    complete: (res) => {
                      const rows = (res.data as any[])
                        .map((r) => r.email || r.phone || r.number)
                        .filter(Boolean);
                      setTargets(rows);
                    },
                  });
                }}
                className="file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-blue-600 file:text-white file:px-4 file:py-2 file:cursor-pointer text-white"
              />
              <div className="text-blue-200 text-xs mt-2">Targets: {targets.length}</div>
            </div>

            <button
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
              onClick={schedule}
              disabled={!when || targets.length === 0}
            >
              Queue Campaign
            </button>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
            <div className="text-sm text-blue-200 uppercase mb-3">Jobs</div>
            <ul className="space-y-2">
              {jobs.map((j, i) => (
                <li key={i} className="text-sm text-white/90">
                  <span className="font-mono text-white/70">{j.when || '—'}</span> — targets: {j.targets} —{' '}
                  <span className="text-amber-300">{j.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
