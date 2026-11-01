import { ProblemSetTypes, type ProblemSetType } from '@oj/contracts';
import type { Actor } from '../../../shared/application/actor.js';
import { AggregateRoot, newId } from '../../../shared/domain/aggregate-root.js';
import { assert, DomainError } from '../../../shared/domain/domain-error.js';

const MAX_ITEMS = 50;

export interface ProblemSetItem {
  problemId: string;
  points: number;
}

export interface ProblemSetDetails {
  title: string;
  description: string;
  type: ProblemSetType;
}

export interface Owner {
  id: string;
  name: string;
}

export interface SetSourceRef {
  id: string;
  code: string;
  ownerName: string;
}

export interface ProblemSetState extends ProblemSetDetails {
  owner: Owner;
  items: ProblemSetItem[];
  isPublic: boolean;
  copiedFrom: SetSourceRef | null;
  createdAt: Date;
}

/**
 * Set blueprint ("đề" in a teacher's bank): an ordered selection of the owner's problems with points.
 * Nobody takes a blueprint directly; sessions are created from it.
 */
export class ProblemSet extends AggregateRoot {
  private constructor(id: string, private state: ProblemSetState) {
    super(id);
  }

  static compose(owner: Actor, details: ProblemSetDetails, items: ProblemSetItem[]): ProblemSet {
    assert(owner.role !== 'STUDENT', 'assessment.not_staff', 'Chỉ giáo viên mới được tạo đề.');
    return new ProblemSet(newId(), {
      ...validDetails(details),
      owner: { id: owner.id, name: owner.name },
      items: validItems(items),
      isPublic: false,
      copiedFrom: null,
      createdAt: new Date(),
    });
  }

  static rehydrate(id: string, state: ProblemSetState): ProblemSet {
    return new ProblemSet(id, state);
  }

  get snapshot(): Readonly<ProblemSetState> {
    return this.state;
  }

  get totalPoints(): number {
    return this.state.items.reduce((sum, i) => sum + i.points, 0);
  }

  canEdit(actor: Actor): boolean {
    return actor.id === this.state.owner.id || actor.role === 'ADMIN';
  }

  canView(actor: Actor): boolean {
    return this.canEdit(actor) || (this.state.isPublic && actor.role !== 'STUDENT');
  }

  ensureEditableBy(actor: Actor): void {
    this.ensureViewableBy(actor);
    if (!this.canEdit(actor)) {
      throw DomainError.forbidden('assessment.not_owner', 'Chỉ giáo viên sở hữu đề này hoặc quản trị viên được chỉnh sửa.');
    }
  }

  ensureViewableBy(actor: Actor): void {
    if (!this.canView(actor)) throw DomainError.notFound('assessment.set_not_found', 'Không tìm thấy đề.');
  }

  revise(details: ProblemSetDetails, items: ProblemSetItem[]): void {
    const validated = validItems(items);
    if (this.state.isPublic) {
      assert(validated.length > 0, 'assessment.empty_public', 'Đề đang công khai phải có ít nhất một bài.');
    }
    this.state = { ...this.state, ...validDetails(details), items: validated };
  }

  /** A set can only be public when every problem in it is public (`allProblemsPublic`). */
  share(isPublic: boolean, allProblemsPublic: boolean): void {
    if (isPublic) {
      assert(this.state.items.length > 0, 'assessment.empty', 'Đề cần có ít nhất một bài trước khi công khai.');
      assert(allProblemsPublic, 'assessment.private_problems', 'Hãy công khai đề bài của tất cả các bài trong đề trước khi công khai đề.');
    }
    this.state.isPublic = isPublic;
  }

  /** A private copy for `actor`, pointing at copies of the problems (`problemIds`: old id -> new id). */
  copyFor(actor: Actor, problemIds: Map<string, string>): ProblemSet {
    const s = this.state;
    const copy = ProblemSet.compose(actor, { title: s.title, description: s.description, type: s.type },
      s.items.map((i) => ({ problemId: problemIds.get(i.problemId)!, points: i.points })));
    copy.state.copiedFrom = { id: this.id, code: s.title, ownerName: s.owner.name };
    return copy;
  }

  /** Reaction to a problem being deleted from the catalog. Returns true if anything changed. */
  dropProblem(problemId: string): boolean {
    const before = this.state.items.length;
    this.state.items = this.state.items.filter((i) => i.problemId !== problemId);
    if (this.state.items.length === 0) this.state.isPublic = false;
    return this.state.items.length !== before;
  }
}

function validDetails(details: ProblemSetDetails): ProblemSetDetails {
  const title = details.title.trim();
  assert(title.length >= 1 && title.length <= 200, 'assessment.invalid_title', 'Tên đề phải từ 1 đến 200 ký tự.');
  assert(ProblemSetTypes.includes(details.type), 'assessment.invalid_type', 'Loại đề không hợp lệ.');
  return { ...details, title };
}

function validItems(items: ProblemSetItem[]): ProblemSetItem[] {
  assert(items.length <= MAX_ITEMS, 'assessment.too_many_items', `Một đề tối đa ${MAX_ITEMS} bài.`);
  const ids = new Set(items.map((i) => i.problemId));
  assert(ids.size === items.length, 'assessment.duplicate_problem', 'Một bài chỉ được xuất hiện một lần trong đề.');
  for (const item of items) {
    assert(Number.isFinite(item.points) && item.points > 0 && item.points <= 1000,
      'assessment.invalid_points', 'Điểm mỗi bài phải lớn hơn 0 và không quá 1000.');
  }
  return items.map((i) => ({ problemId: i.problemId, points: i.points }));
}
