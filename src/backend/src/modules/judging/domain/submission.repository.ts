import type { Submission } from './submission.js';

export abstract class SubmissionRepository {
  abstract findById(id: string): Promise<Submission | null>;
  abstract save(submission: Submission): Promise<void>;
  abstract countUnfinishedByUser(userId: string): Promise<number>;
  /** Submissions (any status) of a user for one problem of a session. */
  abstract countForProblem(userId: string, sessionId: string, problemKey: string): Promise<number>;
  abstract findBySession(sessionId: string, problemKey: string | null): Promise<Submission[]>;
}

export interface SubmissionListFilter {
  userId?: string;
  sessionId?: string;
  problemKey?: string;
  page: number;
  pageSize: number;
}

/** Read-side port. */
export abstract class SubmissionQueries {
  abstract list(filter: SubmissionListFilter): Promise<{ items: Submission[]; total: number }>;
}
