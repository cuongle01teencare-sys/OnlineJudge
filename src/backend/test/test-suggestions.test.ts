import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestCaseSuggestionsDto } from '@oj/contracts';
import type { Actor } from '../src/shared/application/actor.js';
import { ProblemSectionWriter, TestCaseSuggester, type TestSuggestionContext, type TextSection } from '../src/modules/catalog/application/ports.js';
import { ProblemService } from '../src/modules/catalog/application/problem.service.js';
import { UnshareChecks } from '../src/modules/catalog/application/unshare-checks.js';
import { Problem, ResourceLimits } from '../src/modules/catalog/domain/problem.js';
import type { ProblemQueries, ProblemRepository } from '../src/modules/catalog/domain/problem.repository.js';
import { AiAccess } from '../src/shared/application/ai-access.js';
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

class FakeWriter extends ProblemSectionWriter {
  constructor(private readonly result: { text: string; notes: string[] } | Error, readonly available = true) {
    super();
  }
  async write(_section: TextSection) {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

/** VIP teachers (and administrators) may use AI; `allowed` lists them. */
class FakeAiAccess extends AiAccess {
  constructor(private readonly allowed: string[] = [teacher.id, other.id]) {
    super();
  }
  async allows(userId: string) {
    return this.allowed.includes(userId);
  }
}

function service(
  problem: Problem,
  suggester: TestCaseSuggester,
  writer: ProblemSectionWriter = new FakeWriter(new Error('unused')),
  ai: AiAccess = new FakeAiAccess(),
) {
  const repo = { findById: async (id: string) => (id === problem.id ? problem : null) } as unknown as ProblemRepository;
  return new ProblemService(repo, {} as ProblemQueries, {} as EventPublisher, suggester, writer, ai, new UnshareChecks());
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

const draft = {
  title: 'Tổng', statement: 'Tính a + b.', inputFormat: 'Đọc từ file TONG.INP hai số a, b.', outputFormat: 'In ra a + b.', constraints: '',
  samples: [{ input: '1 2\n', expectedOutput: '3\n' }],
};

test('a section rewrite never brings file input/output back', async () => {
  const s = service(sumProblem(), new FakeSuggester(new Error('unused')), new FakeWriter({ text: 'Dữ liệu vào từ file A.INP gồm a, b.', notes: [] }));
  const result = await s.suggestSection(teacher, { section: 'inputFormat', problem: draft });
  assert.equal(result.text, 'Dữ liệu vào từ đầu vào chuẩn gồm a, b.');
});

test('without AI only the file rewrite is offered', async () => {
  const s = service(sumProblem(), new FakeSuggester(new Error('unused'), false), new FakeWriter(new Error('unused'), false));
  const fix = await s.suggestSection(teacher, { section: 'inputFormat', problem: draft });
  assert.equal(fix.text, 'Đọc từ đầu vào chuẩn hai số a, b.');
  assert.match(fix.notes[0], /chưa dùng được AI/);
  await assert.rejects(s.suggestSection(teacher, { section: 'outputFormat', problem: draft }), /chưa cấu hình AI/);
});

test('tests can be suggested before the problem is saved', async () => {
  const fake = new FakeSuggester({ suggestions: [suggestion('1  2', '3\n'), suggestion('2 3\n', '5\n')], notes: [] });
  const s = service(sumProblem(), fake);
  const result = await s.suggestDraftTests(teacher, { problem: draft, tests: [{ input: '1 2\n', expectedOutput: '3\n' }], count: 3 });
  assert.deepEqual(result.suggestions.map((t) => t.input), ['2 3\n'], 'the test the editor already has is dropped');
  assert.equal(fake.seen?.count, 3);
  assert.equal(fake.seen?.timeLimitMs, 1000);
  assert.equal(fake.seen?.solution, null);
  await assert.rejects(service(sumProblem(), new FakeSuggester(new Error('x'), false)).suggestDraftTests(teacher, { problem: draft, tests: [] }),
    /chưa cấu hình AI/);
});

test('a new problem is saved together with its tests', async () => {
  const saved: Problem[] = [];
  const repo = { nextSeq: async () => 7, save: async (p: Problem) => void saved.push(p) } as unknown as ProblemRepository;
  const s = new ProblemService(repo, {} as ProblemQueries, {} as EventPublisher, new FakeSuggester(new Error('x')), new FakeWriter(new Error('x')), new FakeAiAccess(), new UnshareChecks());
  const content = { title: 'Tổng', difficulty: 'EASY' as const, tags: [], statement: 'Tính a + b.', inputFormat: 'a, b', outputFormat: 'a + b', constraints: '', timeLimitMs: 1000, memoryLimitMb: 256 };
  const dto = await s.create(teacher, content, [
    { input: '1 2\n', expectedOutput: '3\n', isSample: true, points: 10 },
    { input: '5 5\n', expectedOutput: '10\n', isSample: false, points: 20 },
  ]);
  assert.equal(saved.length, 1, 'one save for the problem and all its tests');
  assert.deepEqual(dto.testCases.map((t) => [t.isSample, t.points]), [[true, 10], [false, 20]]);
});

test('regular (non-VIP) teacher accounts cannot use the AI features', async () => {
  const problem = sumProblem();
  const ok = { suggestions: [suggestion('5 5\n', '10\n')], notes: [] };
  const regular = new FakeAiAccess([]);
  const s = service(problem, new FakeSuggester(ok), new FakeWriter({ text: 'Hai số a, b.', notes: [] }), regular);
  await assert.rejects(s.suggestTestCases(teacher, problem.id, {}), /giáo viên VIP/);
  await assert.rejects(s.suggestDraftTests(teacher, { problem: draft, tests: [] }), /giáo viên VIP/);
  await assert.rejects(s.suggestSection(teacher, { section: 'outputFormat', problem: draft }), /giáo viên VIP/);
  // The rule-based file → standard input/output rewrite needs no AI, so it is still offered.
  const fix = await s.suggestSection(teacher, { section: 'inputFormat', problem: draft });
  assert.equal(fix.text, 'Đọc từ đầu vào chuẩn hai số a, b.');
  assert.match(fix.notes[0], /Tài khoản thường/);
});
