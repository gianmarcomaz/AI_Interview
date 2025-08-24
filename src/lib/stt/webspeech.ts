type PartialCb = (t: string) => void;
type FinalCb = (t: string, ts: number) => void;

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
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

export function startSTT(onPartial: PartialCb, onFinal: FinalCb, lang = "en-US") {
  if (typeof window === 'undefined') throw new Error('client only');
  const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition; SpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition || 
             (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition;
  if (!SR) throw new Error('Browser STT not available (use Chrome).');
  const rec = new SR();
  rec.continuous = true; 
  rec.interimResults = true; 
  rec.lang = lang;
  rec.onresult = (e: SpeechRecognitionEvent) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const txt = r[0]?.transcript?.trim() ?? '';
      if (!txt) continue;
      if (r.isFinal) onFinal(txt, Date.now());
      else onPartial(txt);
    }
  };
  rec.start();
  return () => rec.stop();
}
