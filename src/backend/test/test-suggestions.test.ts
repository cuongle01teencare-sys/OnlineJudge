import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestCaseSuggestionsDto } from '@oj/contracts';
import type { Actor } from '../src/shared/application/actor.js';
import { TestCaseSuggester, type TestSuggestionContext } from '../src/modules/catalog/application/ports.js';
import { ProblemService } from '../src/modules/catalog/application/problem.service.js';
import { Problem, ResourceLimits } from '../src/modules/catalog/domain/problem.js';
import type { ProblemQueries, ProblemRepository } from '../src/modules/catalog/domain/problem.repository.js';
import type { EventPublisher } from '../src/shared/application/event-publisher.js';

const teacher: Actor = { id: 't1', role: 'TEACHER', name: 'Lan' };
const other: Actor = { id: 't2', role: 'TEACHER', name: 'Minh' };

function sumProblem(): Problem {
  const problem = Problem.create(1, { id: teacher.id, name: teacher.name }, {
    title: 'Tổng hai số', difficulty: 'EASY', tags: [], statement: 'Tính a + b.',
    inputFormat: 'Hai số a, b.', outputFormat: 'Tổng a + b.', constraints: '|a|, |b| ≤ 10^9',
  }, ResourceLimits.default);
  problem.addTestCase({ input: '1 2\n', expectedOutput: '3\n', isSample: true, points: 10 });
  return problem;
}

class FakeSuggester extends TestCaseSuggester {
  seen: TestSuggestionContext | null = null;
  constructor(private readonly result: TestCaseSuggestionsDto | Error, readonly available = true) {
    super();
  }
  async suggest(context: TestSuggestionContext) {
    this.seen = context;
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

function service(problem: Problem, suggester: TestCaseSuggester) {
  const repo = { findById: async (id: string) => (id === problem.id ? problem : null) } as unknown as ProblemRepository;
  return new ProblemService(repo, {} as ProblemQueries, {} as EventPublisher, suggester);
}

const suggestion = (input: string, expectedOutput: string) => ({ input, expectedOutput, purpose: 'x', outputVerified: true });

test('suggestions skip inputs the problem already has, and repeats', async () => {
  const problem = sumProblem();
  const fake = new FakeSuggester({
    suggestions: [suggestion(' 1  2 ', '3\n'), suggestion('-5 5\n', '0\n'), suggestion('-5\n5\n', '0\n'), suggestion('0 0\n', '0\n')],
    notes: [],
  });
  const result = await service(problem, fake).suggestTestCases(teacher, problem.id, { count: 4, focus: '  số âm ' });
  assert.deepEqual(result.suggestions.map((s) => s.input), ['-5 5\n', '0 0\n']);
  assert.equal(fake.seen?.focus, 'số âm');
  assert.equal(fake.seen?.existingTests.length, 1);
  assert.equal(problem.testCases.length, 1, 'nothing is saved');
});

test('only editors may ask, and only when the AI is configured', async () => {
  const problem = sumProblem();
  const ok = { suggestions: [], notes: [] };
  await assert.rejects(service(problem, new FakeSuggester(ok)).suggestTestCases(other, problem.id, {}), /Không tìm thấy bài tập|sở hữu/);
  await assert.rejects(service(problem, new FakeSuggester(ok, false)).suggestTestCases(teacher, problem.id, {}), /chưa cấu hình AI/);
});

test('an AI failure becomes a friendly error', async () => {
  const problem = sumProblem();
  await assert.rejects(
    service(problem, new FakeSuggester(new Error('overloaded'))).suggestTestCases(teacher, problem.id, {}),
    /AI chưa gợi ý được test/,
  );
});
