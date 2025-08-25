export type PartialCb = (text: string) => void;
export type FinalCb = (text: string, timestamp: number) => void;
export type SilenceCb = () => void;

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

export function startSTT(
  onPartial: PartialCb, 
  onFinal: FinalCb, 
  lang = "en-US", 
  onSilence?: SilenceCb, 
  silenceMs: number = 900
) {
  if (typeof window === 'undefined') throw new Error('client only');
  const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition; SpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition || 
             (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition;
  if (!SR) throw new Error('Browser STT not supported (use Chrome).');
  
  const rec = new SR();
  rec.continuous = true; 
  rec.interimResults = true; 
  rec.lang = lang;
  
  let idle: number | null = null;
  let stopping = false;
  
  const bump = () => { 
    if (idle) clearTimeout(idle); 
    idle = window.setTimeout(() => safeStop(), silenceMs); 
  };
  
  const safeStop = () => {
    if (!stopping) {
      stopping = true;
      try {
        // Detach handlers to avoid spurious onerror/onend after stop
        rec.onend = null as any;
        rec.onerror = null as any;
        rec.stop();
      } catch (e) {
        console.log('STT stop error (normal):', e);
      }
    }
  };
  
  rec.onresult = (e: SpeechRecognitionEvent) => {
    // Use the latest available result for more reliable interim streaming
    const results = (e as any).results as SpeechRecognitionResultList;
    const r = results && results.length ? results[results.length - 1] : undefined;
    if (!r) return;
    const alt = r[0];
    const text = alt?.transcript ?? '';
    if (r.isFinal) {
      onFinal(text, Date.now());
    } else {
      onPartial(text);
    }
    if (idle) clearTimeout(idle);
    idle = window.setTimeout(() => {
      try { onSilence?.(); } catch {}
    }, silenceMs);
  };
  
  rec.onend = () => { 
    if (idle) clearTimeout(idle); 
    onSilence?.(); 
  };
  
  rec.onerror = (event: any) => {
    // Web Speech API error event has different structure than standard Error
    let errorMessage = 'Unknown STT error';
    let errorCode = 'unknown';
    const errorDetails: any = {};
    
    if (!event) {
      errorMessage = 'No error event received';
      errorCode = 'no-event';
    } else if (typeof event === 'object') {
      if ('error' in event && (event as any).error) {
        errorCode = String((event as any).error);
      }
      if ('message' in event && (event as any).message) {
        errorMessage = String((event as any).message);
      }
      if ('type' in event && (event as any).type && errorCode === 'unknown') {
        errorCode = String((event as any).type);
      }
      // snapshot of event keys/values for debugging; never empty
      try {
        const keys = Object.keys(event as any);
        errorDetails.keys = keys;
        errorDetails.sample = keys.slice(0,3).reduce((acc:any,k)=>{acc[k]=(event as any)[k];return acc;}, {});
        const json = JSON.stringify(event);
        if (json && json !== '{}') errorDetails.json = json.substring(0,400);
      } catch {}
    } else {
      errorMessage = String(event);
      errorCode = 'non-object';
    }
    
    // Ensure payload is never empty
    const payload = {
      errorCode,
      errorMessage,
      errorDetails: (errorDetails && Object.keys(errorDetails).length ? errorDetails : { note: 'no-structured-details' }),
      timestamp: new Date().toISOString(),
      ua: navigator.userAgent
    };
    // Benign errors happen when we rapidly start/stop (e.g., skipping questions).
    // Downgrade noise for 'aborted'/'no-speech' and similar.
    if (errorCode === 'aborted' || errorCode === 'no-speech') {
      console.warn('STT benign event:', payload);
    } else {
      console.error('STT Error Details:', payload);
    }
    
    if (idle) clearTimeout(idle);
    stopping = true;
  };
  
  rec.start();
  
  return () => { 
    rec.onend = null; 
    safeStop(); 
    if (idle) clearTimeout(idle); 
  };
}

