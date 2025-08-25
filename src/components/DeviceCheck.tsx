'use client';
import { useEffect, useRef, useState } from 'react';

interface DeviceCheckProps {
  onStatusChange?: (ready: boolean) => void;
}

export default function DeviceCheck({ onStatusChange }: DeviceCheckProps) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [level, setLevel] = useState(0);
  const [ttsTested, setTtsTested] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        streamRef.current = stream;
        setOk(true);
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0; for (let i=0;i<data.length;i++){ const v=(data[i]-128)/128; sum += v*v; }
          const rms = Math.sqrt(sum / data.length);
          setLevel(Math.min(1, rms*4));
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        setOk(false);
      }
    })();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t=>t.stop());
    };
  }, []);

  const testTTS = () => {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance("Hi, I'm your interviewer. Ready to begin?");
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
        <div className="text-white font-semibold text-lg">Device Check</div>
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
      
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}


