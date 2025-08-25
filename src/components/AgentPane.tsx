'use client';
import { useSession } from '@/lib/store/session';
import { speak } from '@/lib/tts/say';
import { Button } from '@/components/ui/button';

interface AgentPaneProps {
  currentQuestion: {
    id: string;
    text: string;
    category: string;
  };
  onNextQuestion: () => void;
  onPreviousQuestion: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export default function AgentPane({ 
  currentQuestion, 
  onNextQuestion, 
  onPreviousQuestion, 
  canGoNext, 
  canGoPrevious 
}: AgentPaneProps) {
  const { lang, ttsVoice } = useSession();
  
  const handleSpeak = () => {
    // Use the selected TTS voice and language from the session
    speak(currentQuestion.text, lang, ttsVoice);
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
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-blue-300 text-sm font-semibold uppercase tracking-wide bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-700/30">
              {currentQuestion.category}
            </span>
          </div>
          <div className="text-xl text-white leading-relaxed font-medium">{currentQuestion.text}</div>
        </div>
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
          onClick={onNextQuestion}
          className="h-14 rounded-xl shadow-glow-hover"
          cta="slate"
          shadow
          disabled={!canGoNext}
        >
          ⏭️ Next
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <Button 
          variant="secondary" 
          onClick={onPreviousQuestion}
          className="flex-1 h-14 rounded-xl shadow-glow-hover"
          cta="slate"
          shadow
          disabled={!canGoPrevious}
        >
          ⏮️ Previous
        </Button>
      </div>
      
      <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-500/30">
        <div className="flex items-start gap-3">
          <span className="text-blue-400 text-lg">💡</span>
          <div>
            <p className="text-blue-200 text-sm font-semibold mb-2">Question Navigation</p>
            <p className="text-blue-200 text-sm leading-relaxed">
              Use the Previous and Next buttons to navigate through the interview questions. 
              Click "🔊 Speak Question" to hear the current question in your selected TTS voice.
            </p>
            <p className="text-blue-200 text-xs mt-2 opacity-80">
              💬 Questions can be customized in the Campaign Settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
