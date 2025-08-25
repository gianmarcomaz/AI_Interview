'use client';
import { useState, useEffect } from 'react';
import { useSession } from '@/lib/store/session';
import { speak, cancelSpeak } from '@/lib/tts/say';
import { Button } from '@/components/ui/button';

export default function ControlsBar({ 
  onStartSTT, 
  onStopSTT, 
  onResetQuestions,
  currentQuestionText
}: { 
  onStartSTT: () => void; 
  onStopSTT: () => void;
  onResetQuestions?: () => void;
  currentQuestionText: string;
}) {
  const { started, start, stop, lang, ttsVoice } = useSession();
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  
  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      // Countdown finished, start interview and speak first question
      setShowCountdown(false);
      start();
      onStartSTT();
      
      // Reset question index if function is provided
      if (onResetQuestions) {
        onResetQuestions();
      }
      
      // Small delay to ensure everything is ready, then speak
      setTimeout(() => {
        speak(currentQuestionText, lang, ttsVoice);
      }, 500);
    }
  }, [showCountdown, countdown, start, onStartSTT, currentQuestionText, lang, ttsVoice, onResetQuestions]);
  
  const handleStartInterview = () => {
    setShowCountdown(true);
    setCountdown(3);
  };
  
  return (
    <>
      {/* Countdown Overlay */}
      {showCountdown && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-8">
            {/* Countdown Number */}
            <div className="relative">
              <div className="text-9xl font-bold text-white animate-pulse">
                {countdown}
              </div>
              {/* Glowing Ring Effect */}
              <div className="absolute inset-0 rounded-full border-8 border-blue-500/30 animate-ping"></div>
              <div className="absolute inset-0 rounded-full border-8 border-purple-500/30 animate-ping" style={{ animationDelay: '0.5s' }}></div>
            </div>
            
            {/* Countdown Text */}
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-white">Get Ready!</h2>
              <p className="text-xl text-blue-200">Interview starting in...</p>
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
        </div>
      )}
      
      <div className="flex gap-4 items-center flex-wrap">
        {!started ? (
          <Button 
            onClick={handleStartInterview}
            size="xl"
            cta="success"
            shadow
            disabled={showCountdown}
          >
            {showCountdown ? '⏳ Starting...' : '🚀 Start Interview'}
          </Button>
        ) : (
          <Button 
            variant="destructive" 
            onClick={() => { 
              stop(); 
              cancelSpeak(); 
              onStopSTT(); 
            }}
            size="xl"
            cta="danger"
            shadow
          >
            ⏹️ Stop Interview
          </Button>
        )}
        
        <Button 
          onClick={() => { 
            cancelSpeak(); 
            speak(currentQuestionText, lang, ttsVoice); 
          }}
          variant="secondary"
          size="xl"
          cta="primary"
          shadow
        >
          🔄 Repeat Question
        </Button>
        
        <div className="ml-auto">
          <div className="text-center">
            <div className="text-sm text-blue-200 mb-1">Session Status</div>
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
              started 
                ? 'bg-green-600/20 border border-green-500/30 text-green-300' 
                : 'bg-slate-600/20 border border-slate-500/30 text-slate-300'
            }`}>
              {started ? '🟢 Active' : '🔴 Inactive'}
            </div>
            <div className="text-xs text-blue-200/70 mt-1">
              Voice: {ttsVoice ? 'Custom' : 'Auto'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
