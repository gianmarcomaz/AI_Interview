'use client';

import { useEffect, useRef, useState, useCallback, useTransition } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useSession } from '@/lib/store/session';
import { startSTT } from '@/lib/stt/webspeech';
import ControlsBar from '@/components/ControlsBar';
import AgentPane from '@/components/AgentPane';
import TranscriptPane from '@/components/TranscriptPane';
import VideoPublisher from '@/components/VideoPublisher';
import LanguagePicker from '@/components/LanguagePicker';
import { inc, addSessionMinutes } from '@/lib/metrics/local';
import { loadCampaignQuestions } from '@/lib/store/session';
import { InterviewService } from '@/lib/firebase/interview';
import { CreateInterviewSessionData, AddTranscriptSegmentData, AddQuestionData, AddAnswerData } from '@/types/interview';

export default function InterviewClient() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = String(params?.sessionId ?? '');

  // Safely derive URL params once
  const campaignParam = searchParams?.get('c') ?? null;

  // Session store (Day-2 shape uses `mode`/`setMode` for LLM mode)
  const {
    setCampaign,
    lang,         // STT language
    setLang,
    setTtsVoice,
    setPartial,
    pushFinal,
    transcript,   // needed for TranscriptPane
    started,
  } = useSession();

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

  // Transition to keep UI responsive on button clicks
  const [isPending, startTransition] = useTransition();

  // Memoized current question getter (placed before handlers that depend on it)
  const getCurrentQuestion = useCallback(() => {
    const localTotalQuestions = campaignQuestions.length > 0 ? campaignQuestions.length : 8;
    if (campaignQuestions.length > 0 && currentQuestionIndex < campaignQuestions.length) {
      const question = campaignQuestions[currentQuestionIndex];
      const questionWithCategory = {
        ...question,
        category: question.category || 'behavioral'
      };
      console.log(`📝 Current question (${currentQuestionIndex + 1}/${localTotalQuestions}):`, questionWithCategory);
      return questionWithCategory;
    }
    const defaultQuestion = {
      id: `default-${currentQuestionIndex + 1}`,
      text: currentQuestionIndex === 0 
        ? 'Give me a 30-second overview of your background and experience.'
        : currentQuestionIndex === 1
        ? 'How would you keep p95 <1s in a live STT to summary pipeline?'
        : currentQuestionIndex === 2
        ? 'Describe a challenging project you worked on and how you overcame obstacles.'
        : currentQuestionIndex === 3
        ? 'Where do you see yourself professionally in the next 3-5 years?'
        : currentQuestionIndex === 4
        ? 'What motivates you to do your best work?'
        : currentQuestionIndex === 5
        ? 'Tell me about a time you had to learn something new quickly.'
        : currentQuestionIndex === 6
        ? 'How do you handle feedback and criticism?'
        : 'What questions do you have for me about this role or company?',
      category: 'behavioral'
    } as const;
    console.log(`📝 Using default question (${currentQuestionIndex + 1}/${localTotalQuestions}):`, defaultQuestion);
    return defaultQuestion;
  }, [campaignQuestions, currentQuestionIndex]);

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
        }
      } catch (e) {
        console.warn('Failed to load campaign settings for session:', e);
      }
    }
  }, [campaignParam, setCampaign, setLang, setTtsVoice]);

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
    };
  }, []);

  const createFirebaseSession = async () => {
    try {
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
    }
  };

  const startMic = async () => {
    if (stopRef.current) {
      // If already recording, just stop
      stopMic();
      return;
    }
    
    // If we have an existing session, ask user if they want to start fresh
    if (firebaseSessionId) {
      const startFresh = window.confirm(
        'You already have an interview session. Would you like to start a completely new interview?'
      );
      
      if (startFresh) {
        // Reset everything for new interview
        console.log('🔄 Starting fresh interview...');
        
        // Stop any existing recording first
        if (stopRef.current) {
          try {
            (stopRef.current as () => void)();
          } catch (error) {
            console.error('Error stopping recording:', error);
          }
        }
        stopRef.current = null;
        
        // Reset session state
        setFirebaseSessionId(null);
        setCurrentQuestionIndex(0);
        setCampaignQuestions([]);
        setTranscriptHistory([]); // Clear transcript history
        lastSavedPartialRef.current = ''; // Clear last saved partial for fresh start
        savedTranscriptsRef.current.clear(); // Clear saved transcripts for fresh start
        
        // Clear any pending partial update timeout
        if (partialUpdateTimeoutRef.current) {
          clearTimeout(partialUpdateTimeoutRef.current);
          partialUpdateTimeoutRef.current = null;
        }
        
        // Load campaign questions again
        if (campaignParam) {
          const questions = loadCampaignQuestions(campaignParam);
          setCampaignQuestions(questions);
        }
      } else {
        // Continue with existing session
        console.log('📝 Continuing with existing session...');
      }
    }
    
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
    
    try {
      stopRef.current = startSTT(
        (t) => { 
          console.log('🎤 Partial transcript received:', t);
          setPartialLocal(t); 
          setPartial(t); 
          
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
          
          // Add to transcript history for display
          if (t.trim()) {
            setTranscriptHistory(prev => [...prev, t.trim()]);
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
        },
        lang
      );
    } catch (error) {
      console.error('STT Error:', error);
      alert('Speech recognition not available. Please use Chrome browser.');
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
      
      // Clear any pending partial update timeout
      if (partialUpdateTimeoutRef.current) {
        clearTimeout(partialUpdateTimeoutRef.current);
        partialUpdateTimeoutRef.current = null;
      }
      
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
    }
  };

  // Save transcript segment to Firebase
  const saveTranscriptSegment = async (text: string, timestamp: number, isPartial: boolean = false, sessionId?: string) => {
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
  };

  // Save question to Firebase
  const saveQuestionToFirebase = async (questionText: string, questionType: string = 'behavioral') => {
    if (!firebaseSessionId) return;

    try {
      // Ensure questionType is always a valid string
      const safeQuestionType = questionType || 'behavioral';
      
      const questionData: AddQuestionData = {
        question: {
          type: safeQuestionType as any,
          source: 'scripted',
          text: questionText,
          rubricKey: safeQuestionType
        }
      };

      await InterviewService.addQuestion(firebaseSessionId, questionData);
      console.log(`💾 Question saved to Firebase: ${questionText.substring(0, 50)}...`);
    } catch (error) {
      console.error('Failed to save question:', error);
    }
  };

  // Save answer to Firebase
  const saveAnswerToFirebase = async (questionId: string, answerText: string) => {
    if (!firebaseSessionId) return;

    try {
      const answerData: AddAnswerData = {
        answer: {
          questionId,
          transcriptRefs: [], // Will be linked to transcript segments
          attachments: []
        }
      };

      await InterviewService.addAnswer(firebaseSessionId, answerData);
    } catch (error) {
      console.error('Failed to save answer:', error);
    }
  };

  // Calculate interview progress
  const totalQuestions = campaignQuestions.length > 0 ? campaignQuestions.length : 8;
  const completedQuestions = currentQuestionIndex >= totalQuestions - 1 ? totalQuestions : currentQuestionIndex; // Show full completion when on last question
  
  // Check if interview is completed
  const isInterviewCompleted = currentQuestionIndex >= totalQuestions - 1;

  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < totalQuestions - 1) {
      // Save current question to Firebase before moving to next
      const currentQuestion = getCurrentQuestion();
      if (firebaseSessionId && currentQuestion.text) {
        // Ensure category exists and is a string before calling toLowerCase()
        const questionCategory = currentQuestion.category || 'behavioral';
        // Fire-and-forget to avoid blocking UI thread
        setTimeout(() => {
          void saveQuestionToFirebase(currentQuestion.text, questionCategory.toLowerCase());
        }, 0);
      }

      // Move to next question
      const newIndex = currentQuestionIndex + 1;
      startTransition(() => {
        setCurrentQuestionIndex(newIndex);
      });
      
      // Add timeline event
      if (firebaseSessionId) {
        // Defer IO
        setTimeout(() => {
          void InterviewService.addTimelineEvent(firebaseSessionId, {
            type: 'question_advanced',
            data: { from: currentQuestionIndex, to: newIndex }
          });
        }, 0);
      }
      
      console.log(`➡️ Advanced to question ${newIndex + 1}/${totalQuestions}`);
      
      // Get the question text from campaign questions or fallback to defaults
      let nextQuestionText: string;
      
      if (campaignQuestions.length > 0 && newIndex < campaignQuestions.length) {
        // Use campaign question
        nextQuestionText = campaignQuestions[newIndex].text;
        console.log(`📝 Using campaign question ${newIndex + 1}: ${nextQuestionText.substring(0, 50)}...`);
      } else {
        // Fallback to default questions
        nextQuestionText = newIndex === 0 
          ? 'Give me a 30-second overview of your background and experience.'
          : newIndex === 1
          ? 'How would you keep p95 <1s in a live STT to summary pipeline?'
          : newIndex === 2
          ? 'Describe a challenging project you worked on and how you overcame obstacles.'
          : newIndex === 3
          ? 'Where do you see yourself professionally in the next 3-5 years?'
          : newIndex === 4
          ? 'What motivates you to do your best work?'
          : newIndex === 5
          ? 'Tell me about a time you had to learn something new quickly.'
          : newIndex === 6
          ? 'How do you handle feedback and criticism?'
          : 'What questions do you have for me about this role or company?';
        console.log(`📝 Using default question ${newIndex + 1}: ${nextQuestionText.substring(0, 50)}...`);
      }
      
      // Speak the new question after a short delay to ensure state is updated
      setTimeout(() => {
        console.log(`🎤 Speaking question ${newIndex + 1}: ${nextQuestionText.substring(0, 50)}...`);
        speakQuestion(nextQuestionText);
      }, 160); // Slightly reduced delay for snappier feel while avoiding interruptions
      
      // If this is the last question, mark interview as completed
      if (newIndex === totalQuestions - 1) {
        console.log('🎉 Reached final question - interview will be marked as complete');
        // Add completion timeline event
        if (firebaseSessionId) {
          setTimeout(() => {
            void InterviewService.addTimelineEvent(firebaseSessionId!, {
              type: 'final_question_reached',
              data: { questionIndex: newIndex, totalQuestions }
            });
          }, 0);
        }
      }
    } else {
      console.log('🎉 Interview completed! All questions answered.');
      // Add completion timeline event
      if (firebaseSessionId) {
        setTimeout(() => {
          void InterviewService.addTimelineEvent(firebaseSessionId!, {
            type: 'interview_completed',
            data: { totalQuestions, completedAt: new Date().toISOString() }
          });
        }, 0);
      }
    }
  }, [currentQuestionIndex, totalQuestions, firebaseSessionId, getCurrentQuestion]);

  const previousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      // Move to previous question
      const newIndex = currentQuestionIndex - 1;
      startTransition(() => {
        setCurrentQuestionIndex(newIndex);
      });
      
      // Add timeline event
      if (firebaseSessionId) {
        setTimeout(() => {
          void InterviewService.addTimelineEvent(firebaseSessionId!, {
            type: 'question_retreated',
            data: { from: currentQuestionIndex, to: newIndex }
          });
        }, 0);
      }
      
      console.log(`⬅️ Returned to question ${newIndex + 1}/${totalQuestions}`);
      
      // Get the question text from campaign questions or fallback to defaults
      let previousQuestionText: string;
      
      if (campaignQuestions.length > 0 && newIndex < campaignQuestions.length) {
        // Use campaign question
        previousQuestionText = campaignQuestions[newIndex].text;
        console.log(`📝 Using campaign question ${newIndex + 1}: ${previousQuestionText.substring(0, 50)}...`);
      } else {
        // Fallback to default questions
        previousQuestionText = newIndex === 0 
          ? 'Give me a 30-second overview of your background and experience.'
          : newIndex === 1
          ? 'How would you keep p95 <1s in a live STT to summary pipeline?'
          : newIndex === 2
          ? 'Describe a challenging project you worked on and how you overcame obstacles.'
          : newIndex === 3
          ? 'Where do you see yourself professionally in the next 3-5 years?'
          : newIndex === 4
          ? 'What motivates you to do your best work?'
          : newIndex === 5
          ? 'Tell me about a time you had to learn something new quickly.'
          : newIndex === 6
          ? 'How do you handle feedback and criticism?'
          : 'What questions do you have for me about this role or company?';
        console.log(`📝 Using default question ${newIndex + 1}: ${previousQuestionText.substring(0, 50)}...`);
      }
      
      // Speak the question after a short delay to ensure state is updated
      setTimeout(() => {
        console.log(`🎤 Speaking question ${newIndex + 1}: ${previousQuestionText.substring(0, 50)}...`);
        speakQuestion(previousQuestionText);
      }, 160);
    }
  }, [currentQuestionIndex, totalQuestions, campaignQuestions, firebaseSessionId]);

  

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

  // AI Voice function to speak questions
  const speakQuestion = (questionText: string) => {
    if ('speechSynthesis' in window) {
      // Stop any current speech gracefully
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        // Small delay to ensure clean stop
        setTimeout(() => {
          speakQuestionInternal(questionText);
        }, 100);
      } else {
        speakQuestionInternal(questionText);
      }
    } else {
      console.warn('⚠️ Speech synthesis not supported in this browser');
    }
  };

  // Internal TTS function with proper error handling
  const speakQuestionInternal = (questionText: string) => {
    try {
      const utterance = new SpeechSynthesisUtterance(questionText);
      
      // Get the selected TTS voice from the session store
      const { ttsVoice } = useSession.getState();
      
      if (ttsVoice && ttsVoice !== 'default') {
        // Find the specific voice
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === ttsVoice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log('🎤 Using selected TTS voice:', selectedVoice.name);
        }
      }
      
      // Configure speech parameters for clear interview questions
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Add event handlers with better error handling
      utterance.onstart = () => {
        console.log('🎤 AI speaking question:', questionText.substring(0, 50) + '...');
      };
      
      utterance.onend = () => {
        console.log('✅ AI finished speaking question');
      };
      
      utterance.onerror = (event) => {
        // Handle different error types gracefully
        switch (event.error) {
          case 'interrupted':
            console.log('ℹ️ Speech was interrupted (this is normal when navigating quickly)');
            break;
          case 'canceled':
            console.log('ℹ️ Speech was canceled (this is normal when stopping)');
            break;
          case 'not-allowed':
            console.error('❌ Speech not allowed - check browser permissions');
            break;
          case 'network':
            console.error('❌ Network error during speech synthesis');
            break;
          case 'audio-busy':
            console.error('❌ Audio system is busy');
            break;
          default:
            console.error('❌ TTS Error:', event.error);
        }
      };
      
      // Speak the question
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('❌ Error setting up TTS:', error);
    }
  };

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
              </div>
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <ControlsBar 
                  onStartSTT={startMic} 
                  onStopSTT={stopMic} 
                  onResetQuestions={resetQuestions}
                  onSpeakQuestion={speakQuestion}
                  onGetCurrentQuestion={() => getCurrentQuestion().text}
                />
              </div>
            </div>

            {/* Pro Tips compact card under controls */}
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
          </div>
          <div className="lg:col-span-5">
            <div className="animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
              <AgentPane 
                currentQuestion={getCurrentQuestion()}
                onNextQuestion={nextQuestion}
                onPreviousQuestion={previousQuestion}
                canGoNext={currentQuestionIndex < totalQuestions - 1}
                canGoPrevious={currentQuestionIndex > 0}
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
              </div>
              <div className="p-2 flex-1">
                <VideoPublisher 
                  sessionId={sessionId} 
                  firebaseSessionId={firebaseSessionId || undefined}
                />
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
                  listening={Boolean(stopRef.current)}
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
              
              <div className="mt-8 pt-8 border-t border-white/20">
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
