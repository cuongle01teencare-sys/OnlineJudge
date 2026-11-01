import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JudgeSubmission } from '../src/application/judge-submission';
import { outputsMatch } from '../src/domain/output-checker';
import { LocalSandbox } from '../src/infrastructure/local-sandbox';

test('output checker ignores trailing whitespace and CRLF', () => {
  assert.ok(outputsMatch('1 2 \r\n3\r\n\r\n', '1 2\n3'));
  assert.ok(!outputsMatch('1 2', '1  2'));
});

const job = (sourceCode: string) => ({
  submissionId: 's1',
  judgeRun: 1,
  language: 'python' as const,
  sourceCode,
  timeLimitMs: 2000,
  memoryLimitMb: 256,
  testCases: [
    { id: 't1', input: '1 2\n', expectedOutput: '3\n', points: 1 },
    { id: 't2', input: '10 20\n', expectedOutput: '30\n', points: 1 },
  ],
});

const judge = new JudgeSubmission(new LocalSandbox());

test('accepts a correct python solution', async () => {
  const r = await judge.execute(job('a, b = map(int, input().split())\nprint(a + b)\n'));
  assert.equal(r.verdict, 'AC');
  assert.deepEqual(r.testResults.map((t) => t.points), [1, 1]);
});

test('wrong answer and runtime error', async () => {
  assert.equal((await judge.execute(job('print(3)\n'))).verdict, 'WA');
  assert.equal((await judge.execute(job('raise SystemExit(1)\n'))).verdict, 'RE');
});

test('compile error for invalid python', async () => {
  const r = await judge.execute(job('def (:\n'));
  assert.equal(r.verdict, 'CE');
});

test('time limit exceeded', async () => {
  const r = await judge.execute({ ...job('while True: pass\n'), timeLimitMs: 300 });
  assert.equal(r.verdict, 'TLE');
});
