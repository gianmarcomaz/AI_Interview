'use client';
import { create } from 'zustand';
import { Question, QUESTION_BANK, pickInitial, followupOrNext, pickNextDynamic } from '@/lib/fsm/agent';
import { config } from '@/lib/config/env';

export type Turn = { text: string; final: boolean; ts: number };
export type ReportTranscript = { role: "user" | "ai"; text: string };

// Function to load campaign questions from localStorage
export const loadCampaignQuestions = (campaignId: string): Question[] => {
  try {
    const savedSettings = localStorage.getItem(`campaign-settings-${campaignId}`);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        // Normalize, sort, and filter questions to prevent gaps or empty items
        const normalized: Question[] = parsed.questions
          .map((q: any, index: number) => ({
            id: `q${q.id ?? index + 1}`,
            text: typeof q.text === 'string' ? q.text.trim() : '',
            category: typeof q.category === 'string' && q.category.trim().length > 0 ? q.category : 'behavioral',
            order: typeof q.order === 'number' ? q.order : index
          }))
          // Remove questions without usable text
          .filter((q: Question) => q.text.length > 0)
          // Sort by explicit order, then by stable index
          .sort((a: any, b: any) => {
            const ao = typeof a.order === 'number' ? a.order : 0;
            const bo = typeof b.order === 'number' ? b.order : 0;
            return ao - bo;
          })
          // Reassign stable ids after sorting to ensure contiguous sequence
          .map((q: any, idx: number) => ({ ...q, id: `q${idx + 1}` }));

        // Fallback if everything was filtered out
        if (normalized.length > 0) return normalized;
      }
    }
  } catch (e) {
    console.error('Failed to load campaign questions:', e);
  }
  return QUESTION_BANK; // Fallback to default questions
};

// Function to pick initial question from campaign questions
export const pickInitialFromCampaign = (campaignId?: string): Question => {
  if (campaignId) {
    const campaignQuestions = loadCampaignQuestions(campaignId);
    if (campaignQuestions.length > 0) {
      return campaignQuestions[0];
    }
  }
  return pickInitial();
};

// Function to get next question from campaign questions
export const getNextFromCampaign = (currentIndex: number, campaignId?: string): Question | null => {
  if (campaignId) {
    const campaignQuestions = loadCampaignQuestions(campaignId);
    if (currentIndex < campaignQuestions.length - 1) {
      return campaignQuestions[currentIndex + 1];
    }
    return null; // No more questions
    }
  return null;
};

type State = {
  sessionId: string;
  campaignId?: string;
  started: boolean;
  lang: string;
  mode: 'structured'|'conversational';
  currentQ: Question;
  qIndex: number;
  partial: string;
  transcript: Turn[];
  lastAnswer?: string;
  askedIds: string[];
  finished: boolean;
  // Day 2 additions (LLM insights)
  llmMode: 'cloud'|'rules';
  rollingSummary: string;
  lastInsight?: { schema_version: 1; turn_id: string; summary: string; tags: string[]; citations?: string[]; flags?: string[]; followup?: string };
  lastLatencyMs?: number;
  tagTally: Record<string, number>;
  // AI interview system additions
  tokensUsed: number;
  softCap: number;
  insights: any[];
  finalSummary: any | null;
  // Conversational follow-ups
  followupQueue: string[];
  // Multilingual support
  ttsVoice?: string;
  // Consent gate
  consentAccepted: boolean;
  // Device check persistence
  deviceChecked: boolean;
  setCampaign(id?: string): void;
  setMode(m: 'structured'|'conversational'): void;
  setLLMMode(m: 'cloud'|'rules'): void;
  setLang(lang: string): void;
  setTtsVoice(v?: string): void;
  setConsent(v: boolean): void;
  setDeviceChecked(v: boolean): void;
  start(initialQuestion?: Question): void; 
  stop(): void;
  setPartial(t: string): void;
  pushFinal(t: string, ts: number): void;
  updateRolling(): void;
  repeat(): void;
  setInsight(i: { schema_version: 1; turn_id: string; summary: string; tags: string[]; citations?: string[]; flags?: string[] }, latency: number): void;
  // AI interview system actions
  addTokens(n: number): void;
  setFinalSummary(json: any): void;
  enqueueFollowup(q: string): void;
  dequeueFollowup(): string | undefined;
  clearFollowups: () => void;
  appendTranscript: (e: ReportTranscript) => void;
  setTranscript: (tx: ReportTranscript[]) => void;
  setInitialQuestion(q: Question): void;
  advance: () => void;
};

// Reentrancy guard for advancing to avoid double increments
let __advancing = false;

export const useSession = create<State>((set, get) => ({
  sessionId: '',
  campaignId: undefined,
  started: false,
  lang: 'en-US',
  mode: 'structured',
  currentQ: pickInitial(),
  qIndex: 0,
  partial: '',
  transcript: [],
  lastAnswer: undefined,
  askedIds: [],
  finished: false,
  // Use a deterministic initial mode to avoid SSR/CSR mismatches
  // We'll rely on runtime calls to flip to 'cloud' if successful and under budget
  llmMode: 'rules',
  rollingSummary: '',
  lastInsight: undefined,
  lastLatencyMs: undefined,
  tagTally: {},
  // AI interview system additions
  tokensUsed: 0,
  softCap: config.llm.softTokenCap,
  insights: [],
  finalSummary: null,
  followupQueue: [],
  ttsVoice: undefined,
  consentAccepted: false,
  deviceChecked: false,

  setCampaign(id) { set({ campaignId: id }); },
  setMode(m) { set({ mode: m }); },
  setLLMMode(m) { set({ llmMode: m }); },
  setLang(lang) { set({ lang }); },
  setTtsVoice(v) { set({ ttsVoice: v }); },
  setConsent(v) { set({ consentAccepted: v }); },
  setDeviceChecked(v) { set({ deviceChecked: v }); },
  start(initialQuestion?: Question) { 
    set({ 
      started: true, 
      finished: false, 
      qIndex: 0, 
      askedIds: [], 
      currentQ: initialQuestion || pickInitial(), 
      transcript: [], 
      partial: '', 
      lastAnswer: undefined 
    }); 
  },
  stop() { set({ started: false, partial: '' }); },
  setPartial(t) { set({ partial: t }); },
  pushFinal(t, ts) {
    const clean = t.trim();
    const turns = get().transcript.concat([{ text: clean, final: true, ts }]);
    set({ transcript: turns, lastAnswer: clean, partial: '' });
    get().updateRolling();
  },
  updateRolling() {
    const finals = get().transcript.filter(x=>x.final).slice(-3).map(t=>t.text);
    set({ rollingSummary: finals.join(' ') });
  },
  repeat() { /* no state change; handled by TTS invoke in UI */ },
  setInsight(i, latency) {
    const tally = { ...get().tagTally };
    (i.tags || []).forEach(tag => { tally[tag] = (tally[tag] ?? 0) + 1; });
    set({ lastInsight: i, lastLatencyMs: latency, tagTally: tally });
  },
  // AI interview system actions
  addTokens(n) {
    set(s => ({ 
      tokensUsed: s.tokensUsed + (n||0), 
      llmMode: (s.tokensUsed + (n||0) >= s.softCap) ? "rules" : s.llmMode 
    }));
  },
  setFinalSummary(json) {
    set({ finalSummary: json });
  },
  enqueueFollowup(q) { set(s => ({ followupQueue: [...s.followupQueue, q] })); },
  dequeueFollowup() {
    const q = get().followupQueue[0];
    if (!q) return undefined;
    set(s => ({ followupQueue: s.followupQueue.slice(1) }));
    return q;
  },
  clearFollowups: () => set({ followupQueue: [] }),
  appendTranscript: (e: ReportTranscript) => set(s => ({ 
    transcript: [...s.transcript, { text: e.text, final: e.role === "user", ts: Date.now() }] 
  })),
  setTranscript: (tx: ReportTranscript[]) => set({ 
    transcript: tx.map(e => ({ text: e.text, final: e.role === "user", ts: Date.now() })) 
  }),
  setInitialQuestion(q) {
    set({ currentQ: q });
  },
  advance: () => {
    if (__advancing) return;
    __advancing = true;
    setTimeout(() => { __advancing = false; }, 300);

    set((s) => {
      if (s.finished) return s;

      const { mode, lastAnswer, currentQ, qIndex, askedIds, followupQueue, lastInsight } = s;

      if (mode === 'conversational') {
        console.log('💬 Conversational mode - advancing...');
        console.log('📋 Follow-up queue length:', followupQueue.length);
        console.log('🔍 Last insight follow-up:', lastInsight?.followup);
        
        // Prioritize AI-generated follow-ups from the queue
        if (followupQueue.length > 0) {
          const nextFollowup = s.dequeueFollowup();
          if (nextFollowup) {
            const nextQ: Question = { 
              ...currentQ, 
              id: currentQ.id + '-ai-followup', 
              text: nextFollowup,
              topic: 'behavioral',
              difficulty: 2
            };
            console.log('🔄 Using queued AI follow-up:', nextFollowup.substring(0, 50) + '...');
            // FIXED: Increment qIndex for AI follow-ups to track progress
            const newQIndex = qIndex + 1;
            console.log('📊 Progress updated: qIndex', qIndex, '→', newQIndex);
            return { currentQ: nextQ, lastAnswer: undefined, qIndex: newQIndex };
          }
        }

        // If no queued follow-ups, check if we have a recent insight with a follow-up
        if (lastInsight?.followup && lastInsight.followup.trim().length > 0) {
          const nextQ: Question = { 
            ...currentQ, 
            id: currentQ.id + '-ai-insight-followup', 
            text: lastInsight.followup,
            topic: 'behavioral',
            difficulty: 2
          };
          console.log('🔄 Using insight follow-up:', lastInsight.followup.substring(0, 50) + '...');
          // FIXED: Increment qIndex for AI insight follow-ups to track progress
          const newQIndex = qIndex + 1;
          console.log('📊 Progress updated: qIndex', qIndex, '→', newQIndex);
          return { currentQ: nextQ, lastAnswer: undefined, qIndex: newQIndex };
        }

        // FIXED: For conversational mode, if no AI follow-ups are available, 
        // we should wait for the next insight rather than falling back to structured questions
        console.log('⏳ No AI follow-ups available, waiting for next insight...');
        
        // Don't advance - stay on current question until AI generates a follow-up
        return s;
      }
      
      // structured: centralized advance with no double-increment on followups
      const { followup, question } = followupOrNext(lastAnswer, currentQ, qIndex);
      const isLastIndex = qIndex >= QUESTION_BANK.length - 1;
      if (!followup && isLastIndex) {
        return { finished: true, lastAnswer: undefined };
      }
      // If followup, do not increment base index
      return { currentQ: question, qIndex: followup ? qIndex : qIndex + 1, lastAnswer: undefined };
    });
  },
}));
