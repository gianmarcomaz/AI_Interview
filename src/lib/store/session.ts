'use client';
import { create } from 'zustand';
import { Question, QUESTION_BANK, pickInitial, followupOrNext, pickNextDynamic } from '@/lib/fsm/agent';

export type Turn = { text: string; final: boolean; ts: number };

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
  llmMode: 'local'|'cloud'|'rules';
  rollingSummary: string;
  lastInsight?: { schema_version: 1; turn_id: string; summary: string; tags: string[]; citations?: string[]; flags?: string[] };
  lastLatencyMs?: number;
  tagTally: Record<string, number>;
  // Multilingual support
  ttsVoice?: string;
  setCampaign(id?: string): void;
  setMode(m: 'structured'|'conversational'): void;
  setLLMMode(m: 'local'|'cloud'|'rules'): void;
  setLang(lang: string): void;
  setTtsVoice(v?: string): void;
  start(): void; 
  stop(): void;
  setPartial(t: string): void;
  pushFinal(t: string, ts: number): void;
  updateRolling(): void;
  next(): void;
  repeat(): void;
  setInsight(i: { schema_version: 1; turn_id: string; summary: string; tags: string[]; citations?: string[]; flags?: string[] }, latency: number): void;
};

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
  llmMode: 'local',
  rollingSummary: '',
  lastInsight: undefined,
  lastLatencyMs: undefined,
  tagTally: {},
  ttsVoice: undefined,

  setCampaign(id) { set({ campaignId: id }); },
  setMode(m) { set({ mode: m }); },
  setLLMMode(m) { set({ llmMode: m }); },
  setLang(lang) { set({ lang }); },
  setTtsVoice(v) { set({ ttsVoice: v }); },
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
  next() {
    const { lastAnswer, currentQ, qIndex, mode, askedIds } = get();
    if (get().finished) return;
    if (mode === 'conversational') {
      // 2-turn policy per base question: Question -> optional Follow-up -> Next base
      const isFollowup = /-f$/.test(currentQ.id);
      const baseId = currentQ.id.replace(/(?:-f)+$/, '');
      const hasAnswer = !!(lastAnswer && lastAnswer.trim().length > 0);
      const short = !hasAnswer || (lastAnswer!.trim().length < 60 || lastAnswer!.split(/\s+/).length < 10);

      // If short and not already a follow-up, ask one follow-up, then stop
      if (short && !isFollowup) {
        const updatedAsked = Array.from(new Set([ ...askedIds, baseId ]));
        const nextQ: Question = { ...currentQ, id: baseId+'-f', text: 'Could you add concrete metrics or a specific example?' };
        set({ currentQ: nextQ, lastAnswer: undefined, askedIds: updatedAsked });
        return;
      }

      // Otherwise advance to the next unasked base question
      const updatedAsked = Array.from(new Set([ ...askedIds, baseId ]));
      const allAsked = updatedAsked.length >= QUESTION_BANK.length;
      if (allAsked) { set({ finished: true, lastAnswer: undefined, askedIds: updatedAsked }); return; }
      const nextBase = pickNextDynamic(hasAnswer ? lastAnswer : baseId, updatedAsked);
      set({ currentQ: nextBase, lastAnswer: undefined, askedIds: updatedAsked });
      return;
    }
    // structured
    const { followup, question } = followupOrNext(lastAnswer, currentQ, qIndex);
    const isLastIndex = qIndex >= QUESTION_BANK.length - 1;
    if (!followup && isLastIndex) {
      // End of deck
      set({ finished: true, lastAnswer: undefined });
      return;
    }
    set({ currentQ: question, qIndex: followup ? qIndex : Math.min(qIndex+1, 999), lastAnswer: undefined });
  },
  repeat() { /* no state change; handled by TTS invoke in UI */ },
  setInsight(i, latency) {
    const tally = { ...get().tagTally };
    (i.tags || []).forEach(tag => { tally[tag] = (tally[tag] ?? 0) + 1; });
    set({ lastInsight: i, lastLatencyMs: latency, tagTally: tally });
  },
}));
