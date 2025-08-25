'use client';

import { useEffect, useRef, useState } from 'react';
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
    // ttsVoice,     // TTS voice (used by ControlsBar directly)
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

  // Initialize campaign + (optional) interview mode (separate from LLM mode)
  useEffect(() => {
    setCampaign(campaignParam || undefined);
    
    // Load campaign questions if available
    if (campaignParam) {
      const questions = loadCampaignQuestions(campaignParam);
      console.log('📚 Loaded campaign questions:', questions);
      setCampaignQuestions(questions);
    }
  }, [campaignParam, setCampaign]);

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
  const completedQuestions = currentQuestionIndex;
  const totalQuestions = campaignQuestions.length > 0 ? campaignQuestions.length : 8;

  const nextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      // Save current question to Firebase before moving to next
      const currentQuestion = getCurrentQuestion();
      if (firebaseSessionId && currentQuestion.text) {
        // Ensure category exists and is a string before calling toLowerCase()
        const questionCategory = currentQuestion.category || 'behavioral';
        saveQuestionToFirebase(currentQuestion.text, questionCategory.toLowerCase());
      }

      setCurrentQuestionIndex(prev => prev + 1);
      
      // Add timeline event
      if (firebaseSessionId) {
        InterviewService.addTimelineEvent(firebaseSessionId, {
          type: 'question_advanced',
          data: { from: currentQuestionIndex, to: currentQuestionIndex + 1 }
        });
      }
      
      console.log(`➡️ Advanced to question ${currentQuestionIndex + 1}/${totalQuestions}`);
    } else {
      console.log('🎉 Interview completed! All questions answered.');
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      
      // Add timeline event
      if (firebaseSessionId) {
        InterviewService.addTimelineEvent(firebaseSessionId, {
          type: 'question_retreated',
          data: { from: currentQuestionIndex, to: currentQuestionIndex - 1 }
        });
      }
      
      console.log(`⬅️ Returned to question ${currentQuestionIndex - 1}/${totalQuestions}`);
    }
  };

  const getCurrentQuestion = () => {
    if (campaignQuestions.length > 0 && currentQuestionIndex < campaignQuestions.length) {
      const question = campaignQuestions[currentQuestionIndex];
      // Ensure question has a category, default to 'behavioral' if missing
      const questionWithCategory = {
        ...question,
        category: question.category || 'behavioral'
      };
      console.log(`📝 Current question (${currentQuestionIndex + 1}/${totalQuestions}):`, questionWithCategory);
      return questionWithCategory;
    }
    
    // Fallback to default questions if no campaign questions loaded
    const defaultQuestion = {
      id: `default-${currentQuestionIndex + 1}`,
      text: currentQuestionIndex === 0 
        ? 'Give me a 30-second overview of your background and experience.'
        : currentQuestionIndex === 1
        ? 'What are your key strengths and how have they helped you in your career?'
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
    };
    
    console.log(`📝 Using default question (${currentQuestionIndex + 1}/${totalQuestions}):`, defaultQuestion);
    return defaultQuestion;
  };

  const resetQuestions = () => {
    setCurrentQuestionIndex(0);
    
    // Add timeline event
    if (firebaseSessionId) {
      InterviewService.addTimelineEvent(firebaseSessionId, {
        type: 'questions_reset',
        data: { to: 0 }
      });
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

        {/* Enhanced Controls Bar */}
        <div className="bg-gradient-to-r from-white/10 via-white/5 to-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-8 shadow-glow">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center animate-glow">
              <span className="text-white text-lg">🎮</span>
            </div>
            <h2 className="text-3xl font-bold text-white">Interview Controls</h2>
          </div>
          
          <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <ControlsBar 
              onStartSTT={startMic} 
              onStopSTT={stopMic} 
              onResetQuestions={resetQuestions}
              currentQuestionText={getCurrentQuestion().text}
            />
          </div>
          
          <div className="mt-8 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-2xl border border-blue-700/30">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-yellow-400 text-lg">💡</span>
              </div>
              <div>
                <p className="text-blue-100 text-base font-semibold mb-3">Pro Tips for Best Results</p>
                <p className="text-blue-200 text-sm leading-relaxed">
                  Use Chrome browser for optimal speech recognition. Click "Start" to begin, "Repeat" to re-ask questions, 
                  and "Next" to advance through the interview flow. Speak clearly and take your time with responses.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Interview Interface - Simplified Layout */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left Column - Interview Core */}
          <div className="lg:col-span-4 space-y-8">
            <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <AgentPane 
                currentQuestion={getCurrentQuestion()}
                onNextQuestion={nextQuestion}
                onPreviousQuestion={previousQuestion}
                canGoNext={currentQuestionIndex < totalQuestions - 1}
                canGoPrevious={currentQuestionIndex > 0}
              />
            </div>
          </div>
          
          {/* Right Column - Video & Transcript side by side */}
          <div className="lg:col-span-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Video Publisher - Enhanced Display */}
              <div className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden shadow-glow animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/10">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                    <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                    Live Video Stream
                  </h3>
                  <p className="text-blue-200 text-sm mt-2">
                    Camera preview, screen sharing, and live streaming capabilities
                  </p>
                </div>
                <div className="p-2">
                  <VideoPublisher 
                    sessionId={sessionId} 
                    firebaseSessionId={firebaseSessionId || undefined}
                  />
                </div>
              </div>

              {/* Transcript Pane - Enhanced */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <div className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden shadow-glow h-full">
                  <div className="p-6 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/10">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                      <span className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></span>
                      Live Transcript
                    </h3>
                    <p className="text-blue-200 text-sm mt-2">
                      Real-time speech-to-text with AI-powered insights
                    </p>
                  </div>
                  <div className="p-2">
                    <TranscriptPane 
                      partial={partial} 
                      listening={Boolean(stopRef.current)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
