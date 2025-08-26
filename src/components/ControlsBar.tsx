'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from '@/lib/store/session';
import { Button } from '@/components/ui/button';

export default function ControlsBar({ 
  onStartSTT, 
  onStopSTT, 
  onResetQuestions,
  onSpeakQuestion,
  onGetCurrentQuestion,
  deviceReady = true,
  tokensUsed = 0,
  softCap = 0,
  llmMode = 'rules'
}: { 
  onStartSTT: () => void; 
  onStopSTT: () => void;
  onResetQuestions?: () => void;
  onSpeakQuestion?: (text: string) => void;
  onGetCurrentQuestion?: () => string;
  deviceReady?: boolean;
  tokensUsed?: number;
  softCap?: number;
  llmMode?: 'cloud' | 'rules';
}) {
  // Narrow selector to avoid unnecessary re-renders
  const started = useSession(s => s.started);
  const start = useSession(s => s.start);
  const stop = useSession(s => s.stop);
  const ttsVoice = useSession(s => s.ttsVoice);
  const consentAccepted = useSession(s => s.consentAccepted);
  const setConsent = useSession(s => s.setConsent);
  
  // FIXED: Get real-time token updates from session store
  const sessionTokensUsed = useSession(s => s.tokensUsed);
  const sessionSoftCap = useSession(s => s.softCap);
  const sessionLLMMode = useSession(s => s.llmMode);
  
  // Use session store values if available, fall back to props
  const currentTokensUsed = sessionTokensUsed || tokensUsed;
  const currentSoftCap = sessionSoftCap || softCap;
  const currentLLMMode = sessionLLMMode || llmMode;
  
  const [mounted, setMounted] = useState(false);
  
  // Ensure we only speak Q1 once per interview start
  const hasSpokenQ1Ref = useRef(false);
  
  // ADD: guarded start handler to speak Q1, then start STT after a short delay
  const handleStart = async () => {
    // Optional: warm up voices to avoid default fallback
    if ('speechSynthesis' in window) { try { window.speechSynthesis.getVoices(); } catch {} }

    // Start the session first
    start();

    // Speak the first question once
    if (!hasSpokenQ1Ref.current) {
      try {
        const q = onGetCurrentQuestion?.();
        if (q && q.trim()) {
          await onSpeakQuestion?.(q);
          hasSpokenQ1Ref.current = true;
        }
      } catch {}
    }

    // Start STT slightly after TTS begins to reduce overlap
    setTimeout(() => { try { onStartSTT?.(); } catch {} }, 600);
  };
  
  // Reset the Q1 speech flag when interview mode changes or when interview stops
  useEffect(() => {
    if (!started) {
      hasSpokenQ1Ref.current = false;
    }
  }, [started]);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const handleStartInterview = () => {
    // Use the new guarded start handler directly
    handleStart();
  };
  
  const handleRepeatQuestion = () => {
    if (onSpeakQuestion && onGetCurrentQuestion) {
      const currentQuestion = onGetCurrentQuestion();
      console.log('🔄 Repeating current question:', currentQuestion.substring(0, 50) + '...');
      onSpeakQuestion(currentQuestion);
    }
  };
  
  return (
    <>
      <div className="flex gap-3 items-center flex-wrap" aria-live="polite">
        {/* Consent gate */}
        {!started && (
          <label className="flex items-center gap-2 text-blue-200 text-sm">
            <input type="checkbox" checked={consentAccepted} onChange={(e)=>setConsent(e.target.checked)} aria-checked={consentAccepted} aria-label="Consent to recording and transcription" />
            I consent to recording/transcription.
          </label>
        )}
        {!started ? (
          <Button 
            onClick={handleStartInterview}
            size="lg"
            cta="success"
            shadow
            disabled={!consentAccepted || !deviceReady}
          >
            🚀 Start Interview
          </Button>
        ) : (
          <Button 
            variant="destructive" 
            onClick={() => { 
              stop(); 
              onStopSTT(); 
            }}
            size="lg"
            cta="danger"
            shadow
          >
            ⏹️ Stop Interview
          </Button>
        )}
        
        <Button 
          onClick={handleRepeatQuestion}
          variant="secondary"
          size="lg"
          cta="primary"
          shadow
          aria-label="Repeat current question"
        >
          🔄 Repeat Question
        </Button>
        
        <div className="ml-auto">
          <div className="text-center">
            <div className="text-xs text-blue-200 mb-1">Session Status</div>
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
              started 
                ? 'bg-green-600/20 border border-green-500/30 text-green-300' 
                : 'bg-slate-600/20 border border-slate-500/30 text-slate-300'
            }`}>
              {started ? '🟢 Active' : '🔴 Inactive'}
            </div>
            <div className="text-[11px] text-blue-200/70 mt-1">
              Voice: {ttsVoice ? 'Custom' : 'Default'}
            </div>
            {/* FIXED: Token count display */}
            {started && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="text-[10px] text-blue-200/60 space-x-2">
                  <span>Latency: 240ms</span>
                  <span>•</span>
                  <span>Turns: 12</span>
                  <span>•</span>
                  <span>Mode: {currentLLMMode}</span>
                  <span>•</span>
                  <span>Tokens: {currentTokensUsed}/{currentSoftCap}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
