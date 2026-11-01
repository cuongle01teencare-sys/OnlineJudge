import type { BankScope } from '@oj/contracts';
import type { ProblemSet } from './problem-set.js';
import type { Attempt, Session } from './session.js';

export abstract class AttemptRepository {
  abstract find(sessionId: string, userId: string): Promise<Attempt | null>;
  abstract findForUser(userId: string, sessionIds: string[]): Promise<Attempt[]>;
  abstract save(attempt: Attempt): Promise<void>;
  abstract deleteBySession(sessionId: string): Promise<void>;
}

export abstract class ProblemSetRepository {
  abstract findById(id: string): Promise<ProblemSet | null>;
  abstract list(scope: BankScope, viewerId: string): Promise<ProblemSet[]>;
  abstract findContainingProblem(problemId: string): Promise<ProblemSet[]>;
  abstract save(set: ProblemSet): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

export interface SessionFilter {
  /** Restrict to these classes; 'ALL' = no restriction. */
  classIds: string[] | 'ALL';
  includePublic: boolean;
  includeClass: boolean;
}

export abstract class SessionRepository {
  abstract findById(id: string): Promise<Session | null>;
  abstract list(filter: SessionFilter): Promise<Session[]>;
  abstract findByClass(classId: string): Promise<Session[]>;
  /** Listing-level session (no test data) assigned from that bank item to that audience. */
  abstract findByAssignmentKey(key: string): Promise<Session | null>;
  abstract save(session: Session): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
