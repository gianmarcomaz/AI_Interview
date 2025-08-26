'use client';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/store/session';
import { startVAD } from '@/lib/audio/vad';

interface DeviceCheckProps {
  onStatusChange?: (ready: boolean) => void;
}

export default function DeviceCheck({ onStatusChange }: DeviceCheckProps) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [ttsTested, setTtsTested] = useState(false);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const vadStopRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);
  
  // Get TTS voice from session store
  const ttsVoice = useSession(s => s.ttsVoice);
  const setTtsVoice = useSession(s => s.setTtsVoice);

  // Helper function to configure TTS with consistent voice settings
  const configureTTSVoice = (utterance: SpeechSynthesisUtterance) => {
    if (ttsVoice && ttsVoice !== 'default') {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === ttsVoice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('🎤 DeviceCheck using selected TTS voice:', selectedVoice.name);
        return true;
      }
    }
    return false;
  };

  // Ensure TTS voices are loaded for consistent voice selection
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Load voices if not already loaded
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          console.log('🎤 DeviceCheck: TTS voices loaded:', window.speechSynthesis.getVoices().length);
        };
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        setOk(true);
        
        // Use VAD for microphone level detection instead of creating our own AudioContext
        const vadStop = startVAD(stream, {
          onSpeech: () => {
            // Update level when speech is detected
            setLevel(0.8);
          },
          onSilence: () => {
            // Update level when silence is detected
            setLevel(0.1);
          }
        });
        vadStopRef.current = vadStop;
        
        // Set initial level
        setLevel(0.1);
        
        rafRef.current = requestAnimationFrame(() => {
          // This frame is needed to ensure the VAD context is initialized
          // and the first audio data is processed.
          // The actual audio processing loop is handled by the VAD context.
        });
        
      } catch {
        setOk(false);
      }
    })();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t=>t.stop());
      vadStopRef.current?.();
    };
  }, []);

  const testTTS = () => {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance("Hi, I'm your interviewer. Ready to begin?");
      
      // Configure voice settings for consistency
      configureTTSVoice(utter);
      
      utter.rate = 0.9;
      utter.pitch = 1.0;
      utter.volume = 1.0;
      utter.onend = () => setTtsTested(true);
      try { 
        window.speechSynthesis.speak(utter); 
      } catch {}
    }
  };

  const allTestsPassed = ok === true && ttsTested;

  // Notify parent component of status changes
  useEffect(() => {
    onStatusChange?.(allTestsPassed);
  }, [allTestsPassed, onStatusChange]);

  return (
    <div className="p-6 rounded-2xl border border-white/20 bg-gradient-to-r from-white/5 to-white/10 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-white font-semibold text-lg">Device Check (Test your devices before the interview)</div>
        <div className={`text-sm px-3 py-1 rounded-full ${
          allTestsPassed ? 'bg-green-600/20 text-green-300 border border-green-500/30' : 
          ok === false ? 'bg-red-600/20 text-red-300 border border-red-500/30' :
          'bg-blue-600/20 text-blue-200 border border-blue-500/30'
        }`}>
          {allTestsPassed ? '✅ Ready' : ok === null ? '⏳ Testing…' : ok ? '🎤 Mic OK' : '❌ Mic/Camera blocked'}
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="text-white font-medium">Microphone Test</h4>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all" style={{ width: `${Math.round(level*100)}%` }} />
          </div>
          <p className="text-xs text-blue-200">Speak to see the meter move. We won't save this.</p>
          <div className="text-xs text-blue-200">
            Status: {ok === true ? '✅ Working' : ok === false ? '❌ Blocked' : '⏳ Testing...'}
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="text-white font-medium">Voice Test</h4>
          <button
            onClick={testTTS}
            disabled={ttsTested}
            className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              ttsTested 
                ? 'bg-green-600/20 text-green-300 border border-green-500/30 cursor-default' 
                : 'bg-blue-600/20 text-blue-200 border border-blue-500/30 hover:bg-blue-600/30'
            }`}
          >
            {ttsTested ? '✅ TTS Working' : '🔊 Test Voice'}
          </button>
          <p className="text-xs text-blue-200">
            {ttsTested ? 'Voice synthesis confirmed working' : 'Click to hear the interviewer voice'}
          </p>
        </div>
      </div>
      
      {allTestsPassed && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
          <div className="flex items-center gap-2 text-green-200 text-sm">
            <span className="text-green-400">✅</span>
            All systems ready! You can now start your interview.
          </div>
        </div>
      )}
      
    </div>
  );
}


