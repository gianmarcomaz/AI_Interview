'use client';
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/store/session";

interface LanguagePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  showSTTOnly?: boolean;
  showTTSOnly?: boolean;
  onTestVoice?: (voice: string, lang: string) => void;
}

export default function LanguagePicker({ 
  value, 
  onChange, 
  showSTTOnly = false, 
  showTTSOnly = false,
  onTestVoice
}: LanguagePickerProps) {
  const { lang, setLang, ttsVoice, setTtsVoice } = useSession();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Use props if provided, otherwise use session store
  const currentLang = value || lang;
  const currentTtsVoice = value || ttsVoice;
  const handleLangChange = onChange || setLang;
  const handleTtsVoiceChange = onChange || setTtsVoice;

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
    // Show all available voices, not just those matching STT language
    return voices
      .sort((a, b) => {
        // Sort by language first, then by name
        const langCompare = a.lang.localeCompare(b.lang);
        if (langCompare !== 0) return langCompare;
        return a.name.localeCompare(b.name);
      });
  }, [voices]);

  const testVoice = () => {
    if (onTestVoice && currentTtsVoice) {
      const selectedVoice = voices.find(v => v.voiceURI === currentTtsVoice);
      if (selectedVoice) {
        onTestVoice(selectedVoice.voiceURI, selectedVoice.lang);
      }
    } else if (onTestVoice) {
      // Test with current language if no specific voice selected
      onTestVoice('', currentLang);
    }
  };

  // If only showing STT, render just the language selector
  if (showSTTOnly) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm bg-white/5 border border-white/20 rounded-xl px-3 py-2">
        <span className="text-blue-200">Language</span>
        <select 
          className="rounded-lg bg-white/10 border border-white/20 text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          value={currentLang} 
          onChange={e => handleLangChange(e.target.value)}
        >
          {["en-US", "en-GB", "en-AU", "en-CA", "en-IN", "en-IE", "en-NZ", "en-ZA", "it-IT", "es-ES", "fr-FR", "de-DE", "pt-BR", "ja-JP", "ko-KR", "zh-CN"].map(l => (
            <option key={l} value={l} className="bg-slate-900 text-white">{l}</option>
          ))}
        </select>
      </div>
    );
  }

  // If only showing TTS, render just the voice selector with test button
  if (showTTSOnly) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm bg-white/5 border border-white/20 rounded-xl px-3 py-2">
          <span className="text-blue-200">Voice</span>
          <select 
            className="rounded-lg bg-white/10 border border-white/20 text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            value={currentTtsVoice || ""} 
            onChange={e => handleTtsVoiceChange(e.target.value || undefined)}
          >
            <option value="" className="bg-slate-900 text-white">Auto ({currentLang})</option>
            {voiceOptions.map(v => (
              <option key={v.voiceURI} value={v.voiceURI} className="bg-slate-900 text-white">
                {v.name} — {v.lang}
              </option>
            ))}
          </select>
        </div>
        {onTestVoice && (
          <button
            onClick={testVoice}
            className="w-full px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105 shadow-glow"
          >
            🔊 Test Voice
          </button>
        )}
      </div>
    );
  }

  // Default behavior: show both STT and TTS
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm bg-white/5 border border-white/20 rounded-xl px-3 py-2">
        <span className="text-blue-200">STT</span>
        <select 
          className="rounded-lg bg-white/10 border border-white/20 text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          value={currentLang} 
          onChange={e => handleLangChange(e.target.value)}
        >
          {["en-US", "en-GB", "en-AU", "en-CA", "en-IN", "en-IE", "en-NZ", "en-ZA", "it-IT", "es-ES", "fr-FR", "de-DE", "pt-BR", "ja-JP", "ko-KR", "zh-CN"].map(l => (
            <option key={l} value={l} className="bg-slate-900 text-white">{l}</option>
          ))}
        </select>
        <span className="text-blue-200 ml-2">TTS</span>
        <select 
          className="rounded-lg bg-white/10 border border-white/20 text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          value={currentTtsVoice || ""} 
          onChange={e => handleTtsVoiceChange(e.target.value || undefined)}
        >
          <option value="" className="bg-slate-900 text-white">Auto ({currentLang})</option>
          {voiceOptions.map(v => (
            <option key={v.voiceURI} value={v.voiceURI} className="bg-slate-900 text-white">
              {v.name} — {v.lang}
            </option>
          ))}
        </select>
      </div>
      {onTestVoice && (
        <button
          onClick={testVoice}
          className="w-full px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105 shadow-glow"
        >
          🔊 Test Voice
        </button>
      )}
    </div>
  );
}
