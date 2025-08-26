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
  
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [mounted, setMounted] = useState(false);
  
  // Ensure we only speak Q1 once per interview start
  const hasSpokenQ1Ref = useRef(false);
  
  // Reset the Q1 speech flag when interview mode changes or when interview stops
  useEffect(() => {
    if (!started) {
      hasSpokenQ1Ref.current = false;
    }
  }, [started]);
  
  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      // Countdown finished, start interview and speak first question
      setShowCountdown(false);
      // Preload voices to avoid default-voice fallback on first utterance
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
      }
      
      // Get the first question text before starting to ensure consistency
      const firstQuestionText = onGetCurrentQuestion ? onGetCurrentQuestion() : '';
      console.log('🔍 ControlsBar: About to start interview with question:', firstQuestionText.substring(0, 100));
      
      // Create the initial question object to pass to start()
      const initialQuestion = {
        id: 'q1',
        text: firstQuestionText,
        topic: 'intro' as const,
        difficulty: 1 as const
      };
      
      start(initialQuestion);
      
      // Start STT after a short delay to avoid competing with first TTS
      setTimeout(() => onStartSTT(), 150);

      // Small delay to ensure everything is ready, then speak the first question
      setTimeout(() => {
        if (onSpeakQuestion && onGetCurrentQuestion && !hasSpokenQ1Ref.current) {
          const firstQuestion = onGetCurrentQuestion();
          console.log('🎤 ControlsBar speaking first question after countdown:', firstQuestion.substring(0, 50) + '...');
          console.log('🔍 ControlsBar: Full first question text:', firstQuestion);
          
          // Ensure we have a valid question text
          if (!firstQuestion || !firstQuestion.trim()) {
            console.error('❌ ControlsBar: No question text available from onGetCurrentQuestion');
            return;
          }
          
          // Give voices a brief moment to load before first speak
          setTimeout(() => {
            console.log('🎤 ControlsBar: Speaking first question (Q1) - this should only happen once');
            try {
              onSpeakQuestion(firstQuestion);
              hasSpokenQ1Ref.current = true;
              console.log('✅ ControlsBar: First question spoken, flag set to true');
            } catch (error) {
              console.error('❌ ControlsBar: Failed to speak first question:', error);
              hasSpokenQ1Ref.current = false; // Reset flag on error so we can retry
            }
          }, 500); // Increased delay to ensure everything is ready
        } else if (hasSpokenQ1Ref.current) {
          console.log('🔇 ControlsBar: First question already spoken, skipping');
        } else if (!onSpeakQuestion) {
          console.error('❌ ControlsBar: onSpeakQuestion function not provided');
        } else if (!onGetCurrentQuestion) {
          console.error('❌ ControlsBar: onGetCurrentQuestion function not provided');
        }
      }, 600); // Increased delay to ensure everything is ready
    }
  }, [showCountdown, countdown, start, onStartSTT]);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const handleStartInterview = () => {
    setShowCountdown(true);
    setCountdown(3);
    // Reset the Q1 speech flag for new interview
    hasSpokenQ1Ref.current = false;
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
      {/* Countdown Overlay */}
      {showCountdown && mounted && createPortal(
        <div className="fixed inset-0 w-screen h-screen bg-black/90 z-[2147483647] flex items-center justify-center select-none">
          <div className="text-center space-y-6">
            {/* Countdown Number */}
            <div className="relative">
              <div className="text-7xl font-bold text-white animate-pulse">
                {countdown}
              </div>
              {/* Glowing Ring Effect */}
              <div className="absolute inset-0 rounded-full border-8 border-blue-500/30 animate-ping"></div>
              <div className="absolute inset-0 rounded-full border-8 border-purple-500/30 animate-ping" style={{ animationDelay: '0.5s' }}></div>
            </div>
            
            {/* Countdown Text */}
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-white">Get Ready!</h2>
              <p className="text-lg text-blue-200">Interview starting in...</p>
            </div>
            
            {/* Progress Ring */}
            <div className="relative w-32 h-32 mx-auto">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * (3 - countdown)) / 3}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>,
        document.body
      )}
      
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
            aria-pressed={showCountdown}
            disabled={showCountdown || !consentAccepted || !deviceReady}
          >
            {showCountdown ? '⏳ Starting...' : '🚀 Start Interview'}
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
