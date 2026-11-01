import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  AnswerKeyDto,
  BankScope,
  ProblemDetailDto,
  ProblemSetDto,
  UpsertProblemSetRequest,
} from '@oj/contracts';
import type { Actor } from '../../../shared/application/actor.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { PROBLEM_DELETED, type ProblemDeletedEvent } from '../../catalog/catalog.events.js';
import { ProblemSet } from '../domain/problem-set.js';
import { ProblemSetRepository } from '../domain/repositories.js';
import { ProblemCatalog } from './ports.js';

/** Set blueprints in teachers' banks. */
@Injectable()
export class ProblemSetService {
  constructor(
    private readonly sets: ProblemSetRepository,
    private readonly problems: ProblemCatalog,
  ) {}

  async list(actor: Actor, scope: BankScope): Promise<ProblemSetDto[]> {
    if (scope === 'all' && actor.role !== 'ADMIN') {
      throw DomainError.forbidden('assessment.scope_all', 'Chỉ quản trị viên được xem toàn bộ ngân hàng.');
    }
    return this.dtos(await this.sets.list(scope, actor.id), actor);
  }

  async get(actor: Actor, id: string): Promise<ProblemSetDto> {
    const set = await this.load(id);
    set.ensureViewableBy(actor);
    return (await this.dtos([set], actor))[0];
  }

  async create(actor: Actor, input: UpsertProblemSetRequest): Promise<ProblemSetDto> {
    await this.ensureOwnProblems(actor, actor.id, input.items.map((i) => i.problemId));
    const set = ProblemSet.compose(actor, input, input.items);
    await this.sets.save(set);
    return (await this.dtos([set], actor))[0];
  }

  async update(actor: Actor, id: string, input: UpsertProblemSetRequest): Promise<ProblemSetDto> {
    const set = await this.load(id);
    set.ensureEditableBy(actor);
    await this.ensureOwnProblems(actor, set.snapshot.owner.id, input.items.map((i) => i.problemId));
    set.revise(input, input.items);
    if (set.snapshot.isPublic) set.share(true, await this.allPublic(set));
    await this.sets.save(set);
    return (await this.dtos([set], actor))[0];
  }

  async delete(actor: Actor, id: string): Promise<void> {
    const set = await this.load(id);
    set.ensureEditableBy(actor);
    await this.sets.delete(id);
  }

  async share(actor: Actor, id: string, isPublic: boolean): Promise<ProblemSetDto> {
    const set = await this.load(id);
    set.ensureEditableBy(actor);
    set.share(isPublic, await this.allPublic(set));
    await this.sets.save(set);
    return (await this.dtos([set], actor))[0];
  }

  /** Copies a public set and its problems into the actor's bank. */
  async copy(actor: Actor, id: string): Promise<ProblemSetDto> {
    const source = await this.load(id);
    source.ensureViewableBy(actor);
    const mapping = await this.problems.copyIntoBank(actor, source.snapshot.items.map((i) => i.problemId));
    const copy = source.copyFor(actor, mapping);
    await this.sets.save(copy);
    return (await this.dtos([copy], actor))[0];
  }

  async answerKey(actor: Actor, id: string): Promise<AnswerKeyDto> {
    const set = await this.load(id);
    set.ensureEditableBy(actor);
    const details = await this.problems.getDetails(set.snapshot.items.map((i) => i.problemId), actor);
    const [problemSet] = await this.dtos([set], actor, details);
    return {
      problemSet,
      problems: set.snapshot.items
        .filter((i) => details.has(i.problemId))
        .map((i) => ({ ...details.get(i.problemId)!, points: i.points })),
    };
  }

  /** Used by sessions: the set must be editable by the actor (own bank, or admin). */
  async loadForSession(actor: Actor, id: string): Promise<ProblemSet> {
    const set = await this.load(id);
    set.ensureEditableBy(actor);
    return set;
  }

  @OnEvent(PROBLEM_DELETED, { async: true, promisify: true })
  async onProblemDeleted(event: ProblemDeletedEvent): Promise<void> {
    for (const set of await this.sets.findContainingProblem(event.problemId)) {
      if (set.dropProblem(event.problemId)) await this.sets.save(set);
    }
  }

  private async ensureOwnProblems(actor: Actor, ownerId: string, ids: string[]) {
    const details = await this.problems.getDetails(ids, null);
    for (const id of ids) {
      const p = details.get(id);
      if (!p) throw DomainError.validation('assessment.unknown_problem', 'Đề có bài tập không tồn tại.');
      if (p.ownerId !== ownerId && actor.role !== 'ADMIN') {
        throw DomainError.validation('assessment.not_own_problem',
          `Bài ${p.code} không thuộc ngân hàng của bạn. Hãy lưu bản sao về ngân hàng trước khi đưa vào đề.`);
      }
    }
  }

  private async allPublic(set: ProblemSet): Promise<boolean> {
    const details = await this.problems.getDetails(set.snapshot.items.map((i) => i.problemId), null);
    return [...details.values()].every((p) => p.sharing.isPublic);
  }

  private async load(id: string): Promise<ProblemSet> {
    const set = await this.sets.findById(id);
    if (!set) throw DomainError.notFound('assessment.set_not_found', 'Không tìm thấy đề.');
    return set;
  }

  private async dtos(sets: ProblemSet[], actor: Actor, known?: Map<string, ProblemDetailDto>): Promise<ProblemSetDto[]> {
    const details = known ?? (await this.problems.getDetails(sets.flatMap((s) => s.snapshot.items.map((i) => i.problemId)), null));
    return sets.map((set) => {
      const s = set.snapshot;
      return {
        id: set.id,
        title: s.title,
        description: s.description,
        type: s.type,
        ownerId: s.owner.id,
        ownerName: s.owner.name,
        isPublic: s.isPublic,
        copiedFrom: s.copiedFrom,
        totalPoints: set.totalPoints,
        canEdit: set.canEdit(actor),
        createdAt: s.createdAt.toISOString(),
        items: s.items.map((item, index) => {
          const p = details.get(item.problemId);
          return {
            problemId: item.problemId,
            problemCode: p?.code ?? '?',
            problemTitle: p?.title ?? '(bài đã bị xóa)',
            difficulty: p?.difficulty ?? 'MEDIUM',
            points: item.points,
            order: index + 1,
          };
        }),
      };
    });
  }
}
