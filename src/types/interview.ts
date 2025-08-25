export type ID = string;

export interface InterviewSession {
  id: ID;
  candidateId: ID;
  jobId: ID;
  mode: "live" | "async";
  status: "scheduled" | "in_progress" | "completed" | "failed";
  createdAt: string; 
  startedAt?: string; 
  endedAt?: string;
  region: "us" | "eu" | "apac";
  consent: ConsentRecord;
  participants: ParticipantSnapshot[];
  media: MediaBundle;
  timeline: Event[];
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  transcripts: TranscriptSegment[]; // time-aligned
  llmRuns: LlmRun[];
  scoring: ScoringBundle;
  summary: InterviewSummary;
  audit: AuditTrail;
  retention: { days: number; deleteAt: string };
}

export interface ConsentRecord { 
  version: string; 
  videoAllowed: boolean; 
  acceptedAt: string; 
  policyVersion: string; 
}

export interface ParticipantSnapshot { 
  role: "candidate" | "interviewer" | "agent"; 
  userId?: ID; 
  modelVer?: string; 
  device?: string; 
  locale?: string; 
}

export interface MediaRef { 
  uri: string; 
  kind: "audio" | "video" | "screen"; 
  durationSec?: number; 
  codec?: string; 
  checksum?: string; 
  redacted?: boolean; 
}

export interface MediaBundle { 
  assets: MediaRef[]; 
}

export interface TranscriptSegment { 
  id: ID; 
  tStart: number; 
  tEnd: number; 
  speaker: "cand" | "intrv" | "agent"; 
  textRaw: string; 
  textClean?: string; 
  confidence?: number; 
  asrModel: string; 
}

export interface InterviewQuestion { 
  id: ID; 
  at: number; 
  type: "behavioral"|"coding"|"system_design"; 
  source: "ai"|"human"|"scripted";
  text: string; 
  llmRunId?: ID; 
  rubricKey?: string; 
}

export interface InterviewAnswer { 
  id: ID; 
  questionId: ID; 
  at: number; 
  transcriptRefs: ID[]; 
  attachments?: MediaRef[]; 
}

export interface LlmRun { 
  id: ID; 
  purpose: "generate_question"|"followup"|"summary"|"score";
  model: string; 
  params: Record<string, unknown>; 
  systemPrompt: string; 
  userPrompt: string; 
  output: string;
  ragSources?: { docId: ID; chunkIds: ID[] }[]; 
  tokens: { in: number; out: number }; 
  costUsd?: number; 
}

export interface ScoringItem { 
  rubric: string; 
  score: number; 
  weight: number; 
  rationale: string; 
  evaluator: "ai"|"human"|"blended"; 
}

export interface ScoringBundle { 
  items: ScoringItem[]; 
  finalScore: number; 
  decision: "hire"|"no_hire"|"hold"; 
}

export interface InterviewSummary { 
  strengths: string[]; 
  risks: string[]; 
  followUps: string[]; 
  level: "junior"|"mid"|"senior"; 
  skills: { name: string; confidence: number }[]; 
}

export interface Event { 
  at: number; 
  type: string; 
  data?: Record<string, unknown>; 
}

export interface AuditTrail { 
  events: { 
    at: string; 
    actor: "system"|ID; 
    action: string; 
    meta?: Record<string, unknown> 
  }[]; 
}

// Utility types for creating new sessions
export interface CreateInterviewSessionData {
  candidateId: ID;
  jobId: ID;
  mode: "live" | "async";
  region: "us" | "eu" | "apac";
  consent: Omit<ConsentRecord, 'acceptedAt'>;
  participants: ParticipantSnapshot[];
  retention: { days: number };
}

// Types for updating session data
export interface UpdateSessionStatusData {
  status: InterviewSession['status'];
  startedAt?: string;
  endedAt?: string;
}

export interface AddTranscriptSegmentData {
  segment: Omit<TranscriptSegment, 'id'>;
}

export interface AddQuestionData {
  question: Omit<InterviewQuestion, 'id' | 'at'>;
}

export interface AddAnswerData {
  answer: Omit<InterviewAnswer, 'id' | 'at'>;
}

export interface AddLlmRunData {
  run: Omit<LlmRun, 'id'>;
}

export interface UpdateScoringData {
  scoring: ScoringBundle;
}

export interface UpdateSummaryData {
  summary: InterviewSummary;
}

export interface AddAuditEventData {
  event: {
    actor: "system"|ID;
    action: string;
    meta?: Record<string, unknown>;
  };
}
