import type { Verdict } from '@oj/contracts';

/** Published language of the Judging context. */
export const SUBMISSION_JUDGED = 'judging.submission-judged';

export interface SubmissionJudgedEvent {
  name: typeof SUBMISSION_JUDGED;
  occurredAt: Date;
  submissionId: string;
  userId: string;
  userDisplayName: string;
  sessionId: string;
  problemKey: string;
  verdict: Verdict;
  /** 0..100 */
  score: number;
  submittedAt: Date;
}

export const REJUDGE_STARTED = 'judging.rejudge-started';

/** Submissions of a session (optionally one problem) are being judged again: progress must be rebuilt. */
export interface RejudgeStartedEvent {
  name: typeof REJUDGE_STARTED;
  occurredAt: Date;
  sessionId: string;
  problemKey: string | null;
}
