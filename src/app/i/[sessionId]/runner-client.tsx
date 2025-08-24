'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useSession } from '@/lib/store/session';
import { startSTT } from '@/lib/stt/webspeech';
import ControlsBar from '@/components/ControlsBar';
import AgentPane from '@/components/AgentPane';
import TranscriptPane from '@/components/TranscriptPane';
import InsightsPane from '@/components/InsightsPane';
import RagUploader from '@/components/RagUploader';
import ModeToggle, { LLMMode } from '@/components/ModeToggle';
import { generateInsight } from '@/lib/orchestrator/insight';
import type { FactDoc } from '@/lib/rag/bm25';
import VideoPublisher from '@/components/VideoPublisher';
import LanguagePicker from '@/components/LanguagePicker';
import StatusPill from '@/components/ui/StatusPill';
import { inc, addSessionMinutes } from '@/lib/metrics/local';

export default function InterviewClient() {
  // Strongly type params
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = String(params?.sessionId ?? '');

  // Safely derive URL params once
  const campaignParam = searchParams?.get('c') ?? null;

  // Session store (Day-2 shape uses `mode`/`setMode` for LLM mode)
  const {
    setCampaign,
    setLLMMode,   // LLM mode setter (local|cloud|rules)
    llmMode,      // current LLM mode
    lang,         // STT language
    // ttsVoice,     // TTS voice (used by ControlsBar directly)
    setPartial,
    pushFinal,
    rollingSummary,
    // lastAnswer,
    setInsight,
    transcript,
    started,
  } = useSession();

  const [partial, setPartialLocal] = useState('');
  const stopRef = useRef<null | (() => void)>(null);
  const sessionStartRef = useRef<number | null>(null);

  // BM25 RAG index
  const [searchIndex, setSearchIndex] =
    useState<null | ((q: string, k?: number) => FactDoc[])>(null);

  // Debounce timer for insight generation
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnippetRef = useRef<string>("");

  // Initialize campaign + (optional) interview mode (separate from LLM mode)
  useEffect(() => {
    setCampaign(campaignParam || undefined);
    // If you actually use structured/conversational elsewhere, wire it there.
    // This `setMode` is reserved for LLM mode; do NOT set it from mParam.
  }, [campaignParam, setCampaign]);

  const startMic = () => {
    if (stopRef.current) stopRef.current();
    
    // Track metrics
    if (campaignParam) {
      inc(campaignParam, "responses", 1);
      sessionStartRef.current = Date.now();
    }
    
    try {
      stopRef.current = startSTT(
        (t) => { setPartialLocal(t); setPartial(t); },
        (t, ts) => { setPartialLocal(''); pushFinal(t, ts); scheduleInsight(t); },
        lang
      );
    } catch (error) {
      console.error('STT Error:', error);
      alert('Speech recognition not available. Please use Chrome browser.');
    }
  };

  const stopMic = () => {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
      
      // Track session minutes
      if (campaignParam && sessionStartRef.current) {
        addSessionMinutes(campaignParam, Date.now() - sessionStartRef.current);
        sessionStartRef.current = null;
      }
    }
  };

  function scheduleInsight(finalText: string) {
    lastSnippetRef.current = (finalText || '').slice(-400);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(runInsight, 3000);
  }

  async function runInsight() {
    const snippet = lastSnippetRef.current;
    if (!snippet) return;

    const facts = searchIndex ? searchIndex(snippet, 3) : [];
    const turnId = `sess#${sessionId}:t${Date.now()}`;

    const { json, latency } = await generateInsight({
      mode: llmMode,        // local | cloud | rules (from store)
      turnId,
      rollingSummary,
      snippet,
      facts,
    });

    setInsight(json as any, latency);
  }

  // Calculate interview progress
  const totalQuestions = 8; // Based on question bank
  const completedQuestions = transcript.filter(t => t.final).length;
  const progressPercentage = Math.min((completedQuestions / totalQuestions) * 100, 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Enhanced Header with Progress */}
        <div className="frosted gradient-surface shadow-glow rounded-3xl p-8 animate-fade-in-up">
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] items-center gap-6">
            {/* LEFT: title + meta */}
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500
                              flex items-center justify-center text-white text-2xl transition-all duration-500 ${
                                stopRef.current 
                                  ? 'animate-pulse ring-4 ring-green-400/30 scale-110' 
                                  : 'animate-float'
                              }`}>
                {stopRef.current ? '🎙️' : '🎤'}
              </div>

              <div className="min-w-0">
                <h1 className="text-3xl font-extrabold text-white leading-tight">AI Interview Session</h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wide opacity-80">Session</span>
                    <span className="font-mono text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded">
                      {String((params as any)?.sessionId || '')}
                    </span>
                  </div>

                  {campaignParam && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wide opacity-80">Campaign</span>
                      <span className="font-mono text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded">
                        {campaignParam}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CENTER: STT/TTS + Questions Completed */}
            <div id="session-controls" className="justify-self-center w-full max-w-2xl">
              <div className="flex flex-col items-center gap-4">
                <LanguagePicker />
                
                {/* Progress Bar */}
                <div className="flex flex-col items-center gap-3">
                  <div className="text-center">
                    <div className={`text-2xl font-bold text-white mb-1 transition-all duration-500 ${
                      completedQuestions > 0 ? 'scale-105' : 'scale-100'
                    }`}>
                      {completedQuestions}/{totalQuestions}
                    </div>
                    <div className="text-blue-200 text-sm">Questions Completed</div>
                  </div>
                  <div className="w-48 progress-bar">
                    <div 
                      className={`progress-fill transition-all duration-1000 ease-out ${
                        completedQuestions > 0 ? 'animate-pulse' : ''
                      }`}
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: mode toggle + single status pill */}
            <div className="justify-self-end flex items-end gap-5 flex-wrap shrink-0">
              <div className="flex flex-col items-start leading-none">
                <div className="text-[11px] text-blue-200/80 mb-1">Mode</div>
                <ModeToggle value={llmMode as LLMMode} onChange={(m) => setLLMMode(m)} />
                {llmMode === 'local' && (
                  <div className="text-xs text-amber-300 mt-2 bg-amber-900/20 px-2 py-1 rounded-full border border-amber-500/30">
                    ⚠️ Local model may fail
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end leading-none">
                <div className="text-[11px] text-blue-200/80 mb-1">Status</div>
                <div className={`transition-all duration-500 transform ${
                  stopRef.current ? 'scale-105' : 'scale-100'
                }`}>
                  <StatusPill 
                    on={Boolean(stopRef.current)} 
                    labelOn="Recording" 
                    labelOff="Stopped" 
                    size="sm" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Controls Bar */}
        <div className="bg-gradient-to-r from-white/10 via-white/5 to-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-8 shadow-glow">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center animate-glow">
              <span className="text-white text-lg">🎮</span>
            </div>
            <h2 className="text-3xl font-bold text-white">Interview Controls</h2>
          </div>
          
          <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <ControlsBar onStartSTT={startMic} onStopSTT={stopMic} />
          </div>
          
          <div className="mt-8 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-2xl border border-blue-700/30">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-yellow-400 text-lg">💡</span>
              </div>
              <div>
                <p className="text-blue-100 text-base font-semibold mb-3">Pro Tips for Best Results</p>
                <p className="text-blue-200 text-sm leading-relaxed">
                  Use Chrome browser for optimal speech recognition. Click "Start" to begin, "Repeat" to re-ask questions, 
                  and "Next" to advance through the interview flow. Speak clearly and take your time with responses.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Interview Interface - Enhanced Layout */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left Column - Interview Core */}
          <div className="lg:col-span-4 space-y-8">
            <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <AgentPane />
            </div>
            <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <InsightsPane />
            </div>
          </div>
          
          {/* Right Column - Video & Transcript side by side */}
          <div className="lg:col-span-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Video Publisher - Enhanced Display */}
              <div className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden shadow-glow animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/10">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                    <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                    Live Video Stream
                  </h3>
                </div>
                <VideoPublisher sessionId={sessionId} />
              </div>

              {/* Transcript Pane */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <TranscriptPane partial={partial} listening={Boolean(stopRef.current)} />

              </div>

              {/* RAG Uploader - full width below on md+ */}
              <div className="md:col-span-2 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                <RagUploader onIndex={(idx) => setSearchIndex(() => idx)} />
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Interview Tips */}
        <div className="bg-gradient-to-r from-white/10 via-white/5 to-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-8 shadow-glow animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">💡</span>
            </div>
            <h3 className="text-3xl font-bold text-white">Interview Success Tips</h3>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="group bg-gradient-to-br from-green-900/20 to-emerald-900/20 p-8 rounded-2xl border border-green-700/30 hover:border-green-600/50 transition-all duration-500 hover:scale-105 card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <span className="text-white text-2xl">✅</span>
              </div>
              <h4 className="text-white font-semibold text-xl mb-4">Speak Clearly</h4>
              <p className="text-green-200 text-base leading-relaxed">Enunciate your words and maintain a steady pace for optimal transcription accuracy and AI understanding.</p>
            </div>
            
            <div className="group bg-gradient-to-br from-blue-900/20 to-indigo-900/20 p-8 rounded-2xl border border-blue-700/30 hover:border-blue-600/50 transition-all duration-500 hover:scale-105 card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <span className="text-white text-2xl">🎯</span>
              </div>
              <h4 className="text-white font-semibold text-xl mb-4">Be Specific</h4>
              <p className="text-blue-200 text-base leading-relaxed">Provide concrete examples, metrics, and real-world scenarios to demonstrate your expertise and experience.</p>
            </div>
            
            <div className="group bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-8 rounded-2xl border border-purple-700/30 hover:border-purple-600/50 transition-all duration-500 hover:scale-105 card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <span className="text-white text-2xl">⏱️</span>
              </div>
              <h4 className="text-white font-semibold text-xl mb-4">Take Your Time</h4>
              <p className="text-purple-200 text-base leading-relaxed">Don't rush your responses. Thoughtful, well-structured answers lead to better follow-up questions and insights.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
