export function speak(text: string, lang = "en-US", voiceURI?: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  if (voiceURI) {
    const v = window.speechSynthesis.getVoices().find(v => v.voiceURI === voiceURI || v.name === voiceURI);
    if (v) u.voice = v;
  }
  window.speechSynthesis.speak(u);
}

export function cancelSpeak() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
}
