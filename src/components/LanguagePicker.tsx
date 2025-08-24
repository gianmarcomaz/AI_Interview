'use client';
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/store/session";

export default function LanguagePicker() {
  const { lang, setLang, ttsVoice, setTtsVoice } = useSession();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    function load() {
      setVoices(window.speechSynthesis.getVoices());
    }
    if ("speechSynthesis" in window) {
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  const voiceOptions = useMemo(() => {
    return voices
      .filter(v => !lang || v.lang.startsWith(lang.slice(0, 2)))
      .sort((a, b) => a.lang.localeCompare(b.lang));
  }, [voices, lang]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm bg-white/5 border border-white/20 rounded-xl px-3 py-2">
      <span className="text-blue-200">STT</span>
      <select 
        className="rounded-lg bg-white/10 border border-white/20 text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        value={lang} 
        onChange={e => setLang(e.target.value)}
      >
        {["en-US", "en-GB", "it-IT", "es-ES", "fr-FR", "de-DE", "pt-BR", "ja-JP", "ko-KR", "zh-CN"].map(l => (
          <option key={l} value={l} className="bg-slate-900 text-white">{l}</option>
        ))}
      </select>
      <span className="text-blue-200 ml-2">TTS</span>
      <select 
        className="rounded-lg bg-white/10 border border-white/20 text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        value={ttsVoice || ""} 
        onChange={e => setTtsVoice(e.target.value || undefined)}
      >
        <option value="" className="bg-slate-900 text-white">Auto ({lang})</option>
        {voiceOptions.map(v => (
          <option key={v.voiceURI} value={v.voiceURI} className="bg-slate-900 text-white">{v.name} — {v.lang}</option>
        ))}
      </select>
    </div>
  );
}
