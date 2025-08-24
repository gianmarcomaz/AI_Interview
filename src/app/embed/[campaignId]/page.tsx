'use client';
import { useParams } from 'next/navigation';
import { nanoid } from 'nanoid';

export default function EmbedPage() {
  const params = useParams();
  const campaignId = String((params as any)?.campaignId || '');
  const id = nanoid(6);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = `${origin}/i/${id}?c=${campaignId}`;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-6xl mx-auto p-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h1 className="text-lg font-semibold text-white">Embedded Interview — Campaign {campaignId}</h1>
          </div>
          <iframe 
            src={link} 
            className="w-full h-[700px]"
            title="AI Interview"
            allow="microphone"
          />
        </div>
      </main>
    </div>
  );
}
