import type { JudgeJob, JudgeJobTestCase } from '@oj/contracts';
import type { Language } from '@oj/contracts';
import type { Actor } from '../../../shared/application/actor.js';

/** What a user may see of their own results in a session right now. */
export type ResultVisibility = 'FULL' | 'SCORE_ONLY' | 'HIDDEN';

export interface SubmissionTarget {
  sessionTitle: string;
  problemTitle: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  testCases: JudgeJobTestCase[];
  /** Empty = every language. */
  allowedLanguages: Language[];
  maxSubmissions: number | null;
}

/** Port (ACL) towards the Assessment context: sessions decide who may submit what. */
export abstract class SessionGateway {
  /** Throws when the actor may not submit to this session problem right now. */
  abstract prepareSubmission(actor: Actor, sessionId: string, problemKey: string): Promise<SubmissionTarget>;
  abstract canReview(actor: Actor, sessionId: string): Promise<boolean>;
  /** Current test data of a session problem, for rejudging; null when the session no longer has that problem. */
  abstract judgeTarget(sessionId: string, problemKey: string): Promise<SubmissionTarget | null>;
  abstract visibility(actor: Actor, sessionIds: string[]): Promise<Map<string, ResultVisibility>>;
}

/** Port: hands work to the judge engine. */
export abstract class JudgeQueue {
  abstract enqueue(job: JudgeJob): Promise<void>;
}
