'use client';
import React from 'react';

interface AgentPaneProps {
  currentQuestion: {
    text: string;
    category?: string;
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
      
      <div className="flex gap-3 mt-6">
        <button
          onClick={onPreviousQuestion}
          disabled={!canGoPrevious}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
            canGoPrevious
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <span>⏮️</span>
          Previous
        </button>
        
        <button
          onClick={onNextQuestion}
          disabled={!canGoNext}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
            canGoNext
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Next
          <span>⏭️</span>
        </button>
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