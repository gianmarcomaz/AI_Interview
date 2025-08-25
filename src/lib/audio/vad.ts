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
  const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
  const src = ac.createMediaStreamSource(stream);
  const an = ac.createAnalyser();
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
  return () => { cancelAnimationFrame(raf); src.disconnect(); ac.close(); };
}
