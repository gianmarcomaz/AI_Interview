import { 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  addDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  arrayUnion
} from 'firebase/firestore';
import { getFirebase } from './client';
import { 
  InterviewSession, 
  CreateInterviewSessionData,
  UpdateSessionStatusData,
  AddTranscriptSegmentData,
  AddQuestionData,
  AddAnswerData,
  AddLlmRunData,
  UpdateScoringData,
  UpdateSummaryData,
  AddAuditEventData,
  TranscriptSegment,
  InterviewQuestion,
  InterviewAnswer,
  LlmRun,
  ScoringBundle,
  InterviewSummary,
  ID
} from '@/types/interview';

export class InterviewService {
  private static generateId(): string {
    // Simple ID generator - replace with nanoid when available
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  private static getDb() {
    return getFirebase().db;
  }

  // Create a new interview session
  static async createSession(data: CreateInterviewSessionData): Promise<ID> {
    const sessionId = this.generateId();
    const now = this.getTimestamp();
    
    const session: InterviewSession = {
      id: sessionId,
      ...data,
      status: 'scheduled',
      createdAt: now,
      consent: {
        ...data.consent,
        acceptedAt: now
      },
      media: { assets: [] },
      timeline: [],
      questions: [],
      answers: [],
      transcripts: [],
      llmRuns: [],
      scoring: { items: [], finalScore: 0, decision: 'hold' },
      summary: { strengths: [], risks: [], followUps: [], level: 'mid', skills: [] },
      audit: { events: [] },
      retention: {
        ...data.retention,
        deleteAt: new Date(Date.now() + data.retention.days * 24 * 60 * 60 * 1000).toISOString()
      }
    };

    // Create the main session document
    await setDoc(doc(this.getDb(), 'sessions', sessionId), session);

    // Add initial audit event
    await this.addAuditEvent(sessionId, {
      event: {
        actor: 'system',
        action: 'session_created',
        meta: { mode: data.mode, region: data.region }
      }
    });

    return sessionId;
  }

  // Get a session by ID
  static async getSession(sessionId: ID): Promise<InterviewSession | null> {
    try {
      const docRef = doc(this.getDb(), 'sessions', sessionId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as InterviewSession;
      }
      return null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  // Update session status
  static async updateSessionStatus(sessionId: ID, data: UpdateSessionStatusData): Promise<void> {
    const updateData: Partial<InterviewSession> = {
      status: data.status,
      ...(data.startedAt && { startedAt: data.startedAt }),
      ...(data.endedAt && { endedAt: data.endedAt })
    };

    await updateDoc(doc(this.getDb(), 'sessions', sessionId), updateData);

    // Add audit event
    await this.addAuditEvent(sessionId, {
      event: {
        actor: 'system',
        action: `status_changed_to_${data.status}`,
        meta: { previousStatus: data.status }
      }
    });
  }

  // Add transcript segment
  static async addTranscriptSegment(sessionId: ID, data: AddTranscriptSegmentData): Promise<ID> {
    const segmentId = this.generateId();
    const segment: TranscriptSegment = {
      id: segmentId,
      ...data.segment
    };

    // Use arrayUnion to atomically add to transcripts array - NO RACE CONDITIONS
    await updateDoc(doc(this.getDb(), 'sessions', sessionId), {
      transcripts: arrayUnion(segment)
    });

    // Add audit event
    await this.addAuditEvent(sessionId, {
      event: {
        actor: 'system',
        action: 'transcript_segment_added',
        meta: { segmentId, speaker: data.segment.speaker, duration: data.segment.tEnd - data.segment.tStart }
      }
    });

    return segmentId;
  }

  // Add interview question
  static async addQuestion(sessionId: ID, data: AddQuestionData): Promise<ID> {
    const questionId = this.generateId();
    const question: InterviewQuestion = {
      id: questionId,
      at: Date.now(),
      ...data.question
    };

    // Use arrayUnion to atomically add to questions array - NO RACE CONDITIONS
    await updateDoc(doc(this.getDb(), 'sessions', sessionId), {
      questions: arrayUnion(question)
    });

    // Add audit event
    await this.addAuditEvent(sessionId, {
      event: {
        actor: 'system',
        action: 'question_added',
        meta: { questionId, type: data.question.type, source: data.question.source }
      }
    });

    return questionId;
  }

  // Add interview answer
  static async addAnswer(sessionId: ID, data: AddAnswerData): Promise<ID> {
    const answerId = this.generateId();
    const answer: InterviewAnswer = {
      id: answerId,
      at: Date.now(),
      ...data.answer
    };

    // Use arrayUnion to atomically add to answers array - NO RACE CONDITIONS
    await updateDoc(doc(this.getDb(), 'sessions', sessionId), {
      answers: arrayUnion(answer)
    });

    // Add audit event
    await this.addAuditEvent(sessionId, {
      event: {
        actor: 'system',
        action: 'answer_added',
        meta: { answerId, questionId: data.answer.questionId }
      }
    });

    return answerId;
  }

  // Add LLM run
  static async addLlmRun(sessionId: ID, data: AddLlmRunData): Promise<ID> {
    const runId = this.generateId();
    const run: LlmRun = {
      id: runId,
      ...data.run
    };

    // Use arrayUnion to atomically add to llmRuns array - NO RACE CONDITIONS
    await updateDoc(doc(this.getDb(), 'sessions', sessionId), {
      llmRuns: arrayUnion(run)
    });

    // Add audit event
    await this.addAuditEvent(sessionId, {
      event: {
        actor: 'system',
        action: 'llm_run_added',
        meta: { runId, purpose: data.run.purpose, model: data.run.model }
      }
    });

    return runId;
  }

  // Update scoring
  static async updateScoring(sessionId: ID, data: UpdateScoringData): Promise<void> {
    await updateDoc(doc(this.getDb(), 'sessions', sessionId), {
      scoring: data.scoring
    });

    // Add audit event
    await this.addAuditEvent(sessionId, {
      event: {
        actor: 'system',
        action: 'scoring_updated',
        meta: { finalScore: data.scoring.finalScore, decision: data.scoring.decision }
      }
    });
  }

  // Update summary
  static async updateSummary(sessionId: ID, data: UpdateSummaryData): Promise<void> {
    await updateDoc(doc(this.getDb(), 'sessions', sessionId), {
      summary: data.summary
    });

    // Add audit event
    await this.addAuditEvent(sessionId, {
      event: {
        actor: 'system',
        action: 'summary_updated',
        meta: { level: data.summary.level, skillsCount: data.summary.skills.length }
      }
    });
  }

  // Add audit event
  static async addAuditEvent(sessionId: ID, data: AddAuditEventData): Promise<void> {
    const event = {
      at: this.getTimestamp(),
      ...data.event
    };

    // Use arrayUnion to atomically add to audit.events array - NO RACE CONDITIONS
    await updateDoc(doc(this.getDb(), 'sessions', sessionId), {
      'audit.events': arrayUnion(event)
    });
  }

  // Add media asset
  static async addMediaAsset(sessionId: ID, asset: {
    uri: string;
    kind: "audio" | "video" | "screen";
    durationSec?: number;
    codec?: string;
    checksum?: string;
    redacted?: boolean;
  }): Promise<void> {
    const mediaRef = {
      ...asset,
      id: this.generateId()
    };

    // Use arrayUnion to atomically add to media.assets array - NO RACE CONDITIONS
    await updateDoc(doc(this.getDb(), 'sessions', sessionId), {
      'media.assets': arrayUnion(mediaRef)
    });

    // Add audit event
    await this.addAuditEvent(sessionId, {
      event: {
        actor: 'system',
        action: 'media_asset_added',
        meta: { kind: asset.kind, duration: asset.durationSec, redacted: asset.redacted }
      }
    });
  }

  // Add timeline event
  static async addTimelineEvent(sessionId: ID, event: {
    type: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    const timelineEvent = {
      at: Date.now(),
      ...event
    };

    // Use arrayUnion to atomically add to timeline array - NO RACE CONDITIONS
    await updateDoc(doc(this.getDb(), 'sessions', sessionId), {
      timeline: arrayUnion(timelineEvent)
    });
  }

  // Get sessions by campaign/job
  static async getSessionsByJob(jobId: ID): Promise<InterviewSession[]> {
    try {
      const q = query(
        collection(this.getDb(), 'sessions'),
        where('jobId', '==', jobId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as InterviewSession);
    } catch (error) {
      console.error('Error getting sessions by job:', error);
      return [];
    }
  }

  // Get sessions by candidate
  static async getSessionsByCandidate(candidateId: ID): Promise<InterviewSession[]> {
    try {
      const q = query(
        collection(this.getDb(), 'sessions'),
        where('candidateId', '==', candidateId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as InterviewSession);
    } catch (error) {
      console.error('Error getting sessions by candidate:', error);
      return [];
    }
  }

  // Delete session (for data retention compliance)
  static async deleteSession(sessionId: ID): Promise<void> {
    try {
      await deleteDoc(doc(this.getDb(), 'sessions', sessionId));
      
      // Add audit event to a separate audit collection before deletion
      await addDoc(collection(this.getDb(), 'deleted_sessions_audit'), {
        sessionId,
        deletedAt: this.getTimestamp(),
        reason: 'retention_policy'
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  // Batch update multiple fields
  static async batchUpdateSession(sessionId: ID, updates: Partial<InterviewSession>): Promise<void> {
    await updateDoc(doc(this.getDb(), 'sessions', sessionId), updates);
  }

  // Get session statistics
  static async getSessionStats(sessionId: ID): Promise<{
    totalQuestions: number;
    totalAnswers: number;
    totalTranscriptSegments: number;
    totalLlmRuns: number;
    duration?: number;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const duration = session.endedAt && session.startedAt 
      ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
      : undefined;

    return {
      totalQuestions: session.questions.length,
      totalAnswers: session.answers.length,
      totalTranscriptSegments: session.transcripts.length,
      totalLlmRuns: session.llmRuns.length,
      duration
    };
  }
}
