'use client';
import Papa from 'papaparse';
import { nanoid } from 'nanoid';
import { useState, useEffect } from 'react';
import { setInvites } from '@/lib/metrics/local';
import { Button } from '@/components/ui/button';

interface CSVRow {
  name?: string;
  Name?: string;
  email?: string;
  Email?: string;
}

export default function CSVUpload({ campaignId, mode = 'structured' }: { campaignId: string; mode?: 'structured'|'conversational' }) {
  const [links, setLinks] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm">📁</span>
        </div>
        <h3 className="text-lg font-semibold text-white">CSV Upload → Invite Links</h3>
      </div>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <label className="text-blue-200 text-sm">Upload a .csv with name and email columns</label>
        <div className="relative">
          <input 
            type="file" 
            accept=".csv" 
            onChange={e => {
              const f = e.target.files?.[0]; 
              if (!f) return;
              Papa.parse(f, {
                header: true,
                complete: (res) => {
                  if (!origin) return; // Wait for origin to be set
                  const gen = (res.data as CSVRow[]).map(row => {
                    const id = nanoid(8);
                    const name = encodeURIComponent(row.name || row.Name || '');
                    return `${origin}/i/${id}?c=${campaignId}&m=${mode}${name ? `&name=${name}` : ''}`;
                  });
                  setLinks(gen);
                  setCopied(false);
                  // Record invite count for metrics
                  setInvites(campaignId, gen.length);
                }
              });
          }} 
            className="file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-purple-600 file:to-blue-600 file:text-white file:px-4 file:py-2 file:cursor-pointer text-white"
          />
        </div>
      </div>

      {!!links.length && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-blue-200 text-sm">Generated Links ({links.length})</div>
            <Button cta="success" shadow className="h-9 px-3"
              onClick={() => { navigator.clipboard.writeText(links.join('\n')); setCopied(true); }}
            >
              {copied ? '✅ Copied' : '📋 Copy All'}
            </Button>
          </div>
          <div className="bg-slate-800/40 border border-slate-600 rounded-lg p-3 max-h-64 overflow-y-auto custom-scrollbar">
            <ul className="space-y-2">
              {links.map((l, i) => (
                <li key={i}>
                  <a 
                    className="text-blue-300 underline break-all hover:text-blue-200" 
                    href={l} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
