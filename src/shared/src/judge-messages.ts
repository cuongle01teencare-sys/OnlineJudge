import type { Language, Verdict } from './enums';

/** Queue names shared by the backend (producer) and the engine (consumer). */
export const JUDGE_JOBS_QUEUE = 'judge-jobs';
export const JUDGE_RESULTS_QUEUE = 'judge-results';

export interface JudgeJobTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  points: number;
}

/** Message sent from the backend to the engine. Self-contained: the engine never touches the database. */
export interface JudgeJob {
  submissionId: string;
  /** Incremented on every rejudge; results of an older run are ignored. */
  judgeRun: number;
  language: Language;
  sourceCode: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  testCases: JudgeJobTestCase[];
}

export interface TestCaseResult {
  testCaseId: string;
  verdict: Verdict;
  timeMs: number;
  memoryKb: number;
  /** Points earned on this test (0 unless AC). */
  points: number;
  /** Short diagnostic (e.g. runtime error excerpt). */
  message?: string;
}

export type JudgeResultMessage =
  | { type: 'started'; submissionId: string; judgeRun: number }
  | {
      type: 'finished';
      submissionId: string;
      judgeRun: number;
      verdict: Verdict;
      compileOutput?: string;
      testResults: TestCaseResult[];
    };
