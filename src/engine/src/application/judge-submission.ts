import type { JudgeJob, JudgeResultMessage, TestCaseResult } from '@oj/contracts';
import { languageSpecFor, withMemory } from '../domain/language';
import type { Sandbox } from '../domain/sandbox';
import { classifyRun, overallVerdict } from '../domain/verdict';

const COMPILE_TIMEOUT_MS = 30_000;
const MAX_MESSAGE = 2_000;

type FinishedMessage = Extract<JudgeResultMessage, { type: 'finished' }>;

/** Use case: compile a submission once, then run it against every test case in order. */
export class JudgeSubmission {
  constructor(private readonly sandbox: Sandbox) {}

  async execute(job: JudgeJob): Promise<FinishedMessage> {
    const spec = languageSpecFor(job.language, job.sourceCode);
    const session = await this.sandbox.open({
      files: [{ name: spec.sourceFile, content: job.sourceCode }],
      memoryLimitMb: job.memoryLimitMb + spec.memoryOverheadMb,
    });

    try {
      if (spec.compile) {
        const compiled = await session.exec(spec.compile, COMPILE_TIMEOUT_MS);
        if (compiled.exitCode !== 0 || compiled.timedOut) {
          const output = (compiled.stderr || compiled.stdout).slice(0, 10_000);
          return {
            type: 'finished',
            submissionId: job.submissionId,
            judgeRun: job.judgeRun,
            verdict: 'CE',
            compileOutput: compiled.timedOut ? 'Biên dịch quá thời gian cho phép.' : output,
            testResults: [],
          };
        }
      }

      const limits = { timeLimitMs: job.timeLimitMs, memoryLimitMb: job.memoryLimitMb };
      const argv = withMemory(spec.run, job.memoryLimitMb);
      const testResults: TestCaseResult[] = [];
      for (const testCase of job.testCases) {
        const run = await session.run(argv, testCase.input, limits);
        const verdict = classifyRun(run, testCase.expectedOutput, limits);
        testResults.push({
          testCaseId: testCase.id,
          verdict,
          // A killed process may report little CPU time; show at least the limit for TLE.
          timeMs: Math.round(verdict === 'TLE' ? Math.max(run.timeMs, job.timeLimitMs) : run.timeMs),
          memoryKb: run.memoryKb,
          points: verdict === 'AC' ? testCase.points : 0,
          message: verdict === 'RE' ? run.stderr.slice(0, MAX_MESSAGE) || `Exit code ${run.exitCode}` : undefined,
        });
      }

      return {
        type: 'finished',
        submissionId: job.submissionId,
        judgeRun: job.judgeRun,
        verdict: testResults.length ? overallVerdict(testResults) : 'IE',
        testResults,
      };
    } finally {
      await session.dispose();
    }
  }
}
