// src/lib/audio/vad.ts
let SHARED_VAD_CTX: AudioContext | null = null;

function getVadCtx(): AudioContext {
  if (!SHARED_VAD_CTX || SHARED_VAD_CTX.state === 'closed') {
    SHARED_VAD_CTX = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return SHARED_VAD_CTX;
}

export type VADCallbacks = {
  onSpeech?: () => void;
  onSilence?: () => void;
};

export function startVAD(stream: MediaStream, cb: VADCallbacks, opts?: {
  fftSize?: number;
  frameMs?: number;
  minSpeechMs?: number;
  minSilenceMs?: number;
  energyThreshold?: number;     // 0..1 (RMS)
}) {
  const ctx = getVadCtx();
  let stopped = false;

  // (re)resume if suspended by a prior stop
  if (ctx.state === 'suspended') {
    // don't await—let it settle
    ctx.resume().catch(() => {});
  }

  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = opts?.fftSize ?? 1024;
  src.connect(an);

  const buf = new Float32Array(an.fftSize);
  const frameMs = opts?.frameMs ?? 50;

  let speaking = false;
  let lastFlipAt = performance.now();
  const minSpeechMs  = opts?.minSpeechMs  ?? 120;  // debounce start
  const minSilenceMs = opts?.minSilenceMs ?? 500;  // debounce stop
  const thr = opts?.energyThreshold ?? 0.015;      // tune per mic

  const tick = () => {
    if (stopped) return;
    
    an.getFloatTimeDomainData(buf);               // time-domain samples (−1..1)
    // RMS energy
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { const v = buf[i]; sum += v * v; }
    const rms = Math.sqrt(sum / buf.length);

    const now = performance.now();
    if (!speaking && rms > thr && (now - lastFlipAt) > minSpeechMs) {
      speaking = true; lastFlipAt = now; cb.onSpeech?.();
    } else if (speaking && rms < thr && (now - lastFlipAt) > minSilenceMs) {
      speaking = false; lastFlipAt = now; cb.onSilence?.();
    }
    raf = requestAnimationFrame(tick);
  };

  let raf = requestAnimationFrame(tick);
  
  const stop = async () => {
    if (stopped) return;
    stopped = true;

    try { cancelAnimationFrame(raf); } catch {}
    try { src.disconnect(); } catch {}
    try { an.disconnect(); } catch {}

    // Don't close the context here — it may be shared across features (beep, TTS cues, etc.)
    // Just suspend it to free CPU; only a single owner (page unmount) should hard-close.
    try {
      if (SHARED_VAD_CTX && SHARED_VAD_CTX.state === 'running') {
        await SHARED_VAD_CTX.suspend();
      }
    } catch {
      // swallow – multiple stops are fine
    }

    // Also stop tracks you started for VAD (you *own* the stream here)
    try {
      stream.getTracks().forEach(t => { try { t.stop(); } catch {} });
    } catch {}
  };

  return stop;
}

// (Optional) one place in your app (page unload) may hard close:
export async function hardCloseVadCtx() {
  if (SHARED_VAD_CTX && SHARED_VAD_CTX.state !== 'closed') {
    try { await SHARED_VAD_CTX.close(); } catch {}
    SHARED_VAD_CTX = null;
  }
}
