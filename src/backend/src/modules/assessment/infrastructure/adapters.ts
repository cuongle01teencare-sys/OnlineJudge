import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor.js';
import { CatalogFacade } from '../../catalog/application/catalog.facade.js';
import { ClassroomFacade } from '../../classroom/application/classroom.facade.js';
import { ClassAccess, ProblemCatalog } from '../application/ports.js';
import { ProblemSetRepository } from '../domain/repositories.js';

@Injectable()
export class CatalogProblemCatalog extends ProblemCatalog {
  constructor(private readonly catalog: CatalogFacade) {
    super();
  }

  getDetails(ids: string[], viewer: Actor | null) {
    return this.catalog.getProblemDetails(ids, viewer);
  }

  async snapshot(actor: Actor, ids: string[]) {
    const snapshots = await this.catalog.snapshotForSession(actor, ids);
    return snapshots.map(({ id, ownerId: _, ...s }) => ({ ...s, sourceProblemId: id }));
  }

  copyIntoBank(actor: Actor, ids: string[]) {
    return this.catalog.copyIntoBank(actor, ids);
  }
}

/** A public set may only hold public problems: while one uses a problem, its statement stays public. */
@Injectable()
export class PublicSetsKeepProblemsPublic implements OnModuleInit {
  constructor(
    private readonly catalog: CatalogFacade,
    private readonly sets: ProblemSetRepository,
  ) {}

  onModuleInit() {
    this.catalog.registerUnshareCheck(async (problemId) => {
      const titles = (await this.sets.findContainingProblem(problemId))
        .filter((set) => set.snapshot.isPublic)
        .map((set) => `"${set.snapshot.title}"`);
      if (!titles.length) return null;
      return `Bài này đang nằm trong ${titles.length > 1 ? 'các đề' : 'đề'} công khai ${titles.join(', ')}. `
        + 'Hãy chuyển đề về riêng tư hoặc bỏ bài khỏi đề trước khi tắt "Công khai đề bài".';
    });
  }
}

@Injectable()
export class ClassroomClassAccess extends ClassAccess {
  constructor(private readonly classrooms: ClassroomFacade) {
    super();
  }

  getClasses(ids: string[]) {
    return this.classrooms.getClasses(ids);
  }

  managedClassIds(actor: Actor) {
    return this.classrooms.managedClassIds(actor);
  }

  canManage(actor: Actor, classId: string) {
    return this.classrooms.canManage(actor, classId);
  }

  membership(userId: string, classId: string) {
    return this.classrooms.membership(userId, classId);
  }

  classIdsOfStudent(studentId: string) {
    return this.classrooms.classIdsOfStudent(studentId);
  }

  currentStudents(classId: string) {
    return this.classrooms.currentStudents(classId);
  }
}
