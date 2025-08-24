export type Question = { id: string; text: string; topic: 'intro'|'systems'|'ml'|'behavioral'; difficulty: 1|2|3 };

export const QUESTION_BANK: Question[] = [
  { id:'q1', text:'Give me a 30s overview of your background.', topic:'intro', difficulty:1 },
  { id:'q2', text:'How would you keep p95 <1s in a live STT to summary pipeline?', topic:'systems', difficulty:2 },
  { id:'q3', text:'Describe backpressure and how you would apply it to streaming.', topic:'systems', difficulty:2 },
  { id:'q4', text:'ARIMA vs LSTM for time-series; when does ARIMA win?', topic:'ml', difficulty:2 },
  { id:'q5', text:'Walk through a time you reduced latency. Baseline, actions, result.', topic:'behavioral', difficulty:2 },
  { id:'q6', text:'How would you ground LLM answers in documentation (RAG)?', topic:'ml', difficulty:2 },
  { id:'q7', text:'If transcripts get noisy, how do you keep summaries robust?', topic:'systems', difficulty:3 },
  { id:'q8', text:'Tradeoffs: cost vs latency vs quality - give a concrete example.', topic:'behavioral', difficulty:3 },
];

export function pickInitial(): Question { return QUESTION_BANK[0]; }

export function followupOrNext(lastAnswer: string|undefined, lastQ: Question, idx: number) {
  const short = (lastAnswer ?? '').trim().length < 60 || (lastAnswer ?? '').split(/\s+/).length < 10;
  if (short && !/-f$/.test(lastQ.id)) {
    return { followup: true, question: { ...lastQ, id: lastQ.id+'-f', text: 'Could you add concrete metrics or a specific example?' } };
  }
  // else advance
  const next = QUESTION_BANK[idx+1] ?? QUESTION_BANK[QUESTION_BANK.length-1];
  return { followup: false, question: next };
}

// Very simple dynamic question picker for a conversational feel.
// Scores remaining questions by keyword/topic relevance and difficulty ramp.
export function pickNextDynamic(lastAnswer: string|undefined, askedIds: string[]): Question {
  const answer = (lastAnswer ?? '').toLowerCase();
  const keywordsByTopic: Record<Question['topic'], string[]> = {
    intro: ['background', 'experience', 'overview', 'summary'],
    systems: ['latency', 'throughput', 'scal', 'queue', 'stream', 'backpressure', 'p95', 'availability'],
    ml: ['model', 'lstm', 'arima', 'rag', 'embedding', 'training', 'inference'],
    behavioral: ['team', 'conflict', 'impact', 'result', 'lead', 'ownership']
  };

  const askedSet = new Set(askedIds.map(id => id.replace(/(?:-f)+$/, '')));
  const remaining = QUESTION_BANK.filter(q => !askedSet.has(q.id));
  if (remaining.length === 0) return QUESTION_BANK[QUESTION_BANK.length-1];

  const score = (q: Question) => {
    let s = 0;
    for (const kw of keywordsByTopic[q.topic]) {
      if (answer.includes(kw)) s += 3;
    }
    // Prefer to cover unasked topics first
    s += (3 - q.difficulty); // slight bias to easier first
    return s;
  };

  const sorted = remaining.slice().sort((a,b)=>score(b)-score(a));
  // Guarantee progress: if best score is tie with the same topic repeatedly, rotate by index
  return sorted[0] ?? remaining[0];
}
