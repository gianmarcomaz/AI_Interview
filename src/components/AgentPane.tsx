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

  // Enhanced question text with warm, conversational tone
  const getWarmQuestionText = (question: string) => {
    const warmPrefixes = [
      "Thanks for that. ",
      "Great answer. ",
      "I appreciate that insight. ",
      "That's helpful. ",
      "Interesting perspective. "
    ];
    
    // For follow-up questions, add warm prefix
    if (question.includes('Could you') || question.includes('How did you') || question.includes('What drove')) {
      return warmPrefixes[Math.floor(Math.random() * warmPrefixes.length)] + question;
    }
    
    return question;
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-6 h-full shadow-glow">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
          <span className="text-2xl">🤖</span>
        </div>
        <h3 className="text-2xl font-bold text-white">Current Question</h3>
      </div>
      
      <div className="bg-slate-800/30 p-5 rounded-2xl border border-slate-600 mb-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-blue-300 text-sm font-semibold uppercase tracking-wide bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-700/30">
              {currentQuestion.category}
            </span>
          </div>
          <div className="text-xl text-white leading-relaxed font-medium">
            {getWarmQuestionText(currentQuestion.text)}
          </div>
        </div>
      </div>
      
      <div className="flex gap-4 mb-4">
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
      
      {/* Info section removed to keep the card compact */}
    </div>
  );
}

// Tiny helper to speak short acknowledgements right after user finishes
export function speakBackchannel() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const phrases = [
    'Got it.',
    'Thanks — let me think.',
    'Okay.',
    "I see.",
  ];
  const utter = new SpeechSynthesisUtterance(phrases[Math.floor(Math.random()*phrases.length)]);
  utter.rate = 0.95;
  utter.pitch = 1.0;
  utter.volume = 1.0;
  try { window.speechSynthesis.speak(utter); } catch {}
}