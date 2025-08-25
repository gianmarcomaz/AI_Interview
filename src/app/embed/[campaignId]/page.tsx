'use client';
import { useParams } from 'next/navigation';
import { nanoid } from 'nanoid';
import { useState, useEffect } from 'react';

export default function EmbedPage() {
  const params = useParams();
  const campaignId = String((params as any)?.campaignId || '');
  const [link, setLink] = useState('');
  
  useEffect(() => {
    const id = nanoid(6);
    const origin = window.location.origin;
    setLink(`${origin}/i/${id}?c=${campaignId}`);
  }, [campaignId]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-6xl mx-auto p-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h1 className="text-lg font-semibold text-white">Embedded Interview — Campaign {campaignId}</h1>
          </div>
          {link ? (
            <iframe 
              src={link} 
              className="w-full h-[700px]"
              title="AI Interview"
              allow="microphone"
            />
          ) : (
            <div className="flex items-center justify-center h-[700px] text-blue-200">
              Loading interview...
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
