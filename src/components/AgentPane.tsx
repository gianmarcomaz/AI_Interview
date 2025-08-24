'use client';
import { useEffect } from 'react';
import { useSession } from '@/lib/store/session';
import { speak } from '@/lib/tts/say';
import { Button } from '@/components/ui/button';

export default function AgentPane() {
  const { currentQ, next, started, finished, lang, ttsVoice } = useSession();

  // Remove auto-speak - let user control when to hear questions
  // useEffect(() => {
  //   if (!started) return;
  //   if (finished) { speak('Interview finished, thank you'); return; }
  //   speak(currentQ.text);
  // }, [currentQ.id, started, currentQ.text, finished]);
  
  const handleSpeak = () => {
    // Use the selected TTS voice and language from the session
    speak(currentQ.text, lang, ttsVoice);
  };
  
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-8 h-full shadow-glow">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
          <span className="text-2xl">🤖</span>
        </div>
        <h3 className="text-2xl font-bold text-white">Current Question</h3>
      </div>
      
      <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-600 mb-8">
        {finished ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-float">
              <span className="text-3xl">✅</span>
            </div>
            <div className="text-2xl text-green-300 font-semibold mb-3">Interview Complete!</div>
            <p className="text-green-200 text-lg">Thank you for your responses. Great job!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-blue-300 text-sm font-semibold uppercase tracking-wide bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-700/30">
                {currentQ.topic}
              </span>
              <span className="text-purple-300 text-sm font-semibold bg-purple-900/30 px-3 py-2 rounded-lg border border-purple-700/30">
                Difficulty {currentQ.difficulty}/3
              </span>
            </div>
            <div className="text-xl text-white leading-relaxed font-medium">{currentQ.text}</div>
          </div>
        )}
      </div>
      
      <div className="flex gap-4 mb-6">
        <Button 
          onClick={handleSpeak}
          className="flex-1 h-14 rounded-xl shadow-glow-hover"
          cta="primary"
          shadow
        >
          🔊 Speak Question
        </Button>
        <Button 
          variant="secondary" 
          onClick={() => next()}
          className="h-14 rounded-xl shadow-glow-hover"
          cta="slate"
          shadow
          disabled={finished}
        >
          {finished ? 'Done' : '⏭️ Next'}
        </Button>
      </div>
      
      {!finished && (
        <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-500/30">
          <div className="flex items-start gap-3">
            <span className="text-blue-400 text-lg">💡</span>
            <div>
              <p className="text-blue-200 text-sm font-semibold mb-2">Question Context</p>
              <p className="text-blue-200 text-sm leading-relaxed">
                {(() => {
                  const baseId = currentQ.id.replace(/-f+$/, '');
                  const tag = currentQ.id.endsWith('-f') ? ' (follow-up)' : '';
                  return `This is a ${currentQ.difficulty === 1 ? 'basic' : currentQ.difficulty === 2 ? 'intermediate' : 'advanced'} ${currentQ.topic} question.`;
                })()}
              </p>
              <p className="text-blue-200 text-xs mt-2 opacity-80">
                💬 Click "🔊 Speak Question" to hear this question in your selected TTS voice
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
