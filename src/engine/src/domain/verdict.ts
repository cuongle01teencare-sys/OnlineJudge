import type { TestCaseResult, Verdict } from '@oj/contracts';
import { outputsMatch } from './output-checker';
import type { RunLimits, RunResult } from './sandbox';

/** Classifies a single run against its expected output. */
export function classifyRun(run: RunResult, expectedOutput: string, limits: RunLimits): Verdict {
  if (run.timedOut || run.timeMs > limits.timeLimitMs) return 'TLE';
  if (run.memoryKb > limits.memoryLimitMb * 1024) return 'MLE';
  if (run.killed) return 'MLE';
  if (run.exitCode !== 0) return 'RE';
  return outputsMatch(run.stdout, expectedOutput) ? 'AC' : 'WA';
}

/** Overall verdict = verdict of the first failing test (tests are run in order), AC if all pass. */
export function overallVerdict(results: TestCaseResult[]): Verdict {
  return results.find((r) => r.verdict !== 'AC')?.verdict ?? 'AC';
}
