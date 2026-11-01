import { Injectable, Logger } from '@nestjs/common';
import type {
  Paginated,
  ProblemDetailDto,
  ProblemSummaryDto,
  SharingDto,
  SolutionDto,
  SuggestTestCasesRequest,
  TestCaseDto,
  TestCaseSuggestionsDto,
  UpsertProblemRequest,
  UpsertSolutionRequest,
  UpsertTestCaseRequest,
} from '@oj/contracts';
import type { Actor } from '../../../shared/application/actor.js';
import { EventPublisher } from '../../../shared/application/event-publisher.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { Problem, ResourceLimits, Sharing, Solution } from '../domain/problem.js';
import { ProblemQueries, ProblemRepository, type ProblemListFilter } from '../domain/problem.repository.js';
import { toDetailDto, toSummaryDto, toTestCaseDto } from './problem.mapper.js';
import { TestCaseSuggester } from './ports.js';

/** Application service for problem blueprints in teachers' banks. */
@Injectable()
export class ProblemService {
  private readonly logger = new Logger(ProblemService.name);

  constructor(
    private readonly problems: ProblemRepository,
    private readonly queries: ProblemQueries,
    private readonly events: EventPublisher,
    private readonly suggester: TestCaseSuggester,
  ) {}

  // ---------- Queries ----------

  async list(actor: Actor, filter: Omit<ProblemListFilter, 'viewerId'>): Promise<Paginated<ProblemSummaryDto>> {
    if (filter.scope === 'all' && actor.role !== 'ADMIN') {
      throw DomainError.forbidden('catalog.scope_all', 'Chỉ quản trị viên được xem toàn bộ ngân hàng.');
    }
    const { rows, total } = await this.queries.list({ ...filter, viewerId: actor.id });
    return { items: rows.map(toSummaryDto), total, page: filter.page, pageSize: filter.pageSize };
  }

  async get(actor: Actor, id: string): Promise<ProblemDetailDto> {
    const problem = await this.load(id);
    problem.ensureViewableBy(actor);
    return toDetailDto(problem, actor);
  }

  // ---------- Commands ----------

  async create(actor: Actor, input: UpsertProblemRequest): Promise<ProblemDetailDto> {
    const problem = Problem.create(await this.problems.nextSeq(), owner(actor), input, limitsOf(input));
    await this.problems.save(problem);
    return toDetailDto(problem, actor);
  }

  /** Creates a problem together with its (sample) test cases, used by the importer. */
  async createWithTests(actor: Actor, input: UpsertProblemRequest, tests: UpsertTestCaseRequest[]): Promise<string> {
    const problem = Problem.create(await this.problems.nextSeq(), owner(actor), input, limitsOf(input));
    tests.forEach((t) => problem.addTestCase(t));
    await this.problems.save(problem);
    return problem.id;
  }

  async update(actor: Actor, id: string, input: UpsertProblemRequest): Promise<ProblemDetailDto> {
    const problem = await this.loadEditable(actor, id);
    problem.update(input, limitsOf(input));
    await this.problems.save(problem);
    return toDetailDto(problem, actor);
  }

  async delete(actor: Actor, id: string): Promise<void> {
    const problem = await this.loadEditable(actor, id);
    problem.markDeleted();
    await this.problems.delete(id);
    await this.events.publish(problem.pullEvents());
  }

  async share(actor: Actor, id: string, input: SharingDto): Promise<ProblemDetailDto> {
    const problem = await this.loadEditable(actor, id);
    problem.share(Sharing.of(input.isPublic, input.publicTests, input.publicSolution));
    await this.problems.save(problem);
    return toDetailDto(problem, actor);
  }

  async copy(actor: Actor, id: string): Promise<ProblemDetailDto> {
    const copy = await this.copyToBank(actor, id);
    return toDetailDto(copy, actor);
  }

  /** Copies a viewable problem into the actor's bank (also used when copying sets). */
  async copyToBank(actor: Actor, id: string): Promise<Problem> {
    const source = await this.load(id);
    const copy = source.copyFor(actor, await this.problems.nextSeq());
    await this.problems.save(copy);
    return copy;
  }

  async addTestCase(actor: Actor, problemId: string, input: UpsertTestCaseRequest): Promise<TestCaseDto> {
    const problem = await this.loadEditable(actor, problemId);
    const testCase = problem.addTestCase(input);
    await this.problems.save(problem);
    return toTestCaseDto(testCase);
  }

  async updateTestCase(actor: Actor, problemId: string, testCaseId: string, input: UpsertTestCaseRequest): Promise<TestCaseDto> {
    const problem = await this.loadEditable(actor, problemId);
    const testCase = problem.updateTestCase(testCaseId, input);
    await this.problems.save(problem);
    return toTestCaseDto(testCase);
  }

  async removeTestCase(actor: Actor, problemId: string, testCaseId: string): Promise<void> {
    const problem = await this.loadEditable(actor, problemId);
    problem.removeTestCase(testCaseId);
    await this.problems.save(problem);
  }

  /** AI-proposed tests for the editor to review; nothing is saved. */
  async suggestTestCases(actor: Actor, problemId: string, input: SuggestTestCasesRequest): Promise<TestCaseSuggestionsDto> {
    const problem = await this.loadEditable(actor, problemId);
    if (!this.suggester.available) {
      throw DomainError.validation('catalog.ai_unavailable', 'Máy chủ chưa cấu hình AI nên chưa gợi ý test được.');
    }
    const { content, limits, solution } = problem;
    let result: TestCaseSuggestionsDto;
    try {
      result = await this.suggester.suggest({
        ...content,
        ...limits,
        existingTests: problem.testCases.slice(0, MAX_SHOWN_TESTS).map((t) => ({ input: t.data.input, expectedOutput: t.data.expectedOutput })),
        solution: solution && { language: solution.language, code: solution.code, explanation: solution.explanation },
        count: input.count ?? 5,
        focus: input.focus?.trim() || null,
      });
    } catch (error) {
      this.logger.warn(`Test suggestions failed for ${problem.code}: ${(error as Error).message}`);
      throw DomainError.validation('catalog.ai_failed', 'AI chưa gợi ý được test lúc này. Hãy thử lại sau ít phút.');
    }
    // Drop suggestions whose input the problem (or an earlier suggestion) already has.
    const seen = new Set(problem.testCases.map((t) => sameInput(t.data.input)));
    const suggestions = result.suggestions.filter((s) => {
      const key = sameInput(s.input);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { ...result, suggestions };
  }

  async setSolution(actor: Actor, problemId: string, input: UpsertSolutionRequest): Promise<SolutionDto> {
    const problem = await this.loadEditable(actor, problemId);
    const solution = Solution.of(input.explanation, input.language, input.code);
    problem.setSolution(solution);
    await this.problems.save(problem);
    return { ...solution };
  }

  async clearSolution(actor: Actor, problemId: string): Promise<void> {
    const problem = await this.loadEditable(actor, problemId);
    problem.setSolution(null);
    await this.problems.save(problem);
  }

  private async load(id: string): Promise<Problem> {
    const problem = await this.problems.findById(id);
    if (!problem) throw DomainError.notFound('catalog.problem_not_found', 'Không tìm thấy bài tập.');
    return problem;
  }

  private async loadEditable(actor: Actor, id: string): Promise<Problem> {
    const problem = await this.load(id);
    problem.ensureViewableBy(actor);
    problem.ensureEditableBy(actor);
    return problem;
  }
}

const MAX_SHOWN_TESTS = 10;
const sameInput = (s: string) => s.trim().split(/\s+/).join(' ');
const owner = (actor: Actor) => ({ id: actor.id, name: actor.name });
const limitsOf = (input: UpsertProblemRequest) => ResourceLimits.of(input.timeLimitMs, input.memoryLimitMb);
