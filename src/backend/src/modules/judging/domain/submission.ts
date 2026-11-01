import { Languages, type Language, type SubmissionStatus, type TestCaseResult, type Verdict } from '@oj/contracts';
import { AggregateRoot, newId } from '../../../shared/domain/aggregate-root.js';
import { assert } from '../../../shared/domain/domain-error.js';
import { SUBMISSION_JUDGED, type SubmissionJudgedEvent } from '../judging.events.js';

const MAX_SOURCE_BYTES = 64 * 1024;

export class SourceCode {
  private constructor(
    readonly language: Language,
    readonly text: string,
  ) {}

  static of(language: Language, text: string): SourceCode {
    assert(Languages.includes(language), 'judging.invalid_language', 'Ngôn ngữ không được hỗ trợ.');
    assert(text.trim().length > 0, 'judging.empty_source', 'Mã nguồn không được để trống.');
    assert(Buffer.byteLength(text) <= MAX_SOURCE_BYTES, 'judging.source_too_large', 'Mã nguồn tối đa 64KB.');
    return new SourceCode(language, text);
  }
}

export interface SubmissionState {
  userId: string;
  userDisplayName: string;
  sessionId: string;
  sessionTitle: string;
  problemKey: string;
  problemTitle: string;
  source: SourceCode;
  /** Sum of test points of the current judge run; used to compute the 0..100 score. */
  totalPoints: number;
  /** 1 for the first judging, +1 per rejudge. Results of older runs are ignored. */
  judgeRun: number;
  status: SubmissionStatus;
  verdict: Verdict | null;
  score: number;
  compileOutput: string | null;
  testResults: TestCaseResult[];
  createdAt: Date;
  judgedAt: Date | null;
}

export type NewSubmission = Pick<
  SubmissionState,
  'userId' | 'userDisplayName' | 'sessionId' | 'sessionTitle' | 'problemKey' | 'problemTitle' | 'source' | 'totalPoints'
>;

/**
 * Submission aggregate: one attempt at a problem of a session. Lifecycle: PENDING -> JUDGING -> DONE.
 * Titles and the user name are snapshotted so history stays readable after sessions or classes are gone.
 */
export class Submission extends AggregateRoot {
  private constructor(id: string, private state: SubmissionState) {
    super(id);
  }

  static submit(input: NewSubmission): Submission {
    return new Submission(newId(), {
      ...input,
      judgeRun: 1,
      status: 'PENDING',
      verdict: null,
      score: 0,
      compileOutput: null,
      testResults: [],
      createdAt: new Date(),
      judgedAt: null,
    });
  }

  static rehydrate(id: string, state: SubmissionState): Submission {
    return new Submission(id, state);
  }

  get snapshot(): Readonly<SubmissionState> {
    return this.state;
  }

  get maxTimeMs(): number | null {
    return this.state.testResults.length ? Math.max(...this.state.testResults.map((t) => t.timeMs)) : null;
  }

  get maxMemoryKb(): number | null {
    return this.state.testResults.length ? Math.max(...this.state.testResults.map((t) => t.memoryKb)) : null;
  }

  /** Results from an older judge run (before a rejudge) must be ignored. */
  isCurrentRun(judgeRun: number): boolean {
    return judgeRun === this.state.judgeRun;
  }

  /** Idempotent: late or duplicated "started" messages are ignored. */
  startJudging(): void {
    if (this.state.status === 'PENDING') this.state.status = 'JUDGING';
  }

  /** Back to the queue with (possibly new) test data; returns the new run number. */
  rejudge(totalPoints: number): number {
    this.state = {
      ...this.state,
      totalPoints,
      judgeRun: this.state.judgeRun + 1,
      status: 'PENDING',
      verdict: null,
      score: 0,
      compileOutput: null,
      testResults: [],
      judgedAt: null,
    };
    return this.state.judgeRun;
  }

  complete(verdict: Verdict, testResults: TestCaseResult[], compileOutput: string | null): void {
    if (this.state.status === 'DONE') return;
    const earned = testResults.reduce((sum, t) => sum + t.points, 0);
    const total = this.state.totalPoints;
    this.state = {
      ...this.state,
      status: 'DONE',
      verdict,
      testResults,
      compileOutput,
      score: verdict === 'AC' ? 100 : total > 0 ? Math.round((earned / total) * 10000) / 100 : 0,
      judgedAt: new Date(),
    };
    const s = this.state;
    const event: SubmissionJudgedEvent = {
      name: SUBMISSION_JUDGED,
      occurredAt: new Date(),
      submissionId: this.id,
      userId: s.userId,
      userDisplayName: s.userDisplayName,
      sessionId: s.sessionId,
      problemKey: s.problemKey,
      verdict,
      score: s.score,
      submittedAt: s.createdAt,
    };
    this.record(event);
  }

  /** The queue could not accept the job. */
  failToEnqueue(reason: string): void {
    this.complete('IE', [], reason);
  }
}
