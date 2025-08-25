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
  lastInsight?: { schema_version: 1; turn_id: string; summary: string; tags: string[]; citations?: string[]; flags?: string[] };
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
  setCampaign(id?: string): void;
  setMode(m: 'structured'|'conversational'): void;
  setLLMMode(m: 'cloud'|'rules'): void;
  setLang(lang: string): void;
  setTtsVoice(v?: string): void;
  setConsent(v: boolean): void;
  start(): void; 
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

  setCampaign(id) { set({ campaignId: id }); },
  setMode(m) { set({ mode: m }); },
  setLLMMode(m) { set({ llmMode: m }); },
  setLang(lang) { set({ lang }); },
  setTtsVoice(v) { set({ ttsVoice: v }); },
  setConsent(v) { set({ consentAccepted: v }); },
  start() { set({ started: true, finished: false, qIndex: 0, askedIds: [], currentQ: pickInitial(), transcript: [], partial: '', lastAnswer: undefined }); },
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
  advance: () => {
    if (__advancing) return;
    __advancing = true;
    setTimeout(() => { __advancing = false; }, 300);

    set((s) => {
      if (s.finished) return s;

      const { mode, lastAnswer, currentQ, qIndex, askedIds, followupQueue } = s;

      if (mode === 'conversational') {
        // Prioritize AI-generated follow-ups from the queue
        if (followupQueue.length > 0) {
          const nextFollowup = s.dequeueFollowup();
          if (nextFollowup) {
            const nextQ: Question = { 
              ...currentQ, 
              id: currentQ.id + '-ai-followup', 
              text: nextFollowup 
            };
            return { currentQ: nextQ, lastAnswer: undefined };
          }
        }

        // Fallback to existing conversational logic if no AI follow-ups
        const isFollowup = /-f$/.test(currentQ.id);
        const baseId = currentQ.id.replace(/(?:-f)+$/, '');
        const hasAnswer = !!(lastAnswer && lastAnswer.trim().length > 0);
        const short = !hasAnswer || (lastAnswer!.trim().length < 60 || lastAnswer!.split(/\s+/).length < 10);

        // If short and not already a follow-up, ask one follow-up, then stop
        if (short && !isFollowup) {
          const updatedAsked = Array.from(new Set([ ...askedIds, baseId ]));
          const nextQ: Question = { ...currentQ, id: baseId+'-f', text: 'Could you add concrete metrics or a specific example?' };
          return { currentQ: nextQ, lastAnswer: undefined, askedIds: updatedAsked };
        }

        // Otherwise advance to the next unasked base question
        const updatedAsked = Array.from(new Set([ ...askedIds, baseId ]));
        const allAsked = updatedAsked.length >= QUESTION_BANK.length;
        if (allAsked) { return { finished: true, lastAnswer: undefined, askedIds: updatedAsked }; }
        const nextBase = pickNextDynamic(hasAnswer ? lastAnswer : baseId, updatedAsked);
        return { currentQ: nextBase, lastAnswer: undefined, askedIds: updatedAsked };
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
