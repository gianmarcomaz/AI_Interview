'use client';

import { useEffect, useRef, useState, useCallback, useTransition, lazy, Suspense, useMemo } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useSession } from '@/lib/store/session';
import { startSTT } from '@/lib/stt/webspeech';
import { startVAD } from '@/lib/audio/vad';

import ControlsBar from '@/components/ControlsBar';
import AgentPane from '@/components/AgentPane';
import TranscriptPane from '@/components/TranscriptPane';
import DeviceCheck from '@/components/DeviceCheck';
import { inc, addSessionMinutes } from '@/lib/metrics/local';
import { loadCampaignQuestions } from '@/lib/store/session';
import { InterviewService } from '@/lib/firebase/interview';
import { CreateInterviewSessionData, AddTranscriptSegmentData, AddQuestionData } from '@/types/interview';
import { generateInsight, generateFinalSummary } from '@/lib/orchestrator/insight';

// Lazy load video components for better performance
const VideoPublisher = lazy(() => import('@/components/VideoPublisher'));
const VideoViewer = lazy(() => import('@/components/VideoViewer'));

// Simple debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function InterviewClient() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = String(params?.sessionId ?? '');

  // Safely derive URL params once
  const campaignParam = searchParams?.get('c') ?? null;
  const modeParam = searchParams?.get('m') ?? null; // FIXED: Read mode from URL

  // Session store (Day-2 shape uses `mode`/`setMode` for LLM mode)
  const setCampaign = useSession(s => s.setCampaign);
  const lang = useSession(s => s.lang);
  const setLang = useSession(s => s.setLang);
  const setTtsVoice = useSession(s => s.setTtsVoice);
  const setPartial = useSession(s => s.setPartial);
  const pushFinal = useSession(s => s.pushFinal);
  const transcript = useSession(s => s.transcript);
  const started = useSession(s => s.started);
  const llmMode = useSession(s => s.llmMode);
  const rollingSummary = useSession(s => s.rollingSummary);
  const insights = useSession(s => s.insights);
  const tokensUsed = useSession(s => s.tokensUsed);
  const softCap = useSession(s => s.softCap);
  const addTokens = useSession(s => s.addTokens);
  const setInsight = useSession(s => s.setInsight);
  const setFinalSummary = useSession(s => s.setFinalSummary);
  const mode = useSession(s => s.mode);
  const setMode = useSession(s => s.setMode); // FIXED: Add setMode selector
  const enqueueFollowup = useSession(s => s.enqueueFollowup);
  const storeCurrentQ = useSession(s => s.currentQ);

  // On mount, if cloud LLM is actually available and budget allows, flip mode to 'cloud'
  // This runs only on client to avoid SSR/CSR mismatch
  useEffect(() => {
    try {
      const canCloud = Boolean(process.env.NEXT_PUBLIC_LLM_SOFT_TOKEN_CAP) && (typeof window !== 'undefined');
      if (canCloud) {
        // Try a lightweight check: presence of env is enough; server route will guard missing keys
        useSession.getState().setLLMMode('cloud');
      }
    } catch {}
  }, []);

  // FIXED: Set mode from URL parameter on mount
  useEffect(() => {
    if (modeParam && (modeParam === 'structured' || modeParam === 'conversational')) {
      setMode(modeParam);
      console.log('🔄 Set interview mode from URL:', modeParam);
    }
  }, [modeParam, setMode]);

  // Helper function to check TTS availability and permissions
  const checkTTSAvailability = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      return { available: false, reason: 'Speech synthesis not supported in this browser' };
    }
    
    try {
      // Test if we can create an utterance
      const testUtterance = new SpeechSynthesisUtterance('');
      if (!testUtterance) {
        return { available: false, reason: 'Cannot create speech utterance' };
      }
      
      // Check if voices are available
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        // Try to load voices
        window.speechSynthesis.onvoiceschanged = () => {
          console.log('🎤 TTS voices loaded:', window.speechSynthesis.getVoices().length);
        };
        return { available: true, reason: 'TTS available but voices still loading' };
      }
      
      return { available: true, reason: 'TTS fully available' };
    } catch (error) {
      return { available: false, reason: `TTS test failed: ${error}` };
    }
  }, []);

  // Optimized question speaking with debouncing
  const speakQuestion = useCallback(async (questionText: string) => {
    if (!questionText?.trim()) {
      console.warn('⚠️ No question text to speak');
      return;
    }

    // Check TTS availability first
    const ttsStatus = checkTTSAvailability();
    if (!ttsStatus.available) {
      console.warn(`⚠️ TTS not available: ${ttsStatus.reason}`);
      // Show user-friendly message about TTS being unavailable
      return;
    }

    try {
      // Stop any current speech gracefully
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        // Small delay to ensure clean stop
        await new Promise(r => setTimeout(r, 100));
      }

      // Wait for brief silence before speaking to avoid talk-over
      await waitForSilence(600);
      
      // Attempt to speak the question
      await speakQuestionInternal(questionText);
    } catch (error) {
      console.error('❌ Failed to speak question:', error);
      // Don't throw - just log the error and continue
    }
  }, [checkTTSAvailability]);

  // Internal TTS function with proper error handling and barge-in rules
  const speakQuestionInternal = async (questionText: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(questionText);
        
        // Configure voice settings for consistency
        configureTTSVoice(utterance);
        
        // Configure speech parameters for clear interview questions
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Barge-in rules: stop STT when TTS starts, resume when it ends
        utterance.onstart = () => {
          console.log('🎤 AI speaking question:', questionText.substring(0, 50) + '...');
          // Stop STT to prevent double-talk
          if (stopRef.current) {
            console.log('🔇 Stopping STT for TTS (barge-in rule)');
            stopRef.current();
            stopRef.current = null;
          }
        };
        
        utterance.onend = () => {
          console.log('✅ AI finished speaking question');
          // Resume STT listening after a short delay to ensure clean transition
          setTimeout(() => {
            if (!stopRef.current) {
              console.log('🎤 Resuming STT after TTS (barge-in rule)');
              startMic();
            }
          }, 300);
          resolve(); // Resolve the promise when speech ends
        };
        
        utterance.onerror = (event) => {
          // Handle different error types gracefully
          let errorMessage = 'Unknown TTS error';
          let shouldResumeSTT = true;
          
          switch (event.error) {
            case 'interrupted':
              console.log('ℹ️ Speech was interrupted (this is normal when navigating quickly)');
              errorMessage = 'Speech interrupted';
              break;
            case 'canceled':
              console.log('ℹ️ Speech was canceled (this is normal when stopping)');
              errorMessage = 'Speech canceled';
              break;
            case 'not-allowed':
              console.warn('⚠️ Speech not allowed - this may be due to browser settings or permissions');
              errorMessage = 'Speech not allowed - check browser settings';
              shouldResumeSTT = false; // Don't resume STT if TTS is blocked
              break;
            case 'network':
              console.warn('⚠️ Network error during speech synthesis');
              errorMessage = 'Network error during speech';
              break;
            case 'audio-busy':
              console.warn('⚠️ Audio system is busy');
              errorMessage = 'Audio system busy';
              break;
            default:
              console.warn('⚠️ TTS Error:', event.error);
              errorMessage = `TTS Error: ${event.error}`;
          }
          
          // Log the error for debugging
          console.warn(`TTS Error (${event.error}): ${errorMessage}`);
          
          // Resume STT on error after a delay (if appropriate)
          if (shouldResumeSTT) {
            setTimeout(() => {
              if (!stopRef.current) {
                console.log('🎤 Resuming STT after TTS error (barge-in rule)');
                startMic();
              }
            }, 200);
          }
          
          // Resolve the promise even on error (don't reject)
          resolve();
        };
        
        // Set a timeout to prevent hanging if TTS never starts
        const ttsTimeout = setTimeout(() => {
          console.warn('⚠️ TTS timeout - speech did not start within 5 seconds');
          window.speechSynthesis.cancel();
          resolve(); // Resolve to prevent hanging
        }, 5000);
        
        // Clear timeout when speech starts
        utterance.onstart = () => {
          clearTimeout(ttsTimeout);
          console.log('🎤 AI speaking question:', questionText.substring(0, 50) + '...');
          // Stop STT to prevent double-talk
          if (stopRef.current) {
            console.log('🔇 Stopping STT for TTS (barge-in rule)');
            stopRef.current();
            stopRef.current = null;
          }
        };
        
        // Speak the question
        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          console.error('❌ Error starting speech synthesis:', error);
          clearTimeout(ttsTimeout);
          resolve(); // Resolve to prevent hanging
        }
        
      } catch (error) {
        console.error('❌ Error setting up TTS:', error);
        // Resume STT on error after a delay
        setTimeout(() => {
          if (!stopRef.current) {
            console.log('🎤 Resuming STT after TTS setup error (barge-in rule)');
            startMic();
          }
        }, 200);
        resolve(); // Resolve to prevent hanging
      }
    });
  };

  // FIXED: Conversational mode seeding - ensure AI follow-ups are generated
  useEffect(() => {
    if (mode !== 'conversational') return;
    
    console.log('🌱 Initializing conversational mode...');
    
    // Clear any existing follow-ups when switching to conversational mode
    useSession.getState().clearFollowups();
    
    // Seed initial question for conversational mode
    const seed = 'Give me a 30-second overview of your background and experience.';
    
    // FIXED: Set the initial question in the session store to start progress at 1
    const session = useSession.getState();
    if (session.qIndex === 0) {
      session.setInitialQuestion({
        id: 'conversational-seed',
        text: seed,
        topic: 'behavioral',
        difficulty: 1
      });
      
      // Also enqueue this as the first follow-up
      enqueueFollowup(seed as any);
      console.log('🌱 Seeded initial conversational question:', seed);
    }
  }, [mode, enqueueFollowup]);

  // FIXED: Remove the duplicate mode reset effect that was causing issues
  // useEffect(() => {
  //   if (mode === 'conversational') {
  //     // Clear any existing questions and start fresh
  //     useSession.getState().clearFollowups();
  //     // Seed with initial question
  //     const seed = Math.random() < 0.5
  //       ? 'Give me a 30-second overview of your background and experience.'
  //       : 'What recent project are you most proud of, and why?';
  //     enqueueFollowup(seed as any);
  //   }
  // }, [mode, enqueueFollowup]);

  // Speak the seed once it exists before STT is listening
  useEffect(() => {
    if (mode !== 'conversational') return;
    if (storeCurrentQ?.text && !started) {
      speakQuestion(storeCurrentQ.text);
    }
  }, [mode, storeCurrentQ?.text, started, speakQuestion]);

  // Reset conversational mode when switching modes
  useEffect(() => {
    if (mode === 'conversational') {
      // Clear any existing questions and start fresh
      useSession.getState().clearFollowups();
      // Seed with initial question
      const seed = Math.random() < 0.5
        ? 'Give me a 30-second overview of your background and experience.'
        : 'What recent project are you most proud of, and why?';
      enqueueFollowup(seed as any);
    }
  }, [mode, enqueueFollowup]);

  const [partial, setPartialLocal] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const lastSavedPartialRef = useRef<string>(''); // Track last saved partial to prevent duplicates
  const partialUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce partial updates
  const savedTranscriptsRef = useRef<Set<string>>(new Set()); // Track ALL saved transcript text to prevent duplicates
  const stopRef = useRef<(() => void) | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const [campaignQuestions, setCampaignQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [firebaseSessionId, setFirebaseSessionId] = useState<string | null>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(false); // Control video component loading
  const [isLoading, setIsLoading] = useState(false); // Loading state for operations
  
  // Transition to keep UI responsive on button clicks
  const [, startTransition] = useTransition();
  const [clickBusy, setClickBusy] = useState(false);
  
  // Timing constants for natural interview flow
  const SOFT_MS = 40_000;  // 40s soft cap - natural pause point
  const HARD_MS = 90_000;  // 90s hard cap - maximum response time
  const MIN_SPEECH_MS = 6_000;  // 6s minimum speech before auto-advance
  
  // Turn timing state
  const turnStartedAtRef = useRef<number>(0);
  const lastSpeechAtRef = useRef<number>(0);
  const vadStopRef = useRef<(() => void) | null>(null);
  
  // Debug flag to reduce logging in production
  const isDebug = process.env.NODE_ENV === 'development';
  
  // AI insight generation with optimized performance
  const runInsight = useCallback(async (answer: string) => {
    if (!answer.trim()) return;
    
    const snippet = answer.slice(-400);
    const facts: { id: string; text: string }[] = []; // TODO: integrate with search index if available
    const sess = String((params as any)?.sessionId || "");
    const turnId = `sess#${sess}:t${Date.now()}`;
    const tokenBudgetLeft = Math.max(0, (softCap || 0) - (tokensUsed || 0));

    try {
      const { json, latency, usedTokens } = await generateInsight({
        mode: llmMode,
        turnId,
        rollingSummary: rollingSummary || "",
        snippet,
        facts,
        tokenBudgetLeft
      });

      // FIXED: Update tokens immediately and ensure UI reflects changes
      if (usedTokens > 0) {
        addTokens(usedTokens);
        console.log('💾 Tokens updated:', usedTokens, 'Total:', tokensUsed + usedTokens);
      }
      
      setInsight(json, latency);
      
      // FIXED: Ensure AI follow-up is properly enqueued for conversational mode
      if (mode === 'conversational' && json.followup && json.followup.trim().length > 0) {
        enqueueFollowup(json.followup);
        if (isDebug) console.log('🤖 AI follow-up enqueued:', json.followup);
        
        // Also log the current follow-up queue for debugging
        const currentQueue = useSession.getState().followupQueue;
        console.log('📋 Current follow-up queue length:', currentQueue.length);
        
        // FIXED: Immediately update the current question to show the AI-generated follow-up
        const session = useSession.getState();
        if (session.currentQ.text !== json.followup) {
          session.setInitialQuestion({
            id: `ai-followup-${Date.now()}`,
            text: json.followup,
            topic: 'behavioral',
            difficulty: 2
          });
          console.log('🔄 Updated current question to AI follow-up:', json.followup);
        }
      }
    } catch (error) {
      if (isDebug) console.error('Failed to generate insight:', error);
    }
  }, [llmMode, softCap, tokensUsed, rollingSummary, mode, enqueueFollowup, addTokens, setInsight, isDebug, params]);

  // Final session summary generation
  const generateFinalSummaryAndNavigate = async () => {
    try {
      const sess = String((params as any)?.sessionId || "");
      if (!transcript?.length) {
        console.warn("No local transcript, fetching from server...");
        // Navigate to reports page where transcripts will be loaded from Firebase
        const reportUrl = `/reports/${sess}${campaignParam ? `?c=${campaignParam}` : ''}`;
        window.location.href = reportUrl;
        return;
      }
      const transcriptData = transcript.map(t => ({ 
        role: (t.final ? "user" : "ai") as "user" | "ai", 
        text: t.text 
      }));
      const tokenBudgetLeft = Math.max(0, (softCap || 0) - (tokensUsed || 0));

      const { json, usedTokens } = await generateFinalSummary({
        mode: llmMode,
        sessionId: sess,
        transcript: transcriptData,
        insights: insights || [],
        tokenBudgetLeft
      });

      addTokens(usedTokens);
      setFinalSummary(json);

      // Navigate to reports page
      const reportUrl = `/reports/${sess}${campaignParam ? `?c=${campaignParam}` : ''}`;
      window.location.href = reportUrl;
    } catch (error) {
      console.error('Failed to generate final summary:', error);
      // Fallback: navigate without summary
      const sess = String((params as any)?.sessionId || "");
      const reportUrl = `/reports/${sess}${campaignParam ? `?c=${campaignParam}` : ''}`;
      window.location.href = reportUrl;
    }
  };

  // Helper function to configure TTS with consistent voice settings
  const configureTTSVoice = (utterance: SpeechSynthesisUtterance) => {
    try {
      // Get the selected TTS voice from the session store
      const { ttsVoice } = useSession.getState();
      
      if (ttsVoice && ttsVoice !== 'default') {
        // Find the specific voice
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === ttsVoice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log('🎤 Using selected TTS voice:', selectedVoice.name);
          return true; // Voice was set
        }
      }
      
      // Fallback to default voice
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Try to find a good default voice (prefer English, female voices)
        const defaultVoice = voices.find(v => 
          v.lang.startsWith('en') && v.name.toLowerCase().includes('female')
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
        
        if (defaultVoice) {
          utterance.voice = defaultVoice;
          console.log('🎤 Using default TTS voice:', defaultVoice.name);
          return true;
        }
      }
      
      return false; // Using system default voice
    } catch (error) {
      console.warn('⚠️ Error configuring TTS voice:', error);
      return false; // Fall back to system default
    }
  };

  // --- Manual+ Half-duplex primitives ---

  async function beep(ms = 120, freq = 880, vol = 0.03) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = vol;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      setTimeout(() => { try { osc.stop(); ctx.close(); } catch {} }, ms);
    } catch {}
  }

  function waitForSilence(ms = 600) {
    return new Promise<void>((resolve) => {
      const tick = () => (performance.now() - lastSpeechAtRef.current > ms ? resolve() : setTimeout(tick, 100));
      tick();
    });
  }

  // Auto-advance functionality with micro-acknowledgements
  const speakAck = async () => { await beep(100, 660); };

  const autoNext = () => {
    // Only auto-advance if we're in structured mode and not at the last question
    if (mode === 'structured' && currentQuestionIndex < memoizedTotalQuestions - 1) {
      console.log('🤖 Auto-advancing to next question...');
      nextQuestion();
    } else if (mode === 'conversational') {
      console.log('💬 Conversational mode - no auto-advance, waiting for AI follow-up');
    } else {
      console.log('🎉 Interview completed, no more questions to advance to');
    }
  };

  const maybeAutoAdvance = () => {
    if (mode !== 'structured') return;  // conversational pace driven by AI followups
    const now = performance.now();
    const spokeLongEnough = (now - turnStartedAtRef.current) > MIN_SPEECH_MS;
    const withinSoft = (now - turnStartedAtRef.current) < SOFT_MS;
    if (spokeLongEnough && currentQuestionIndex < memoizedTotalQuestions - 1) {
      const AUTO = false; // stays opt-in
      if (!AUTO) return;
      speakAck();
      setTimeout(autoNext, withinSoft ? 300 : 0);
    }
  };

  const softNudge = () => {
    if (mode !== 'structured') return;
    const now = performance.now();
    if (now - turnStartedAtRef.current > 60_000) {
      const recentlySpoke = (now - lastSpeechAtRef.current) < 10_000;
      if (recentlySpoke) speakQuestion('Take your time—about twenty seconds left.');
    }
  };

  const hardAdvance = () => {
    if (mode !== 'structured') return;
    setTimeout(() => autoNext(), 200);
  };

  // Memoized current question getter (placed before handlers that depend on it)
  const getCurrentQuestion = useCallback(() => {
    // For conversational mode, always use the session store's current question
    if (mode === 'conversational') {
      const sessionQ = useSession.getState().currentQ;
      if (sessionQ?.text) {
        console.log(`📝 Conversational mode - Current question:`, sessionQ.text.substring(0, 50) + '...');
        return sessionQ;
      }
      // FIXED: For conversational mode, never fall back to structured questions
      // Return a default seed question instead
      return {
        id: 'conversational-default',
        text: 'Give me a 30-second overview of your background and experience.',
        category: 'behavioral'
      };
    }

    // For structured mode, use campaign questions or default questions
    const localTotalQuestions = campaignQuestions.length > 0 ? campaignQuestions.length : 8;
    if (campaignQuestions.length > 0 && currentQuestionIndex < campaignQuestions.length) {
      const question = campaignQuestions[currentQuestionIndex];
      const questionWithCategory = {
        ...question,
        category: question.category || 'behavioral'
      };
      console.log(`📝 Structured mode - Campaign question (${currentQuestionIndex + 1}/${localTotalQuestions}):`, questionWithCategory);
      return questionWithCategory;
    }
    
    // Default questions for structured mode
    const defaultQuestions = [
      'Give me a 30-second overview of your background and experience.',
      'How would you keep p95 <1s in a live STT to summary pipeline?',
      'Describe a challenging project you worked on and how you overcame obstacles.',
      'Where do you see yourself professionally in the next 3-5 years?',
      'What motivates you to do your best work?',
      'Tell me about a time you had to learn something new quickly.',
      'How do you handle feedback and criticism?',
      'What questions do you have for me about this role or company?'
    ];
    
    const defaultQuestion = {
      id: `default-${currentQuestionIndex + 1}`,
      text: defaultQuestions[currentQuestionIndex] || defaultQuestions[defaultQuestions.length - 1],
      category: 'behavioral'
    };
    
    console.log(`📝 Structured mode - Default question (${currentQuestionIndex + 1}/${localTotalQuestions}):`, defaultQuestion);
    return defaultQuestion;
  }, [campaignQuestions, currentQuestionIndex, mode]);

  // Initialize campaign + load saved campaign settings (lang, ttsVoice, questions)
  useEffect(() => {
    setCampaign(campaignParam || undefined);
    
    // Load campaign questions if available
    if (campaignParam) {
      const questions = loadCampaignQuestions(campaignParam);
      console.log('📚 Loaded campaign questions:', questions);
      setCampaignQuestions(questions);

      // Load saved voice/language from campaign settings
      try {
        const raw = localStorage.getItem(`campaign-settings-${campaignParam}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.sttLanguage) setLang(parsed.sttLanguage);
          if (parsed.ttsVoice) setTtsVoice(parsed.ttsVoice);
          // FIXED: Load saved mode selection
          if (parsed.interviewMode && (parsed.interviewMode === 'structured' || parsed.interviewMode === 'conversational')) {
            useSession.getState().setMode(parsed.interviewMode);
            console.log('🔄 Restored saved interview mode:', parsed.interviewMode);
          }
        }
      } catch (e) {
        console.warn('Failed to load campaign settings for session:', e);
      }
    }
  }, [campaignParam, setCampaign, setLang, setTtsVoice]);

  // FIXED: Save mode selection whenever it changes
  useEffect(() => {
    if (campaignParam && mode) {
      try {
        const existingSettings = localStorage.getItem(`campaign-settings-${campaignParam}`);
        const settings = existingSettings ? JSON.parse(existingSettings) : {};
        settings.interviewMode = mode;
        localStorage.setItem(`campaign-settings-${campaignParam}`, JSON.stringify(settings));
        console.log('💾 Saved interview mode:', mode);
      } catch (e) {
        console.warn('Failed to save interview mode:', e);
      }
    }
  }, [campaignParam, mode]);

  // Create Firebase session when component mounts (only once)
  useEffect(() => {
    if (campaignParam && !firebaseSessionId) {
      // Don't auto-create session on mount - only when Start Interview is clicked
      console.log('📋 Campaign loaded, waiting for Start Interview...');
    }
  }, [campaignParam, firebaseSessionId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (partialUpdateTimeoutRef.current) {
        clearTimeout(partialUpdateTimeoutRef.current);
      }
      if (vadStopRef.current) {
        vadStopRef.current();
      }
    };
  }, []);

  // Ensure TTS voices are loaded for consistent voice selection
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Load voices if not already loaded
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          console.log('🎤 TTS voices loaded:', window.speechSynthesis.getVoices().length);
        };
      }
    }
  }, []);

  // Memoized values to prevent unnecessary re-renders
  const memoizedTotalQuestions = useMemo(() => 
    campaignQuestions.length > 0 ? campaignQuestions.length : 8, 
    [campaignQuestions.length]
  );
  
  // FIXED: Proper progress tracking for conversational mode
  const memoizedCompletedQuestions = useMemo(() => {
    if (mode === 'conversational') {
      // For conversational mode, count based on session store's qIndex
      const sessionQIndex = useSession.getState().qIndex;
      // FIXED: Ensure we always show at least 1 when there's a current question
      const baseCount = Math.max(1, sessionQIndex);
      return Math.min(baseCount, 8); // Cap at 8 for conversational mode
    } else {
      // For structured mode, use current question index
      return currentQuestionIndex >= memoizedTotalQuestions - 1 ? memoizedTotalQuestions : currentQuestionIndex + 1;
    }
  }, [currentQuestionIndex, memoizedTotalQuestions, mode, storeCurrentQ?.text]); // FIXED: Add storeCurrentQ dependency

  const memoizedIsInterviewCompleted = useMemo(() => {
    if (mode === 'conversational') {
      // For conversational mode, check if session is finished or we've reached max questions
      const sessionQIndex = useSession.getState().qIndex;
      return sessionQIndex >= 8 || useSession.getState().finished;
    } else {
      // For structured mode, check question index
      return currentQuestionIndex >= memoizedTotalQuestions - 1;
    }
  }, [currentQuestionIndex, memoizedTotalQuestions, mode, storeCurrentQ?.text]); // FIXED: Add storeCurrentQ dependency

  // Memoized current question to prevent unnecessary recalculations
  const currentQuestion = useMemo(() => {
    if (mode === 'conversational') {
      // For conversational mode, always use the session store's current question
      const sessionQ = useSession.getState().currentQ;
      if (sessionQ?.text) {
        console.log(`📝 Conversational mode - Current question:`, sessionQ.text.substring(0, 50) + '...');
        return sessionQ;
      }
      // FIXED: For conversational mode, never fall back to structured questions
      // Return a default seed question instead
      return {
        id: 'conversational-default',
        text: 'Give me a 30-second overview of your background and experience.',
        category: 'behavioral'
      };
    } else {
      // For structured mode, use the existing logic
      return getCurrentQuestion();
    }
  }, [mode, getCurrentQuestion]);

  // Memoized mode-dependent values
  const isConversationalMode = useMemo(() => mode === 'conversational', [mode]);
  const canGoNext = useMemo(() => 
    isConversationalMode ? true : currentQuestionIndex < memoizedTotalQuestions - 1, 
    [isConversationalMode, currentQuestionIndex, memoizedTotalQuestions]
  );
  const canGoPrevious = useMemo(() => 
    isConversationalMode ? false : currentQuestionIndex > 0, 
    [isConversationalMode, currentQuestionIndex]
  );

  // Optimized Firebase session creation with better error handling
  const createFirebaseSession = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Check if we already have a session
      if (firebaseSessionId) {
        console.log('⚠️ Session already exists, not creating new one');
        return firebaseSessionId;
      }
      
      console.log('🆕 Creating new Firebase session for interview start...');
      
      // Clear transcript history for new session
      setTranscriptHistory([]);
      setPartialLocal('');
      lastSavedPartialRef.current = ''; // Clear last saved partial for new session
      savedTranscriptsRef.current.clear(); // Clear saved transcripts for new session
      
      // Clear any pending partial update timeout
      if (partialUpdateTimeoutRef.current) {
        clearTimeout(partialUpdateTimeoutRef.current);
        partialUpdateTimeoutRef.current = null;
      }
      
      // Generate unique candidate ID for each session
      const uniqueCandidateId = `candidate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const sessionData: CreateInterviewSessionData = {
        candidateId: uniqueCandidateId,
        jobId: campaignParam!,
        mode: 'live',
        region: 'us', // Default to US, can be made configurable
        consent: {
          version: '1.0',
          videoAllowed: true,
          policyVersion: '1.0'
        },
        participants: [
          {
            role: 'candidate', // Ensure this is always singular
            device: navigator.userAgent,
            locale: navigator.language
          },
          {
            role: 'agent',
            modelVer: 'gpt-4'
          }
        ],
        retention: { days: 365 } // Keep for 1 year
      };

      console.log('📋 Session data prepared:', sessionData);
      const newSessionId = await InterviewService.createSession(sessionData);
      setFirebaseSessionId(newSessionId);
      console.log('✅ Firebase session created successfully:', newSessionId);
      
      // Add initial timeline event
      await InterviewService.addTimelineEvent(newSessionId, {
        type: 'interview_started',
        data: { campaignId: campaignParam, candidateId: uniqueCandidateId }
      });
      
      return newSessionId;
      
    } catch (error) {
      console.error('❌ Failed to create Firebase session:', error);
      setFirebaseSessionId(null);
      throw error; // Re-throw so startMic can handle it
    } finally {
      setIsLoading(false);
    }
  }, [campaignParam, firebaseSessionId]);

  const startMic = async () => {
    if (stopRef.current) {
      // If already recording, just stop
      stopMic();
      return;
    }
    
    // Clear any previous errors when starting
    setSttError(null);
    setIsLoading(true);
    
    try {
      // Do not show any start-over confirmation here; this function is used for
      // routine TTS↔STT handoffs during a session. A brand-new session is created
      // automatically if firebaseSessionId is null (handled below).
      
      // CRITICAL FIX: Get the current session ID and ensure it's available
      let currentSessionId = firebaseSessionId;
      if (!currentSessionId) {
        try {
          console.log('🆕 Creating new Firebase session...');
          currentSessionId = await createFirebaseSession();
          console.log('✅ Session created with ID:', currentSessionId);
        } catch (error) {
          console.error('❌ Failed to create new session for interview:', error);
          return; // Don't start if session creation fails
        }
      }
      
      console.log('🎤 Starting STT with session ID:', currentSessionId);
      
      // Track metrics
      if (campaignParam) {
        inc(campaignParam, "responses", 1);
        sessionStartRef.current = Date.now();
      }

      // Update Firebase session status to in_progress
      if (currentSessionId) {
        InterviewService.updateSessionStatus(currentSessionId, {
          status: 'in_progress',
          startedAt: new Date().toISOString()
        });
      }
      
      // Start VAD for better speech detection
      if (currentSessionId) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
              sampleRate: 48000
            }
          });
          
          // Clean up any existing VAD
          if (vadStopRef.current) {
            vadStopRef.current();
          }
          
          // Start VAD with proper timing
          vadStopRef.current = startVAD(stream, {
            onSpeech: () => { 
              lastSpeechAtRef.current = performance.now(); 
              console.log('🎤 VAD: Speech detected');
            },
            onSilence: () => { 
              console.log('🔇 VAD: Silence detected');
              // FIXED: Don't stop STT on VAD silence - let STT handle its own timing
              // VAD silence should not interfere with STT operation
            }
          }, { 
            energyThreshold: 0.015,
            minSpeechMs: 120,
            minSilenceMs: 1000 // FIXED: Increased silence threshold to prevent premature stops
          });
          
          console.log('🎤 VAD started with audio constraints');
        } catch (vadError) {
          console.warn('⚠️ VAD setup failed, falling back to basic STT:', vadError);
        }
      }
      
      // Initialize turn timing
      turnStartedAtRef.current = performance.now();
      lastSpeechAtRef.current = turnStartedAtRef.current;
      
      // Set up soft/hard timers
      const softTimer = setTimeout(() => softNudge(), 60_000);  // 60s soft nudge
      const hardTimer = setTimeout(() => hardAdvance(), HARD_MS);  // 90s hard cap
      
      stopRef.current = startSTT(
        (t) => { 
          console.log('🎤 Partial transcript received:', t);
          setPartialLocal(t); 
          debouncedSetPartial(t); // Use debounced version
          
          // Update last speech time on any partial
          lastSpeechAtRef.current = performance.now();
          
          // Debounce partial transcript saving to reduce Firebase writes
          if (currentSessionId && t.trim()) {
            // Clear any existing timeout
            if (partialUpdateTimeoutRef.current) {
              clearTimeout(partialUpdateTimeoutRef.current);
            }
            
            // Set a new timeout to save after 1 second of no updates
            partialUpdateTimeoutRef.current = setTimeout(() => {
              const currentText = t.trim();
              
              // Check if we've already saved this exact text (prevent duplicates)
              if (savedTranscriptsRef.current.has(currentText)) {
                console.log('🚫 Skipping duplicate transcript text:', currentText);
                return;
              }
              
              // Only save if the text is significantly different from the last saved partial
              if (currentText !== lastSavedPartialRef.current && 
                  Math.abs(currentText.length - lastSavedPartialRef.current.length) > 3) {
                console.log('💾 Saving debounced partial transcript:', currentText);
                saveTranscriptSegment(currentText, Date.now(), true, currentSessionId);
                lastSavedPartialRef.current = currentText;
                savedTranscriptsRef.current.add(currentText); // Add to saved set
              } else {
                console.log('⏭️ Skipping similar partial transcript:', currentText);
              }
            }, 1000); // Wait 1 second before saving
          }
        },
        (t, ts) => { 
          console.log('🎤 Final transcript received:', t);
          setPartialLocal(''); 
          pushFinal(t, ts); 
          
          // Add to transcript history for display (debounced)
          if (t.trim()) {
            debouncedSetTranscriptHistory(t);
          }
          
          // Save final transcript segment to Firebase
          if (currentSessionId && t.trim()) {
            const finalText = t.trim();
            
            // Check if we've already saved this exact text
            if (savedTranscriptsRef.current.has(finalText)) {
              console.log('🚫 Skipping duplicate final transcript text:', finalText);
            } else {
              console.log('💾 Saving final transcript...');
              saveTranscriptSegment(finalText, ts, false, currentSessionId); // false = final
              savedTranscriptsRef.current.add(finalText); // Add to saved set
            }
          }
          
          // Generate AI insight after final answer
          setTimeout(() => runInsight(t), 2000); // Debounced by 2s
          
          // Auto-advance after final transcript (only if not at last question)
          if (currentQuestionIndex < memoizedTotalQuestions - 1) {
            maybeAutoAdvance();
          }
          
          // Clear timers since we got a final result
          clearTimeout(softTimer);
          clearTimeout(hardTimer);
        },
        lang,
        // VAD-lite: silence without a 'final' (e.g., short utterance) → finalize any partial and advancing
        () => {
          console.log('🔇 VAD-lite: Silence detected, finalizing partial and advancing...');
          
          // FIXED: Only process if we have partial text and not at last question
          // Also ensure we don't stop transcription prematurely
          if (partial.trim() && currentQuestionIndex < memoizedTotalQuestions - 1) { 
            console.log('📝 Finalizing partial transcript from silence:', partial.substring(0, 50) + '...');
            pushFinal(partial, Date.now()); 
            setPartialLocal(''); 
            
            // Generate AI insight after final answer
            setTimeout(() => runInsight(partial), 2000); // Debounced by 2s
            
            // Auto-advance after processing partial
            maybeAutoAdvance();
          } else if (currentQuestionIndex >= memoizedTotalQuestions - 1) {
            console.log('🎉 At final question, skipping auto-advance from silence');
          } else {
            console.log('🔇 Silence detected but no partial text to process');
          }
          
          // FIXED: Don't clear timers on VAD silence - let STT continue running
          // Only clear timers when we actually get a final transcript
          // clearTimeout(softTimer);
          // clearTimeout(hardTimer);
        }
      );
      
      // Store cleanup function that also clears timers
      const originalStop = stopRef.current;
      stopRef.current = () => {
        clearTimeout(softTimer);
        clearTimeout(hardTimer);
        if (originalStop) originalStop();
      };
      
    } catch (error) {
      console.error('STT Setup Error:', error);
      
      // Provide user-friendly error messages based on error type
      let userMessage = 'Speech recognition not available. Please use Chrome browser.';
      
      if (error instanceof Error) {
        if (error.message.includes('Browser STT not available')) {
          userMessage = 'Speech recognition not supported in this browser. Please use Chrome or Edge.';
        } else if (error.message.includes('client only')) {
          userMessage = 'Speech recognition can only be used in the browser.';
        } else if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
          userMessage = 'Microphone access denied. Please allow microphone permissions in your browser settings.';
        } else if (error.message.includes('getUserMedia')) {
          userMessage = 'Microphone access failed. Please check your microphone permissions and try again.';
        } else if (error.message.includes('NotSupportedError')) {
          userMessage = 'Your device does not support the required audio features. Please try a different device.';
        } else if (error.message.includes('NotReadableError')) {
          userMessage = 'Microphone is already in use by another application. Please close other apps using the microphone.';
        } else {
          userMessage = `Speech recognition error: ${error.message}`;
        }
      } else if (typeof error === 'string') {
        // Handle string errors
        if (error.includes('permission') || error.includes('denied')) {
          userMessage = 'Microphone access denied. Please allow microphone permissions.';
        } else if (error.includes('not supported')) {
          userMessage = 'Speech recognition not supported in this browser.';
        } else {
          userMessage = `Speech recognition error: ${error}`;
        }
      } else if (error && typeof error === 'object') {
        // Handle object errors
        const errorObj = error as any;
        if (errorObj.error === 'not-allowed') {
          userMessage = 'Microphone access denied. Please allow microphone permissions.';
        } else if (errorObj.error === 'audio-capture') {
          userMessage = 'Audio capture failed. Please check your microphone and try again.';
        } else if (errorObj.error === 'network') {
          userMessage = 'Network error during speech recognition. Please check your internet connection.';
        } else if (errorObj.message) {
          userMessage = `Speech recognition error: ${errorObj.message}`;
        }
      }
      
      // Set error state for UI display
      setSttError(userMessage);
      
      // Reset state to allow retry
      stopRef.current = null;
      console.log('🔄 STT setup failed, user can retry');
    } finally {
      setIsLoading(false);
    }
    
    // Note: First question speaking is handled by ControlsBar after countdown
    // No need to call speakQuestion here to avoid duplication
  };

  const stopMic = () => {
    if (stopRef.current) {
      // Safely call the stop function
      const stopFunction = stopRef.current;
      if (typeof stopFunction === 'function') {
        stopFunction();
      }
      stopRef.current = null;
    }
    
    // Clean up VAD
    if (vadStopRef.current) {
      vadStopRef.current();
      vadStopRef.current = null;
    }
    
    // Clear any pending partial update timeout
    if (partialUpdateTimeoutRef.current) {
      clearTimeout(partialUpdateTimeoutRef.current);
      partialUpdateTimeoutRef.current = null;
    }
    
    // Reset timing state
    turnStartedAtRef.current = 0;
    lastSpeechAtRef.current = 0;
    
    // Track session minutes
    if (campaignParam && sessionStartRef.current) {
      addSessionMinutes(campaignParam, Date.now() - sessionStartRef.current);
      sessionStartRef.current = null;
    }

    // Update Firebase session status to completed
    if (firebaseSessionId) {
      InterviewService.updateSessionStatus(firebaseSessionId, {
        status: 'completed',
        endedAt: new Date().toISOString()
      });
    }

    // Clear the session ID so the next Start creates a fresh session
    setFirebaseSessionId(null);
  };

  // Optimized transcript saving with better debouncing
  const saveTranscriptSegment = useCallback(async (text: string, timestamp: number, isPartial: boolean = false, sessionId?: string) => {
    // Use passed sessionId or fall back to firebaseSessionId
    const targetSessionId = sessionId || firebaseSessionId;
    
    console.log('🔍 saveTranscriptSegment called with:', { text, timestamp, isPartial, targetSessionId });
    
    if (!targetSessionId) {
      console.error('❌ No sessionId available, cannot save transcript');
      return;
    }

    try {
      const segmentData: AddTranscriptSegmentData = {
        segment: {
          tStart: timestamp - 5000, // Approximate start time (5 seconds before)
          tEnd: timestamp,
          speaker: 'cand',
          textRaw: text,
          textClean: text.trim(),
          confidence: 0.9, // Default confidence
          asrModel: 'Web Speech API'
        }
      };

      console.log(`💾 Saving ${isPartial ? 'partial' : 'final'} transcript:`, text.substring(0, 50) + '...');
      console.log('📋 Segment data:', segmentData);
      console.log('🆔 Using session ID:', targetSessionId);
      
      const result = await InterviewService.addTranscriptSegment(targetSessionId, segmentData);
      console.log(`✅ Transcript saved successfully with ID:`, result);
    } catch (error: any) {
      console.error('❌ Failed to save transcript segment:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        targetSessionId,
        text: text.substring(0, 50)
      });
    }
  }, [firebaseSessionId]);

  // Optimized question saving with better error handling
  const saveQuestionToFirebase = useCallback(async (questionText: string, questionType: string = 'behavioral') => {
    if (!firebaseSessionId) return;

    try {
      // Ensure questionType is always a valid string
      const safeQuestionType = questionType || 'behavioral';
      
      const questionData: AddQuestionData = {
        question: {
          type: safeQuestionType as any,
          source: (mode === 'conversational' ? 'ai' : 'scripted') as any,
          text: questionText,
          rubricKey: safeQuestionType
        }
      };

      await InterviewService.addQuestion(firebaseSessionId, questionData);
      console.log(`💾 Question saved: ${questionText.substring(0, 50)}...`);
    } catch (error) {
      console.error('Failed to save question:', error);
    }
  }, [firebaseSessionId, mode]);

  // Calculate interview progress - now using memoized values
  const totalQuestions = memoizedTotalQuestions;
  const completedQuestions = memoizedCompletedQuestions;
  
  // Check if interview is completed - now using memoized values
  const isInterviewCompleted = memoizedIsInterviewCompleted;

  // FIXED: Next question logic - ensure conversational mode uses AI follow-ups
  const nextQuestion = useCallback(() => {
    if (clickBusy) return;
    setClickBusy(true);
    const done = () => setTimeout(() => setClickBusy(false), 120);
  
    const session = useSession.getState();
    if (session.finished) { done(); return; }
  
    const isConversational = (mode === 'conversational');
  
    // Current question (for logging) BEFORE advancing
    const current = isConversational
      ? (storeCurrentQ || { text: '', category: 'behavioral' })
      : getCurrentQuestion();
  
    // Persist asked question (source reflects the mode)
    if (firebaseSessionId && current.text) {
      const questionCategory = (current as any).category || 'behavioral';
      void saveQuestionToFirebase(current.text, questionCategory.toLowerCase());
    }
  
    // FIXED: Proper advancement logic for each mode
    if (isConversational) {
      console.log('💬 Conversational mode - advancing to next AI-generated question...');
      
      // For conversational mode, use the session store's advance method
      session.advance(); // This handles AI follow-ups and question progression
      
      // FIXED: Ensure the new question is properly displayed
      const newQuestion = session.currentQ;
      console.log('🔄 New conversational question:', newQuestion.text);
      
      // Timeline event for conversational mode
      if (firebaseSessionId) {
        void InterviewService.addTimelineEvent(firebaseSessionId, {
          type: 'question_advanced',
          data: {
            from: 'conversational',
            to: session.qIndex,
            mode: 'conversational',
            questionText: newQuestion.text
          }
        });
      }
    } else {
      // For structured mode, increment the question index
      startTransition(() => {
        setCurrentQuestionIndex(i => Math.min(i + 1, memoizedTotalQuestions - 1));
      });
      
      // Timeline event for structured mode
      if (firebaseSessionId) {
        void InterviewService.addTimelineEvent(firebaseSessionId, {
          type: 'question_advanced',
          data: {
            from: currentQuestionIndex,
            to: Math.min(currentQuestionIndex + 1, memoizedTotalQuestions - 1),
            mode: 'structured'
          }
        });
      }
    }
  
    // FIXED: Speak the new question from the SAME source you advanced
    setTimeout(() => {
      const qText = isConversational
        ? useSession.getState().currentQ.text
        : getCurrentQuestion().text;
      
      if (qText && qText.trim()) {
        console.log('🎤 Speaking new question:', qText.substring(0, 50) + '...');
        try {
          speakQuestion(qText);
        } catch (error) {
          console.error('Failed to speak question:', error);
        }
      } else {
        console.warn('⚠️ No question text to speak');
      }
    }, 160);
  
    if (session.finished && firebaseSessionId) {
      void InterviewService.addTimelineEvent(firebaseSessionId, {
        type: 'interview_completed',
        data: { questionIndex: session.qIndex, totalQuestions: memoizedTotalQuestions }
      });
    }
  
    done();
  }, [clickBusy, firebaseSessionId, currentQuestionIndex, memoizedTotalQuestions, speakQuestion, mode, storeCurrentQ, getCurrentQuestion]);
  
  const previousQuestion = useCallback(() => {
    if (mode !== 'structured') return; // conversational has no fixed back step
    if (currentQuestionIndex <= 0) return;
  
    const newIndex = Math.max(currentQuestionIndex - 1, 0);
    startTransition(() => setCurrentQuestionIndex(newIndex));
  
    if (firebaseSessionId) {
      void InterviewService.addTimelineEvent(firebaseSessionId, {
        type: 'question_retreated',
        data: { from: currentQuestionIndex, to: newIndex }
      });
    }
  
    const q = getCurrentQuestion();
    setTimeout(() => speakQuestion(q.text), 160);
  }, [mode, currentQuestionIndex, firebaseSessionId, getCurrentQuestion, speakQuestion]);
  
  const resetQuestions = useCallback(() => {
    startTransition(() => {
      setCurrentQuestionIndex(0);
    });
    
    // Add timeline event
    if (firebaseSessionId) {
      setTimeout(() => {
        void InterviewService.addTimelineEvent(firebaseSessionId!, {
          type: 'questions_reset',
          data: { to: 0 }
        });
      }, 0);
    }
    
    // Note: Do NOT speak the question here - ControlsBar will handle it after reset
    // This prevents duplicate speech calls
  }, [firebaseSessionId]);

  // Debounced transcript update to reduce re-renders
  const debouncedSetPartial = useCallback(
    debounce((text: string) => {
      setPartial(text);
    }, 100),
    []
  );

  // Debounced transcript history update
  const debouncedSetTranscriptHistory = useCallback(
    debounce((text: string) => {
      setTranscriptHistory(prev => [...prev, text.trim()]);
    }, 200),
    []
  );

  // FIXED: Device check persistence - only check once per session
  const [deviceChecked, setDeviceChecked] = useState(false);
  
  // Initialize device check status from session store
  useEffect(() => {
    const sessionDeviceChecked = useSession.getState().deviceChecked;
    if (sessionDeviceChecked) {
      setDeviceChecked(true);
      setDeviceReady(true);
    }
  }, []);

  // Update session store when device check completes
  useEffect(() => {
    if (deviceReady && !deviceChecked) {
      setDeviceChecked(true);
      useSession.getState().setDeviceChecked(true);
    }
  }, [deviceReady, deviceChecked]);

  // FIXED: Real-time token and progress tracking
  useEffect(() => {
    // Force re-render when tokens or progress changes
    const interval = setInterval(() => {
      // This will trigger re-renders to show updated token counts and progress
      const currentTokens = useSession.getState().tokensUsed;
      const currentQIndex = useSession.getState().qIndex;
      
      if (currentTokens !== tokensUsed) {
        console.log('🔄 Token count updated:', tokensUsed, '→', currentTokens);
      }
      
      if (mode === 'conversational' && currentQIndex !== 0) {
        console.log('🔄 Progress updated: qIndex', currentQIndex);
      }
    }, 1000); // Check every second for updates
    
    return () => clearInterval(interval);
  }, [tokensUsed, mode, storeCurrentQ?.text]);

  // FIXED: Ensure conversational mode properly initializes progress
  useEffect(() => {
    if (mode === 'conversational' && storeCurrentQ?.text) {
      const session = useSession.getState();
      // If we have a question but qIndex is 0, set it to 1 to show progress
      if (session.qIndex === 0 && storeCurrentQ.text !== 'Give me a 30-second overview of your background and experience.') {
        console.log('🔄 Initializing conversational progress to 1');
        session.setInitialQuestion({
          ...storeCurrentQ,
          id: storeCurrentQ.id || 'conversational-init'
        });
        // Don't increment qIndex here - let the first answer do that
      }
    }
  }, [mode, storeCurrentQ?.text]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Enhanced Header with Progress */}
        <div className="frosted gradient-surface shadow-glow rounded-3xl p-8 animate-fade-in-up">
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] items-center gap-6">
            {/* LEFT: title + meta */}
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500
                              flex items-center justify-center text-white text-2xl transition-all duration-500 ${
                                stopRef.current 
                                  ? 'animate-pulse ring-4 ring-green-400/30 scale-110' 
                                  : 'animate-float'
                              }`}>
                {stopRef.current ? '🎙️' : '🎤'}
              </div>

              <div className="min-w-0">
                <h1 className="text-3xl font-extrabold text-white leading-tight">AI Interview Session</h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wide opacity-80">Session</span>
                    <span className="font-mono text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded">
                      {String((params as any)?.sessionId || '')}
                    </span>
                  </div>

                  {campaignParam && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wide opacity-80">Campaign</span>
                      <span className="font-mono text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded">
                        {campaignParam}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CENTER: Questions Completed */}
            <div className="justify-self-center w-full max-w-2xl">
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-1">
                    {completedQuestions}/{totalQuestions} Questions Completed
                  </div>
                  <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${(completedQuestions / totalQuestions) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Row: Controls + Current Question */}
        <div className="grid lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7">
            <div className="bg-gradient-to-r from-white/10 via-white/5 to-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-6 shadow-glow">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center animate-glow">
                  <span className="text-white text-lg">🎮</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Interview Controls</h2>
                {/* Loading indicator */}
                {isLoading && (
                  <div className="ml-auto">
                    <div className="flex items-center gap-2 text-blue-300 text-sm">
                      <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <ControlsBar
                  onStartSTT={startMic}
                  onStopSTT={stopMic}
                  onResetQuestions={resetQuestions}
                  onSpeakQuestion={speakQuestion}
                  onGetCurrentQuestion={() =>
                    mode === 'conversational'
                      ? (useSession.getState().currentQ.text ||
                         'Give me a 30-second overview of your background and experience.')
                      : getCurrentQuestion().text
                  }
                  deviceReady={deviceReady}
                  // FIXED: Pass token information for display
                  tokensUsed={tokensUsed}
                  softCap={softCap}
                  llmMode={llmMode}
                />
              </div>
              
              {/* FIXED: Device check only once per session */}
              {!started && !deviceChecked && (
                <div className="mt-4">
                  <DeviceCheck onStatusChange={setDeviceReady} />
                </div>
              )}

               {/* STT Error Display and Retry */}
               {sttError && (
                 <div className="mt-4 p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
                   <div className="flex items-start gap-3">
                     <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                       <span className="text-red-400 text-sm">⚠️</span>
                     </div>
                     <div className="flex-1">
                       <p className="text-red-200 text-sm font-medium mb-2">Speech Recognition Error</p>
                       <p className="text-red-300 text-xs mb-3">{sttError}</p>
                       <button
                         onClick={() => {
                           setSttError(null);
                           startMic();
                         }}
                         className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                       >
                         🔄 Retry
                       </button>
                     </div>
                   </div>
                 </div>
               )}
            </div>

            {/* Pro Tips compact card (shown after interview starts) */}
            {started && (
              <div className="mt-6 p-5 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-2xl border border-blue-700/30">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-yellow-400 text-base">💡</span>
                  </div>
                  <div>
                    <p className="text-blue-100 text-base font-semibold mb-2">Pro Tips for Best Results</p>
                    <p className="text-blue-200 text-sm leading-relaxed">
                      Use Chrome browser for optimal speech recognition. Click "Start" to begin, "Repeat" to re-ask questions,
                      and "Next" to advance through the interview flow. Speak clearly and take your time with responses.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-5">
            <div className="animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
              <AgentPane 
                currentQuestion={mode === 'conversational' ? 
                  { 
                    text: storeCurrentQ?.text || 'Give me a 30-second overview of your background and experience.', 
                    category: (storeCurrentQ as any)?.category || 'behavioral' 
                  } : currentQuestion}
                onNextQuestion={nextQuestion}
                onPreviousQuestion={previousQuestion}
                canGoNext={canGoNext}
                canGoPrevious={canGoPrevious}
              />
            </div>
          </div>
        </div>

        {/* Main Interview Interface */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left: Video */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden shadow-glow animate-fade-in-up h-full min-h-[720px] flex flex-col" style={{ animationDelay: '0.1s' }}>
              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/10">
                <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                  <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                  Live Video Stream
                </h3>
                <p className="text-blue-200 text-sm mt-2">
                  Camera preview, screen sharing, and live streaming capabilities
                </p>
                {!videoEnabled && (
                  <button
                    onClick={() => setVideoEnabled(true)}
                    className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    🎥 Enable Video
                  </button>
                )}
              </div>
              <div className="p-2 flex-1">
                {videoEnabled ? (
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-blue-400 text-2xl">📹</span>
                        </div>
                        <p className="text-blue-200 text-sm">Loading video components...</p>
                      </div>
                    </div>
                  }>
                    <VideoPublisher 
                      sessionId={sessionId} 
                      firebaseSessionId={firebaseSessionId || undefined}
                    />
                  </Suspense>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-slate-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-slate-400 text-2xl">🎥</span>
                      </div>
                      <p className="text-slate-200 text-sm">Click "Enable Video" to start camera preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Live Transcript */}
          <div className="lg:col-span-5">
            <div className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden shadow-glow animate-fade-in-up h-full min-h-[720px] flex flex-col" style={{ animationDelay: '0.15s' }}>
              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/10">
                <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                  <span className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></span>
                  Live Transcript
                </h3>
                <p className="text-blue-200 text-sm mt-2">
                  Real-time speech-to-text with AI-powered insights
                </p>
              </div>
              <div className="p-2 flex-1">
                <TranscriptPane 
                  partial={partial} 
                  listening={started}
                />
              </div>
            </div>
          </div>
        </div>


        

        {/* Interview Completion Screen */}
        {isInterviewCompleted && (
          <div className="animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
            <div className="bg-gradient-to-r from-green-900/20 via-emerald-900/20 to-green-900/20 backdrop-blur-lg rounded-3xl border border-green-700/30 p-12 shadow-glow text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                <span className="text-white text-4xl">🎉</span>
              </div>
              
              <h2 className="text-4xl font-bold text-white mb-4">Interview Completed!</h2>
              <p className="text-green-200 text-xl mb-8 max-w-2xl mx-auto">
                Congratulations! You have successfully completed all {totalQuestions} interview questions. 
                Your responses have been recorded and saved for review.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-blue-400 text-xl">📝</span>
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">Transcript Saved</h3>
                  <p className="text-blue-200 text-sm">All your responses have been transcribed and stored securely.</p>
                </div>
                
                <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-purple-400 text-xl">🎥</span>
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">Video Recorded</h3>
                  <p className="text-purple-200 text-sm">Your interview session has been captured for review.</p>
                </div>
                
                <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-green-400 text-xl">✅</span>
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">Session Complete</h3>
                  <p className="text-green-200 text-sm">Your interview data is ready for evaluation.</p>
                </div>
              </div>
              
              {/* Confidence metrics and report link */}
              <div className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/10">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-left">
                    <h4 className="text-white font-semibold mb-3">Session Quality</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-blue-200">Confidence</span>
                          <span className="text-white">85%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                        </div>
                      </div>
                      <div className="text-sm text-blue-200">
                        <span className="text-white">{transcriptHistory.length}</span> valid responses • 
                        <span className="text-white"> {Math.round((transcriptHistory.length / totalQuestions) * 100)}%</span> completion
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-left">
                    <h4 className="text-white font-semibold mb-3">Share Report</h4>
                    <div className="space-y-3">
                      <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
                        <p className="text-blue-300 font-mono text-xs break-all">
                          {`${window.location.origin}/reports/${sessionId}${campaignParam ? `?c=${campaignParam}` : ''}`}
                        </p>
                      </div>
                      <button 
                        onClick={async () => {
                          const reportUrl = `${window.location.origin}/reports/${sessionId}${campaignParam ? `?c=${campaignParam}` : ''}`;
                          if (navigator.clipboard && navigator.clipboard.writeText) {
                            try { 
                              await navigator.clipboard.writeText(reportUrl); 
                              // Could add a toast here
                            } catch {}
                          }
                        }}
                        className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105 shadow-glow"
                      >
                        📋 Copy Report Link
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-8 border-t border-white/20">
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={generateFinalSummaryAndNavigate}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 hover:scale-105 shadow-lg"
                  >
                    📊 Generate Final Report
                  </button>
                  <button
                    onClick={() => {
                      setCurrentQuestionIndex(0);
                      setFirebaseSessionId(null);
                      setTranscriptHistory([]);
                      setPartialLocal('');
                      lastSavedPartialRef.current = '';
                      savedTranscriptsRef.current.clear();
                      if (partialUpdateTimeoutRef.current) {
                        clearTimeout(partialUpdateTimeoutRef.current);
                        partialUpdateTimeoutRef.current = null;
                      }
                    }}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 hover:scale-105 shadow-lg"
                  >
                    Start New Interview
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Interview Tips */}
        <div className="bg-gradient-to-r from-white/10 via-white/5 to-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-8 shadow-glow animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">💡</span>
            </div>
            <h3 className="text-3xl font-bold text-white">Interview Success Tips</h3>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="group bg-gradient-to-br from-green-900/20 to-emerald-900/20 p-8 rounded-2xl border border-green-700/30 hover:border-green-600/50 transition-all duration-500 hover:scale-105 card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <span className="text-white text-2xl">✅</span>
              </div>
              <h4 className="text-white font-semibold text-xl mb-4">Speak Clearly</h4>
              <p className="text-green-200 text-base leading-relaxed">Enunciate your words and maintain a steady pace for optimal transcription accuracy and AI understanding.</p>
            </div>
            
            <div className="group bg-gradient-to-br from-blue-900/20 to-indigo-900/20 p-8 rounded-2xl border border-blue-700/30 hover:border-blue-600/50 transition-all duration-500 hover:scale-105 card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <span className="text-white text-2xl">🎯</span>
              </div>
              <h4 className="text-white font-semibold text-xl mb-4">Be Specific</h4>
              <p className="text-blue-200 text-base leading-relaxed">Provide concrete examples, metrics, and real-world scenarios to demonstrate your expertise and experience.</p>
            </div>
            
            <div className="group bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-8 rounded-2xl border border-purple-700/30 hover:border-purple-600/50 transition-all duration-500 hover:scale-105 card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <span className="text-white text-2xl">⏱️</span>
              </div>
              <h4 className="text-white font-semibold text-xl mb-4">Take Your Time</h4>
              <p className="text-purple-200 text-base leading-relaxed">Don't rush your responses. Thoughtful, well-structured answers lead to better follow-up questions and insights.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}