type PartialCb = (t: string) => void;
type FinalCb = (t: string, ts: number) => void;
type SilenceCb = () => void;

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onstart: () => void;
  onend: () => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

export function startSTT(onPartial: PartialCb, onFinal: FinalCb, lang = "en-US", onSilence?: SilenceCb, silenceMs: number = 1000) {
  if (typeof window === 'undefined') throw new Error('client only');
  const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition; SpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition || 
             (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition;
  if (!SR) throw new Error('Browser STT not available (use Chrome).');
  const rec = new SR();
  rec.continuous = true; 
  rec.interimResults = true; 
  rec.lang = lang;
  
  let lastActivity = Date.now();
  let silenceTimer: number | null = null;
  let heartbeatInterval: number | null = null;
  let listening = true;

  function scheduleSilenceCheck() {
    if (!onSilence) return;
    if (silenceTimer) window.clearTimeout(silenceTimer);
    silenceTimer = window.setTimeout(() => {
      const now = Date.now();
      if (listening && now - lastActivity >= silenceMs) {
        onSilence();
      }
    }, silenceMs);
  }

  // Heartbeat mechanism for more responsive silence detection
  function startHeartbeat() {
    if (heartbeatInterval) window.clearInterval(heartbeatInterval);
    heartbeatInterval = window.setInterval(() => {
      if (listening && Date.now() - lastActivity > silenceMs) {
        if (onSilence) onSilence();
      }
    }, 250); // Check every 250ms for responsiveness
  }

  rec.onresult = (e: SpeechRecognitionEvent) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const txt = r[0]?.transcript?.trim() ?? '';
      if (!txt) continue;
      lastActivity = Date.now();
      if (r.isFinal) {
        onFinal(txt, Date.now());
      } else {
        onPartial(txt);
      }
    }
    scheduleSilenceCheck();
  };

  rec.onstart = () => {
    listening = true;
    lastActivity = Date.now();
    startHeartbeat();
  };

  rec.onend = () => {
    listening = false;
  };

  rec.start();
  return () => {
    listening = false;
    if (silenceTimer) window.clearTimeout(silenceTimer);
    if (heartbeatInterval) window.clearInterval(heartbeatInterval);
    rec.stop();
  };
}
