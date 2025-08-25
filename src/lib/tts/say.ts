export function speak(text: string, lang = "en-US", voiceURI?: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;

  const doSpeak = () => {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    if (voiceURI) {
      const v = synth.getVoices().find(v => v.voiceURI === voiceURI || v.name === voiceURI);
      if (v) u.voice = v;
    }
    synth.speak(u);
  };

  // Ensure voices are loaded before speaking with a custom voice
  const voices = synth.getVoices();
  const selectedExists = voiceURI ? voices.some(v => v.voiceURI === voiceURI || v.name === voiceURI) : true;
  if (voiceURI && (!voices || voices.length === 0 || !selectedExists)) {
    const handler = () => {
      synth.removeEventListener('voiceschanged', handler as any);
      doSpeak();
    };
    synth.addEventListener('voiceschanged', handler as any);
    // Trigger voices loading in some browsers
    synth.getVoices();
    return;
  }

  doSpeak();
}

export function cancelSpeak() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
}
