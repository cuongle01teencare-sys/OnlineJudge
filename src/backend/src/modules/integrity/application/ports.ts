import type { Language, Verdict } from '@oj/contracts';
import type { Actor } from '../../../shared/application/actor.js';

export interface SubmissionInfo {
  id: string;
  userId: string;
  userDisplayName: string;
  sessionId: string;
  problemKey: string;
  language: Language;
  code: string;
  verdict: Verdict | null;
  createdAt: Date;
}

/** Port (ACL) towards Judging. */
export abstract class SubmissionSource {
  abstract get(id: string): Promise<SubmissionInfo | null>;
  abstract ofProblem(sessionId: string, problemKey: string): Promise<SubmissionInfo[]>;
}

export interface SessionCheckInfo {
  checkPlagiarism: boolean;
  checkAiUsage: boolean;
  sessionTitle: string;
  problemTitle: string;
  statement: string;
}

/** Port (ACL) towards Assessment. */
export abstract class SessionAccess {
  abstract checkInfo(sessionId: string, problemKey: string): Promise<SessionCheckInfo | null>;
  abstract canReview(actor: Actor, sessionId: string): Promise<boolean>;
}

export interface AiReview {
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  reasons: string[];
  segments: { startLine: number; endLine: number; reason: string }[];
}

/** Port: an AI that estimates whether code was written with an AI assistant. Optional. */
export abstract class AiUsageReviewer {
  abstract get available(): boolean;
  abstract review(input: { statement: string; language: Language; code: string }): Promise<AiReview>;
}
